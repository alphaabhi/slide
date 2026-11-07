import AxeBuilder from '@axe-core/playwright'
import { expect, type Browser, type Locator, type Page } from '@playwright/test'
import { attachBackend, type Backend, VALID_CODE } from './mock-supabase'

/** A separate phone-sized browser for one person, on the shared test backend. */
export async function person(browser: Browser, backend: Backend, touch = false) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    ...(touch ? { hasTouch: true, isMobile: true } : {}),
  })
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
export async function pair(
  browser: Browser,
  backend: Backend,
  opts: { meeraTouch?: boolean } = {},
) {
  const abhi = await person(browser, backend)
  await abhi.goto('/sign-in')
  await signUp(abhi, 'abhi@example.com', 'Abhi')
  await abhi.getByRole('button', { name: 'New space' }).click()
  await abhi.getByRole('button', { name: 'Create space' }).click()
  const link = (await abhi.locator('text=/\\/i\\/[A-Za-z0-9_-]+/').first().innerText()).trim()

  const meera = await person(browser, backend, opts.meeraTouch)
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
  const r = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    // The emoji library numbers its first grid row 0 instead of 1 (a known quirk in
    // frimousse). Patching it on our side breaks its keyboard scrolling, so it's excluded.
    .exclude('[frimousse-list]')
    .analyze()
  const serious = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  expect(serious.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([])
}

/**
 * Real finger gestures (Chromium touch events → pointer events), for a page
 * opened with touch = true.
 */
export async function finger(page: Page) {
  const cdp = await page.context().newCDPSession(page)
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number, y: number) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x, y }],
    })
  const center = async (el: Locator) => {
    const b = (await el.boundingBox())!
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
  }
  return {
    async tap(el: Locator) {
      const { x, y } = await center(el)
      await touch('touchStart', x, y)
      await touch('touchEnd', x, y)
    },
    async doubleTap(el: Locator) {
      // All four events in one burst (queued in order), so a busy test machine
      // can't stretch the gap between the taps.
      const { x, y } = await center(el)
      await Promise.all([
        touch('touchStart', x, y),
        touch('touchEnd', x, y),
        touch('touchStart', x, y),
        touch('touchEnd', x, y),
      ])
    },
    async hold(el: Locator, ms = 650) {
      const { x, y } = await center(el)
      await touch('touchStart', x, y)
      await page.waitForTimeout(ms)
      await touch('touchEnd', x, y)
    },
    async swipeRight(el: Locator, distance = 110) {
      const { x, y } = await center(el)
      const startX = x - 40
      await touch('touchStart', startX, y)
      for (let i = 1; i <= 10; i++) {
        await touch('touchMove', startX + (distance * i) / 10, y + i * 0.5)
        await page.waitForTimeout(16)
      }
      await touch('touchEnd', startX + distance, y)
    },
  }
}
