// Measures key user-facing timings under a throttled "4G phone" connection,
// with every Supabase call delayed to mimic real round trips. Usage:
//   node e2e/perf.mjs http://localhost:4177
import { chromium } from '@playwright/test'

const base = process.argv[2] ?? 'http://localhost:4177'
const SUPA = 'https://e2e-mock.supabase.co'
const API_DELAY = 350 // ms per Supabase request (Mumbai round trip + server time)
const now = Math.floor(Date.now() / 1000)
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const uid = '11111111-1111-4111-8111-111111111111'
const user = {
  id: uid,
  aud: 'authenticated',
  role: 'authenticated',
  email: 'a@b.com',
  app_metadata: {},
  user_metadata: {},
  created_at: new Date().toISOString(),
}
const token = [
  b64({ alg: 'HS256' }),
  b64({ sub: uid, exp: now + 3600, role: 'authenticated' }),
  's',
].join('.')
const session = {
  access_token: token,
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: now + 3600,
  refresh_token: 'r',
  user,
}

const browser = await chromium.launch({ executablePath: process.env.PW_CHROME_PATH || undefined })

async function run(label) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  const cdp = await ctx.newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
  // "Regular 4G" preset-ish: 20 Mbps down, 150 ms RTT.
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: (4 * 1024 * 1024) / 8,
    uploadThroughput: (3 * 1024 * 1024) / 8,
  })
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  const delay = () => new Promise((r) => setTimeout(r, API_DELAY))
  await page.route(`${SUPA}/auth/v1/**`, async (route) => {
    await delay()
    const p = new URL(route.request().url()).pathname
    if (p.endsWith('/otp'))
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    if (p.endsWith('/verify'))
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(session),
      })
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(user),
    })
  })
  await page.route(`${SUPA}/rest/v1/**`, async (route) => {
    await delay()
    const obj = (route.request().headers()['accept'] ?? '').includes('vnd.pgrst.object')
    const row = { id: uid, display_name: 'Anshuta' }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(obj ? row : [row]),
    })
  })

  const t = {}
  let t0 = Date.now()
  await page.goto(base + '/')
  await page.getByRole('link', { name: 'Get started' }).waitFor()
  t['landing: first content'] = Date.now() - t0

  t0 = Date.now()
  await page.getByRole('link', { name: 'Get started' }).click()
  await page.getByLabel('Email').waitFor()
  t['tap Get started → sign-in form'] = Date.now() - t0

  await page.getByLabel('Email').fill('a@b.com')
  await page.getByRole('button', { name: 'Email me a code' }).click()
  t0 = Date.now()
  // Entering the 6th digit signs in automatically.
  await page.getByLabel('Sign-in code').fill('424242')
  await page.getByRole('heading', { name: /Hi,/ }).waitFor()
  t['submit code → home'] = Date.now() - t0

  t0 = Date.now()
  await page.reload()
  await page.getByRole('heading', { name: /Hi,/ }).waitFor()
  t['reload /home (signed in, cold cache)'] = Date.now() - t0

  t0 = Date.now()
  await page.goto(base + '/sign-in')
  await page.getByRole('heading', { name: /Hi,/ }).waitFor()
  t['open /sign-in while signed in → home'] = Date.now() - t0

  console.log(`\n${label}`)
  for (const [k, v] of Object.entries(t))
    console.log(`  ${k.padEnd(40)} ${String(v).padStart(5)} ms`)
  await ctx.close()
}

await run(process.argv[3] ?? 'run')
await browser.close()
