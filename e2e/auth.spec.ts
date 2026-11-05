import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { mockSupabase, VALID_CODE } from './mock-supabase'

async function signIn(page: Page, code = VALID_CODE) {
  await page.getByLabel('Email').fill('abhi@example.com')
  await page.getByRole('button', { name: 'Email me a code' }).click()
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible()
  // The 6th digit signs in automatically; no button press.
  await page.getByLabel('Sign-in code').fill(code)
}

async function expectNoSeriousA11y(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  const serious = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  expect(serious.map((v) => v.id)).toEqual([])
}

test('new user: get started → email code → choose name → home → sign out', async ({ page }) => {
  const mock = await mockSupabase(page)
  await page.goto('/')
  await page.getByRole('link', { name: 'Get started' }).click()
  await expect(page.getByRole('heading', { name: 'Sign in to SLIDE' })).toBeVisible()
  await expectNoSeriousA11y(page)

  await signIn(page)
  expect(mock.codesSent).toBe(1)

  await expect(page.getByRole('heading', { name: 'What should we call you?' })).toBeVisible()
  await expectNoSeriousA11y(page)
  await page.getByLabel('Display name').fill('   Abhi   ')
  await page.getByRole('button', { name: 'Continue' }).click()

  await expect(page.getByRole('heading', { name: 'Hi, Abhi' })).toBeVisible()
  await expect(page.getByText('abhi@example.com')).toBeVisible()
  expect(mock.profile?.display_name).toBe('Abhi')
  await expectNoSeriousA11y(page)

  // Session survives a refresh.
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Hi, Abhi' })).toBeVisible()

  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByText('Signed out', { exact: true })).toBeVisible()

  // Protected pages now send you to sign in, remembering where you were going.
  await page.goto('/home')
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fhome/)
})

test('returning user skips onboarding', async ({ page }) => {
  await mockSupabase(page, {
    profile: { display_name: 'Meera' },
  })
  await page.goto('/home')
  await expect(page).toHaveURL(/sign-in/)
  await signIn(page)
  await expect(page.getByRole('heading', { name: 'Hi, Meera' })).toBeVisible()
})

test('wrong code shows a clear error and lets you retry', async ({ page }) => {
  await mockSupabase(page)
  await page.goto('/sign-in')
  await signIn(page, '000000')
  await expect(page.getByText('That code is wrong or has expired')).toBeVisible()
  await page.getByLabel('Sign-in code').fill(VALID_CODE)
  await expect(page.getByRole('heading', { name: 'What should we call you?' })).toBeVisible()
})

test('code boxes: pasting a whole message signs in; short codes wait', async ({ page }) => {
  await mockSupabase(page)
  await page.goto('/sign-in')
  await page.getByLabel('Email').fill('abhi@example.com')
  await page.getByRole('button', { name: 'Email me a code' }).click()
  const code = page.getByLabel('Sign-in code')
  await code.fill('4242')
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible()
  await expect(code).toHaveValue('4242')
  // Pasting "Code: 424 242" keeps only the digits and completes sign-in.
  await code.fill('Code: 424 242')
  await expect(page.getByRole('heading', { name: 'What should we call you?' })).toBeVisible()
})

test('validation and rate-limit errors are explained', async ({ page }) => {
  await mockSupabase(page, { failNextSend: 'rate_limit' })
  await page.goto('/sign-in')
  await page.getByRole('button', { name: 'Email me a code' }).click()
  await expect(page.getByText('Enter your email address.')).toBeVisible()
  await page.getByLabel('Email').fill('abhi@example.com')
  await page.getByRole('button', { name: 'Email me a code' }).click()
  await expect(page.getByText('Too many attempts')).toBeVisible()
})

test('resend is disabled during the cooldown', async ({ page }) => {
  await mockSupabase(page)
  await page.goto('/sign-in')
  await page.getByLabel('Email').fill('abhi@example.com')
  await page.getByRole('button', { name: 'Email me a code' }).click()
  await expect(page.getByRole('button', { name: /Send a new code in \d+s/ })).toBeDisabled()
  await page.getByRole('button', { name: 'Use a different email' }).click()
  await expect(page.getByLabel('Email')).toBeVisible()
})

test('rename from home', async ({ page }) => {
  await mockSupabase(page)
  await page.goto('/sign-in')
  await signIn(page)
  await page.getByLabel('Display name').fill('Abhi')
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Edit' }).click()
  const dialog = page.getByRole('dialog', { name: 'Change your name' })
  await dialog.getByLabel('Display name').fill('Abhinav')
  await dialog.getByRole('button', { name: 'Save name' }).click()
  await expect(page.getByRole('heading', { name: 'Hi, Abhinav' })).toBeVisible()
  await expect(dialog).toBeHidden()
})

test('external redirect targets are ignored', async ({ page }) => {
  await mockSupabase(page, {
    profile: { display_name: 'Meera' },
  })
  await page.goto('/sign-in?next=//evil.example.com')
  await signIn(page)
  await expect(page).toHaveURL(/\/home$/)
})

test('an address the email service refuses gets an honest message, not "check your connection"', async ({
  page,
}) => {
  await mockSupabase(page, { failNextSend: 'email_refused' })
  await page.goto('/sign-in')
  await page.getByLabel('Email').fill('friend@example.com')
  await page.getByRole('button', { name: 'Email me a code' }).click()
  await expect(page.getByText('We couldn’t send a code to that address')).toBeVisible()
  await expect(page.getByText(/Check your connection/)).toHaveCount(0)
})
