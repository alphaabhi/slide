import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Browser, type Page } from '@playwright/test'
import { attachBackend, Backend, VALID_CODE } from './mock-supabase'

/** A separate browser (own storage, own session) for one person. */
async function person(browser: Browser, backend: Backend, viewport = { width: 390, height: 844 }) {
  const ctx = await browser.newContext({ viewport })
  const page = await ctx.newPage()
  await attachBackend(page, backend)
  return page
}

async function signIn(page: Page, email: string) {
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Email me a code' }).click()
  await page.getByLabel('Sign-in code').fill(VALID_CODE)
}

async function signUp(page: Page, email: string, name: string) {
  await signIn(page, email)
  await page.getByLabel('Display name').fill(name)
  await page.getByRole('button', { name: 'Continue' }).click()
}

async function expectNoSeriousA11y(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  const serious = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  expect(
    serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([])
}

async function createSpace(page: Page, title = 'Not the Hinge chat') {
  await page.getByRole('button', { name: 'New space' }).click()
  const dialog = page.getByRole('dialog', { name: 'Create a space' })
  await dialog.getByLabel('Name your space (optional)').fill(title)
  await dialog.getByRole('button', { name: 'Create space' }).click()
  await expect(page.getByRole('heading', { name: /Waiting for someone to/ })).toBeVisible()
  const link = (await page.locator('text=/\\/i\\/[A-Za-z0-9_-]+/').first().innerText()).trim()
  return link
}

// Only run once (on the phone-sized project); this test manages its own viewports.
test.beforeEach(() => {
  test.skip(test.info().project.name !== 'mobile', 'two-person journey runs once')
})

test('two people: create → invite → join → both inside → outsider rejected → leave', async ({
  browser,
}) => {
  test.setTimeout(90_000)
  const backend = new Backend()

  // Abhi creates a space
  const abhi = await person(browser, backend)
  await abhi.goto('/sign-in')
  await signUp(abhi, 'abhi@example.com', 'Abhi')
  await expect(abhi.getByText('No spaces yet')).toBeVisible()
  const link = await createSpace(abhi)
  expect(link).toMatch(/^http:\/\/localhost:\d+\/i\/[A-Za-z0-9_-]+$/)
  await expect(abhi.getByRole('button', { name: /Copy invite/ })).toBeVisible()
  await expectNoSeriousA11y(abhi)

  // Meera opens the link signed out: sees who invited her, and the token leaves the address bar
  const meera = await person(browser, backend)
  await meera.goto(link)
  await expect(meera).toHaveURL(/\/join$/)
  await expect(
    meera.getByRole('heading', { name: /Abhi wants to take the conversation/ }),
  ).toBeVisible()
  await expect(meera.getByText('Not the Hinge chat')).toBeVisible()
  await expectNoSeriousA11y(meera)

  // …signs up, picks a name, comes straight back and joins
  await meera.getByRole('link', { name: 'Sign in to join' }).click()
  await signIn(meera, 'meera@example.com')
  await expect(meera.getByRole('heading', { name: /What should we call/ })).toBeVisible()
  await meera.getByLabel('Display name').fill('Meera')
  await meera.getByRole('button', { name: 'Continue' }).click()
  await meera.getByRole('button', { name: 'Join Abhi' }).click()
  // Joined: straight into the chat with Abhi
  await expect(meera.getByRole('textbox', { name: 'Message Abhi' })).toBeVisible()
  await expect(meera.getByText('You’re in. Say hi to Abhi')).toBeVisible()
  await expectNoSeriousA11y(meera)

  // Abhi's waiting screen notices without a refresh
  await expect(abhi.getByRole('textbox', { name: 'Message Meera' })).toBeVisible({
    timeout: 15_000,
  })
  await expect(abhi.getByText('Meera slid in 🎉', { exact: true })).toBeVisible()

  // A third person with the same link is turned away
  const stranger = await person(browser, backend)
  await stranger.goto(link)
  await expect(stranger.getByRole('heading', { name: 'Someone already joined' })).toBeVisible()
  await stranger.goto('/sign-in')
  await signUp(stranger, 'stranger@example.com', 'Stranger')
  await expect(stranger.getByText('No spaces yet')).toBeVisible()
  // …and can't open the space directly either
  await stranger.goto(abhi.url())
  await expect(stranger.getByRole('heading', { name: 'This space isn’t available' })).toBeVisible()

  // Both see the space on home with the right label
  await abhi.goto('/home')
  await expect(abhi.getByRole('link', { name: /Not the Hinge chat.*With Meera/ })).toBeVisible()

  // Meera leaves; Abhi's space becomes closed and Meera loses it
  await meera.getByRole('button', { name: 'Space options' }).click()
  await meera.getByRole('button', { name: 'Leave space' }).click()
  const confirm = meera.getByRole('dialog', { name: 'Leave this space?' })
  await expect(confirm.getByText(/Abhi keeps what’s already here/)).toBeVisible()
  await confirm.getByRole('button', { name: 'Leave space' }).click()
  await expect(meera).toHaveURL(/\/home$/)
  await expect(meera.getByText('No spaces yet')).toBeVisible()
  await abhi.reload()
  await expect(abhi.getByRole('link', { name: /Not the Hinge chat.*Closed/ })).toBeVisible()
})

test('your own link, a fresh link, a cancelled link and a made-up link', async ({ browser }) => {
  const backend = new Backend()
  const abhi = await person(browser, backend)
  await abhi.goto('/sign-in')
  await signUp(abhi, 'abhi@example.com', 'Abhi')
  const first = await createSpace(abhi, 'late night chats')

  // Opening your own link explains it instead of joining
  await abhi.goto(first)
  await expect(abhi.getByRole('heading', { name: 'This is your own invite' })).toBeVisible()
  await abhi.getByRole('link', { name: 'Open your space' }).click()

  // A refresh keeps the link visible in this tab
  await abhi.reload()
  await expect(abhi.getByRole('button', { name: /Copy invite/ })).toBeVisible()

  // Make a new link: the old one stops working
  await abhi.getByRole('button', { name: 'Make a new link' }).click()
  await expect(abhi.getByText('New invite link ready', { exact: true })).toBeVisible()
  const second = (await abhi.locator('text=/\\/i\\/[A-Za-z0-9_-]+/').first().innerText()).trim()
  expect(second).not.toBe(first)

  const meera = await person(browser, backend)
  await meera.goto(first)
  await expect(meera.getByRole('heading', { name: 'This invite was cancelled' })).toBeVisible()

  // Cancel the current link too
  await abhi.getByRole('button', { name: 'Cancel link' }).click()
  await expect(abhi.getByText('There’s no active invite link')).toBeVisible()
  await meera.goto(second)
  await expect(meera.getByRole('heading', { name: 'This invite was cancelled' })).toBeVisible()

  await meera.goto('/i/not-a-real-token')
  await expect(meera.getByRole('heading', { name: 'This invite link doesn’t work' })).toBeVisible()
})

test('deleting a space nobody joined', async ({ browser }) => {
  const backend = new Backend()
  const abhi = await person(browser, backend)
  await abhi.goto('/sign-in')
  await signUp(abhi, 'abhi@example.com', 'Abhi')
  const link = await createSpace(abhi, 'temp')
  await abhi.getByRole('button', { name: 'Delete space' }).click()
  const dialog = abhi.getByRole('dialog', { name: 'Delete this space?' })
  await expect(dialog.getByText(/invite link will be deleted/)).toBeVisible()
  await dialog.getByRole('button', { name: 'Delete space' }).click()
  await expect(abhi.getByText('No spaces yet')).toBeVisible()

  const meera = await person(browser, backend)
  await meera.goto(link)
  await expect(meera.getByRole('heading', { name: 'This invite link doesn’t work' })).toBeVisible()
})
