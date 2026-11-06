import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Browser, type Page } from '@playwright/test'
import { attachBackend, Backend, VALID_CODE } from './mock-supabase'

async function person(browser: Browser, backend: Backend, desktop = false) {
  // The project's device settings (e.g. a touchscreen phone) would otherwise apply to every
  // context; a desktop person needs a real mouse-and-keyboard browser.
  const ctx = await browser.newContext(
    desktop
      ? {
          viewport: { width: 1280, height: 800 },
          hasTouch: false,
          isMobile: false,
          deviceScaleFactor: 1,
        }
      : { viewport: { width: 390, height: 844 } },
  )
  const page = await ctx.newPage()
  await attachBackend(page, backend)
  return page
}

async function signUp(page: Page, email: string, name: string) {
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Email me a code' }).click()
  await page.getByLabel('Sign-in code').fill(VALID_CODE)
  await page.getByLabel('Display name').fill(name)
  await page.getByRole('button', { name: 'Continue' }).click()
}

/** Abhi creates a space, Meera joins it. Returns both pages, already inside the chat. */
async function pair(browser: Browser, backend: Backend, desktopAbhi = false) {
  const abhi = await person(browser, backend, desktopAbhi)
  await abhi.goto('/sign-in')
  await signUp(abhi, 'abhi@example.com', 'Abhi')
  await abhi.getByRole('button', { name: 'New space' }).click()
  await abhi.getByRole('button', { name: 'Create space' }).click()
  const link = (await abhi.locator('text=/\\/i\\/[A-Za-z0-9_-]+/').first().innerText()).trim()

  const meera = await person(browser, backend)
  await meera.goto(link)
  await meera.getByRole('link', { name: 'Sign in to join' }).click()
  await meera.getByLabel('Email').fill('meera@example.com')
  await meera.getByRole('button', { name: 'Email me a code' }).click()
  await meera.getByLabel('Sign-in code').fill(VALID_CODE)
  await meera.getByLabel('Display name').fill('Meera')
  await meera.getByRole('button', { name: 'Continue' }).click()
  await meera.getByRole('button', { name: 'Join Abhi' }).click()

  await expect(meera.getByRole('textbox', { name: 'Message Abhi' })).toBeVisible()
  await expect(abhi.getByRole('textbox', { name: 'Message Meera' })).toBeVisible({
    timeout: 15_000,
  })
  const spaceId = [...backend.spaces.keys()][0]!
  return {
    abhi,
    meera,
    spaceId,
    abhiId: backend.usersByEmail.get('abhi@example.com')!,
    meeraId: backend.usersByEmail.get('meera@example.com')!,
  }
}

async function send(page: Page, partner: string, text: string) {
  await page.getByRole('textbox', { name: `Message ${partner}` }).fill(text)
  await page.getByRole('button', { name: 'Send message' }).click()
}

const list = (page: Page) => page.getByRole('list', { name: 'Messages' })

test.beforeEach(() => {
  test.skip(test.info().project.name !== 'mobile', 'multi-person journeys run once')
})

test('two people chat live: messages arrive instantly, in order, and persist', async ({
  browser,
}) => {
  test.setTimeout(90_000)
  const backend = new Backend()
  const { abhi, meera } = await pair(browser, backend, true)

  // Empty state with conversation starters
  await expect(meera.getByRole('heading', { name: 'Say hi to Abhi' })).toBeVisible()
  await meera
    .getByRole('button', { name: 'What’s your most dangerously charming quality?' })
    .click()
  await expect(meera.getByRole('textbox', { name: 'Message Abhi' })).toHaveValue(
    'What’s your most dangerously charming quality?',
  )
  await meera.getByRole('button', { name: 'Send message' }).click()

  // Abhi (on desktop) sees it live, then replies with Enter; Shift+Enter makes a new line
  await expect(list(abhi).getByText('What’s your most dangerously charming quality?')).toBeVisible({
    timeout: 5_000,
  })
  const box = abhi.getByRole('textbox', { name: 'Message Meera' })
  await box.fill('chai, obviously')
  await box.press('Enter')
  await box.pressSequentially('line one')
  await box.press('Shift+Enter')
  await box.pressSequentially('line two')
  await box.press('Enter')
  await expect(box).toHaveValue('')

  await expect(list(meera).getByText('chai, obviously')).toBeVisible({ timeout: 5_000 })
  await expect(list(meera).getByText(/line one\s+line two/)).toBeVisible()

  // Unicode and emoji round-trip
  await send(meera, 'Abhi', 'नमस्ते 🌸 très bien')
  await expect(list(abhi).getByText('नमस्ते 🌸 très bien')).toBeVisible({ timeout: 5_000 })

  // Same order for both, and it survives a refresh
  const expected = [
    'What’s your most dangerously charming quality?',
    'chai, obviously',
    'line one\nline two',
    'नमस्ते 🌸 très bien',
  ]
  const bodies = async (p: Page) =>
    (await list(p).locator('.slide-bubble').allInnerTexts()).map((t) => t.trim())
  expect(await bodies(abhi)).toEqual(expected)
  await meera.reload()
  await expect(list(meera).getByText('नमस्ते 🌸 très bien')).toBeVisible()
  expect(await bodies(meera)).toEqual(expected)
  expect(backend.messages).toHaveLength(4)

  // Sender sees "Sent" only after the server confirmed
  await expect(list(meera).getByText('Sent').last()).toBeVisible()

  await expectNoSeriousA11y(meera)
})

test('a failed send is shown, retried once on tap, and never duplicated', async ({ browser }) => {
  test.setTimeout(90_000)
  const backend = new Backend()
  const { abhi, meera } = await pair(browser, backend)

  backend.failSends = 1
  await send(meera, 'Abhi', 'are you there?')
  await expect(list(meera).getByText('Not sent')).toBeVisible()
  // The draft isn't lost: the message stays on screen with a Retry button
  await list(meera).getByRole('button', { name: 'Retry' }).click()
  await expect(list(meera).getByText('Not sent')).toHaveCount(0)
  await expect(list(abhi).getByText('are you there?')).toBeVisible({ timeout: 5_000 })
  expect(backend.messages.filter((m) => m.body === 'are you there?')).toHaveLength(1)
})

test('offline: messages wait, then send by themselves when the connection is back', async ({
  browser,
}) => {
  test.setTimeout(90_000)
  const backend = new Backend()
  const { abhi, meera } = await pair(browser, backend)

  await meera.context().setOffline(true)
  // Requests to the test backend are intercepted before the network, so make them fail too.
  backend.failSends = 1000
  await expect(
    meera.getByText('You’re offline. Messages will send when you’re back.'),
  ).toBeVisible()
  await send(meera, 'Abhi', 'sent from the metro')
  await expect(list(meera).getByText('Not sent')).toBeVisible()

  backend.failSends = 0
  await meera.context().setOffline(false)
  await expect(list(meera).getByText('Not sent')).toHaveCount(0, { timeout: 10_000 })
  await expect(list(abhi).getByText('sent from the metro')).toBeVisible({ timeout: 10_000 })
  expect(backend.messages.filter((m) => m.body === 'sent from the metro')).toHaveLength(1)
})

test('if the live connection drops, messages still arrive and nothing is missed', async ({
  browser,
}) => {
  test.setTimeout(90_000)
  const backend = new Backend()
  const { meera, spaceId, abhiId } = await pair(browser, backend)

  backend.dropLive()
  await expect(meera.getByText('Reconnecting…')).toBeVisible({ timeout: 10_000 })
  backend.addMessage(spaceId, abhiId, 'sent while you were disconnected')
  // The fallback check picks it up even without the live connection
  await expect(list(meera).getByText('sent while you were disconnected')).toBeVisible({
    timeout: 12_000,
  })

  backend.restoreLive()
  backend.addMessage(spaceId, abhiId, 'and this one after')
  await expect(list(meera).getByText('and this one after')).toBeVisible({ timeout: 15_000 })
  // No duplicates on screen after the reconnect catch-up
  await expect(list(meera).getByText('sent while you were disconnected')).toHaveCount(1)
})

test('long history: opens at the newest, loads older pages on scroll without jumping', async ({
  browser,
}) => {
  test.setTimeout(90_000)
  const backend = new Backend()
  const { meera, spaceId, abhiId, meeraId } = await pair(browser, backend)
  for (let i = 1; i <= 120; i++)
    backend.addMessage(spaceId, i % 2 ? abhiId : meeraId, `message ${i}`)
  await meera.reload()

  await expect(list(meera).getByText('message 120', { exact: true })).toBeVisible()
  await expect(list(meera).getByText('message 1', { exact: true })).toHaveCount(0)
  // Only one page (50) is loaded at first
  expect(await list(meera).locator('.slide-bubble').count()).toBe(50)

  const scroller = meera.getByTestId('message-list')
  for (let i = 0; i < 4; i++) {
    await scroller.evaluate((el) => (el.scrollTop = 0))
    await meera.waitForTimeout(600)
  }
  await expect(list(meera).getByText('message 1', { exact: true })).toBeAttached()
  expect(await list(meera).locator('.slide-bubble').count()).toBe(120)
})

test('new messages while reading older ones: a button instead of a jump', async ({ browser }) => {
  test.setTimeout(90_000)
  const backend = new Backend()
  const { meera, spaceId, abhiId } = await pair(browser, backend)
  for (let i = 1; i <= 40; i++) backend.addMessage(spaceId, abhiId, `history ${i}`)
  await meera.reload()
  await expect(list(meera).getByText('history 40', { exact: true })).toBeVisible()

  await meera.getByTestId('message-list').evaluate((el) => (el.scrollTop = 0))
  await meera.waitForTimeout(300)
  backend.addMessage(spaceId, abhiId, 'psst, new one')
  const pill = meera.getByRole('button', { name: 'New message' })
  await expect(pill).toBeVisible({ timeout: 5_000 })
  await pill.click()
  await expect(list(meera).getByText('psst, new one')).toBeInViewport()
})

test('when the other person leaves, history stays readable but sending stops', async ({
  browser,
}) => {
  test.setTimeout(90_000)
  const backend = new Backend()
  const { abhi, meera } = await pair(browser, backend)
  await send(abhi, 'Meera', 'remember this')
  await expect(list(meera).getByText('remember this')).toBeVisible({ timeout: 5_000 })

  await meera.getByRole('button', { name: 'Space options' }).click()
  await meera.getByRole('button', { name: 'Leave space' }).click()
  await meera
    .getByRole('dialog', { name: 'Leave this space?' })
    .getByRole('button', { name: 'Leave space' })
    .click()
  await expect(meera).toHaveURL(/\/home$/)

  await abhi.reload()
  await expect(list(abhi).getByText('remember this')).toBeVisible()
  await expect(abhi.getByText(/This space is closed, so no new messages can be sent/)).toBeVisible()
  await expect(abhi.getByRole('textbox', { name: 'Message Meera' })).toHaveCount(0)
})

async function expectNoSeriousA11y(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  const serious = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  expect(
    serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([])
}
