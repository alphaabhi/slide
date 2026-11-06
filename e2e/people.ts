import AxeBuilder from '@axe-core/playwright'
import { expect, type Browser, type Page } from '@playwright/test'
import { attachBackend, type Backend, VALID_CODE } from './mock-supabase'

/** A separate phone-sized browser for one person, on the shared test backend. */
export async function person(browser: Browser, backend: Backend) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
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

/** Abhi creates a space, Meera joins. Both end up inside the chat. */
export async function pair(browser: Browser, backend: Backend) {
  const abhi = await person(browser, backend)
  await abhi.goto('/sign-in')
  await signUp(abhi, 'abhi@example.com', 'Abhi')
  await abhi.getByRole('button', { name: 'New space' }).click()
  await abhi.getByRole('button', { name: 'Create space' }).click()
  const link = (await abhi.locator('text=/\\/i\\/[A-Za-z0-9_-]+/').first().innerText()).trim()

  const meera = await person(browser, backend)
  await meera.goto(link)
  await meera.getByRole('link', { name: 'Sign in to join' }).click()
  await signUp(meera, 'meera@example.com', 'Meera')
  await meera.getByRole('button', { name: 'Join Abhi' }).click()

  await expect(meera.getByRole('textbox', { name: 'Message Abhi' })).toBeVisible()
  await expect(abhi.getByRole('textbox', { name: 'Message Meera' })).toBeVisible({
    timeout: 15_000,
  })
  return {
    abhi,
    meera,
    spaceId: [...backend.spaces.keys()][0]!,
    abhiId: backend.usersByEmail.get('abhi@example.com')!,
    meeraId: backend.usersByEmail.get('meera@example.com')!,
  }
}

export async function expectNoSeriousA11y(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  const serious = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  expect(serious.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([])
}
