import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Browser, type Page } from '@playwright/test'
import { attachBackend, Backend, VALID_CODE } from './mock-supabase'

async function person(browser: Browser, backend: Backend) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  await attachBackend(page, backend)
  return page
}

async function signIn(page: Page, email: string) {
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Email me a code' }).click()
  await page.getByLabel('Sign-in code').fill(VALID_CODE)
}

async function expectNoSeriousA11y(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  const serious = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  expect(serious.map((v) => v.id)).toEqual([])
}

const avatarImg = (page: Page, key: string) => page.locator(`img[src="/avatars/${key}.svg"]`)

/** Text the page shows outside the avatar picker. */
async function visibleTextOutsidePicker(page: Page) {
  return page.evaluate(() => {
    const clone = document.body.cloneNode(true) as HTMLElement
    clone.querySelectorAll('[role="radiogroup"]').forEach((n) => n.remove())
    return clone.innerText
  })
}

test.beforeEach(() => {
  test.skip(test.info().project.name !== 'mobile', 'multi-person journeys run once')
})

test('avatars: chosen at sign-up, seen by the other person, changeable, names stay in the picker', async ({
  browser,
}) => {
  test.setTimeout(90_000)
  const backend = new Backend()

  // Abhi signs up and picks an avatar.
  const abhi = await person(browser, backend)
  await abhi.goto('/sign-in')
  await signIn(abhi, 'abhi@example.com')
  await abhi.getByLabel('Display name').fill('Abhi')
  const picker = abhi.getByRole('radiogroup', { name: 'Avatar' })
  await expect(picker.getByRole('radio', { name: 'Just my initial' })).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await expectNoSeriousA11y(abhi)
  await picker.getByRole('radio', { name: 'Kai' }).click()
  await expect(picker.getByRole('radio', { name: 'Kai' })).toHaveAttribute('aria-checked', 'true')
  await abhi.getByRole('button', { name: 'Continue' }).click()

  await expect(abhi.getByRole('heading', { name: 'Hi, Abhi' })).toBeVisible()
  expect(backend.avatars.get(backend.usersByEmail.get('abhi@example.com')!)).toBe('kai')
  await expect(avatarImg(abhi, 'kai').first()).toBeVisible()
  // The character's name is never shown as if it were his name.
  expect(await visibleTextOutsidePicker(abhi)).not.toMatch(/\bKai\b/)

  // Abhi invites Meera, who keeps her initial.
  await abhi.getByRole('button', { name: 'New space' }).click()
  await abhi.getByRole('button', { name: 'Create space' }).click()
  const link = (await abhi.locator('text=/\\/i\\/[A-Za-z0-9_-]+/').first().innerText()).trim()

  const meera = await person(browser, backend)
  await meera.goto(link)
  // The invite shows Abhi's avatar, with his own name.
  await expect(avatarImg(meera, 'kai')).toBeVisible()
  await expect(meera.getByText(/Abhi wants to take the conversation/)).toBeVisible()
  await meera.getByRole('link', { name: 'Sign in to join' }).click()
  await signIn(meera, 'meera@example.com')
  await meera.getByLabel('Display name').fill('Meera')
  await meera.getByRole('button', { name: 'Continue' }).click()
  await meera.getByRole('button', { name: 'Join Abhi' }).click()

  // Inside the chat, Meera sees Abhi's avatar; "Kai" appears nowhere.
  await expect(meera.getByRole('textbox', { name: 'Message Abhi' })).toBeVisible()
  await expect(avatarImg(meera, 'kai')).toBeVisible()
  expect(await visibleTextOutsidePicker(meera)).not.toMatch(/\bKai\b/)

  // Each message has its sender's picture beside it: Abhi's avatar, Meera's initial.
  const spaceId = [...backend.spaces.keys()][0]!
  backend.addMessage(spaceId, backend.usersByEmail.get('abhi@example.com')!, 'hey you')
  await meera.getByRole('textbox', { name: 'Message Abhi' }).fill('hi!')
  await meera.getByRole('button', { name: 'Send message' }).click()
  const messages = meera.getByRole('list', { name: 'Messages' })
  await expect(messages.getByText('hey you')).toBeVisible()
  await expect(messages.getByText('Sent')).toBeVisible()
  await expect(messages.locator('img[src="/avatars/kai.svg"]')).toHaveCount(1)
  await expect(
    messages.locator('li', { hasText: 'hi!' }).getByText('M', { exact: true }),
  ).toBeVisible()

  // Abhi changes his avatar from home; Meera's list shows the new one.
  await abhi.goto('/home')
  await abhi.getByRole('button', { name: 'Edit' }).click()
  const dialog = abhi.getByRole('dialog', { name: 'Edit profile' })
  await expect(dialog.getByRole('radio', { name: 'Kai' })).toHaveAttribute('aria-checked', 'true')
  await expectNoSeriousA11y(abhi)
  await dialog.getByRole('radio', { name: 'Yuna' }).click()
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(abhi.getByText('Profile updated', { exact: true })).toBeVisible()
  await expect(avatarImg(abhi, 'yuna').first()).toBeVisible()

  await meera.goto('/home')
  await expect(avatarImg(meera, 'yuna')).toBeVisible()
  await expect(avatarImg(meera, 'kai')).toHaveCount(0)

  // Going back to just the initial works too.
  await abhi.getByRole('button', { name: 'Edit' }).click()
  await dialog.getByRole('radio', { name: 'Just my initial' }).click()
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog).toBeHidden()
  expect(backend.avatars.get(backend.usersByEmail.get('abhi@example.com')!)).toBeNull()
  await expect(abhi.locator('img[src^="/avatars/"]')).toHaveCount(0)
})
