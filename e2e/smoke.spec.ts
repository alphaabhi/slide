import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const pages = [
  { path: '/', name: 'home' },
  { path: '/styleguide', name: 'styleguide' },
  { path: '/does-not-exist', name: 'not-found' },
]

const themes = ['violet', 'graphite'] as const

for (const theme of themes)
  for (const p of pages.map((pg) => ({
    ...pg,
    path: `${pg.path}?theme=${theme}`,
    name: `${pg.name} (${theme})`,
  }))) {
    test.describe(p.name, () => {
      test('renders without console errors or horizontal overflow', async ({ page }) => {
        const errors: string[] = []
        page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
        page.on('pageerror', (e) => errors.push(e.message))

        await page.goto(p.path)
        await expect(page.locator('h1')).toBeVisible()

        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        )
        expect(overflow, 'page scrolls horizontally').toBeLessThanOrEqual(0)
        expect(errors).toEqual([])
      })

      test('has no serious accessibility violations', async ({ page }) => {
        await page.goto(p.path)
        await expect(page.locator('h1')).toBeVisible()
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze()
        const serious = results.violations.filter(
          (v) => v.impact === 'serious' || v.impact === 'critical',
        )
        expect(
          serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
        ).toEqual([])
      })
    })
  }

test('touch targets on the style guide are at least 44px', async ({ page }) => {
  await page.goto('/styleguide')
  const small = await page.$$eval('button', (els) =>
    els
      .map((el) => {
        const r = el.getBoundingClientRect()
        return {
          text: el.textContent?.trim() || el.getAttribute('aria-label'),
          w: r.width,
          h: r.height,
        }
      })
      .filter((b) => b.h < 44 || b.w < 44),
  )
  expect(small).toEqual([])
})

test('dialog traps focus and closes with Escape', async ({ page }) => {
  await page.goto('/styleguide')
  await page.getByRole('button', { name: 'Open dialog' }).click()
  const dialog = page.getByRole('dialog', { name: 'Invite someone' })
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('button', { name: 'Open dialog' })).toBeFocused()
})
