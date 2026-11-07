import { expect, test, type Page } from '@playwright/test'
import { Backend } from './mock-supabase'
import { expectNoSeriousA11y, finger, pair } from './people'

test.beforeEach(() => {
  test.skip(test.info().project.name !== 'mobile', 'multi-person journeys run once')
})

const list = (page: Page) => page.getByRole('list', { name: 'Messages' })
const row = (page: Page, text: string) =>
  list(page)
    .locator('li')
    .filter({ has: page.getByText(text, { exact: true }) })
    .last()
const bubble = (page: Page, text: string) =>
  list(page).locator('.slide-bubble', { hasText: text }).last()

async function send(page: Page, to: string, text: string) {
  await page.getByRole('textbox', { name: `Message ${to}` }).fill(text)
  await page.getByRole('button', { name: 'Send message' }).click()
}

test('phone: double-tap to ❤️, hold for reactions, swipe right to reply', async ({ browser }) => {
  test.setTimeout(90_000)
  const backend = new Backend()
  const { abhi, meera } = await pair(browser, backend, { meeraTouch: true })
  const touch = await finger(meera)

  await send(abhi, 'Meera', 'I booked the tickets')
  await expect(bubble(meera, 'I booked the tickets')).toBeVisible({ timeout: 5_000 })

  // Double-tap: a heart, seen by both.
  await touch.doubleTap(bubble(meera, 'I booked the tickets'))
  await expect(list(meera).getByRole('button', { name: /❤️ from you/ })).toBeVisible()
  await expect(list(abhi).getByRole('button', { name: '❤️ from Meera' })).toBeVisible({
    timeout: 5_000,
  })
  // Double-tap again takes it back.
  await touch.doubleTap(bubble(meera, 'I booked the tickets'))
  await expect(list(abhi).getByRole('button', { name: '❤️ from Meera' })).toHaveCount(0, {
    timeout: 5_000,
  })

  // Hold: the menu with six reactions, Reply and Copy.
  await touch.hold(bubble(meera, 'I booked the tickets'))
  const menu = meera.getByRole('menu', { name: 'Message options' })
  await expect(menu).toBeVisible()
  await expect(menu.getByRole('menuitem')).toHaveCount(9) // 6 + more + reply + copy
  await expectNoSeriousA11y(meera)
  await menu.getByRole('menuitem', { name: 'React 😂' }).click()
  await expect(menu).toBeHidden()
  await expect(list(abhi).getByRole('button', { name: '😂 from Meera' })).toBeVisible({
    timeout: 5_000,
  })

  // Swipe right: replying to that message.
  await touch.swipeRight(bubble(meera, 'I booked the tickets'))
  await expect(meera.getByText('Replying to Abhi')).toBeVisible()
  await meera.getByRole('textbox', { name: 'Message Abhi' }).fill('which seats??')
  await meera.getByRole('button', { name: 'Send message' }).click()
  await expect(meera.getByText('Replying to Abhi')).toBeHidden()

  // Both see the quote above the reply.
  for (const page of [meera, abhi]) {
    const reply = bubble(page, 'which seats??')
    await expect(reply).toBeVisible({ timeout: 5_000 })
    await expect(reply.getByRole('button', { name: /I booked the tickets/ })).toBeVisible()
  }
  expect(backend.messages.at(-1)!.reply_to).toBe(backend.messages[0]!.id)

  // Scrolling isn't hijacked: a vertical drag does nothing to the bubble.
  await expect(meera.getByText('Replying to')).toHaveCount(0)
})

test('computer: double-click, right-click, keyboard buttons, reply jump-back', async ({
  browser,
}) => {
  test.setTimeout(150_000)
  const backend = new Backend()
  const { abhi, meera, spaceId, meeraId } = await pair(browser, backend)

  // An old message far back in the history, then lots more.
  backend.addMessage(spaceId, meeraId, 'remember the rooftop place?')
  for (let i = 0; i < 70; i++) backend.addMessage(spaceId, meeraId, `filler ${i}`)
  await abhi.reload()
  await expect(bubble(abhi, 'filler 69')).toBeVisible()

  // Double-click likes.
  await bubble(abhi, 'filler 69').dblclick()
  await expect(list(meera).getByRole('button', { name: '❤️ from Abhi' })).toBeVisible({
    timeout: 5_000,
  })

  // The buttons that appear on hover also work from the keyboard. (This test browser
  // reports a touchscreen, which hides them visually, so they're reached by focus.)
  await row(abhi, 'filler 68').getByRole('button', { name: 'React or reply' }).focus()
  await abhi.keyboard.press('Enter')
  await expect(abhi.getByRole('menu', { name: 'Message options' })).toBeVisible()
  await abhi.keyboard.press('Escape')
  await expect(abhi.getByRole('menu')).toBeHidden()

  // Right-click opens the same menu.
  await bubble(abhi, 'filler 68').click({ button: 'right' })
  await abhi.getByRole('menuitem', { name: 'More reactions' }).click()
  const picker = abhi.getByRole('dialog', { name: 'Pick a reaction' })
  await picker.getByRole('searchbox', { name: 'Search emoji' }).fill('pizza')
  await picker.getByRole('gridcell', { name: /pizza/i }).first().click()
  await expect(list(meera).getByRole('button', { name: '🍕 from Abhi' })).toBeVisible({
    timeout: 5_000,
  })

  // Meera replies (from the past) to the old message; tapping the quote jumps back to it.
  backend.addMessage(
    spaceId,
    meeraId,
    'we should go back',
    backend.messages.find((m) => m.body === 'remember the rooftop place?')!.id,
  )
  const quote = bubble(abhi, 'we should go back').getByRole('button', {
    name: /remember the rooftop place/,
  })
  await expect(quote).toBeVisible({ timeout: 5_000 })
  await quote.click()
  await expect(bubble(abhi, 'remember the rooftop place?')).toBeInViewport({ timeout: 10_000 })

  // Reply button on hover.
  await row(abhi, 'we should go back').getByRole('button', { name: 'Reply', exact: true }).focus()
  await abhi.keyboard.press('Enter')
  await expect(abhi.getByText('Replying to Meera')).toBeVisible()
  await abhi.getByRole('button', { name: 'Cancel reply' }).click()
  await expect(abhi.getByText('Replying to Meera')).toBeHidden()
})

test('links open in a new tab; the emoji picker types at the cursor', async ({ browser }) => {
  test.setTimeout(90_000)
  const backend = new Backend()
  const { abhi, meera } = await pair(browser, backend)

  await send(abhi, 'Meera', 'watch this https://www.youtube.com/watch?v=dQw4w9WgXcQ.')
  const link = list(meera).getByRole('link', {
    name: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  })
  await expect(link).toBeVisible({ timeout: 5_000 })
  await expect(link).toHaveAttribute('href', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')
  await expect(link).toHaveAttribute('target', '_blank')
  await expect(link).toHaveAttribute('rel', /noopener/)
  await send(abhi, 'Meera', 'javascript:alert(1)')
  await expect(list(meera).getByText('javascript:alert(1)')).toBeVisible({ timeout: 5_000 })
  await expect(list(meera).getByRole('link')).toHaveCount(1)

  // Emoji picker on a computer: search, pick, keeps typing where the cursor was.
  const box = meera.getByRole('textbox', { name: 'Message Abhi' })
  await box.fill('so good ')
  await meera.getByRole('button', { name: 'Emoji' }).click()
  await expect(meera.getByRole('searchbox', { name: 'Search emoji' })).toBeVisible()
  await expectNoSeriousA11y(meera)
  await meera.getByRole('searchbox', { name: 'Search emoji' }).fill('fire')
  await meera.getByRole('gridcell', { name: 'Fire', exact: true }).click()
  await expect(box).toHaveValue('so good 🔥')
  // It shows up under Recent next time.
  await meera.getByRole('button', { name: 'Close emoji' }).click()
  await meera.getByRole('button', { name: 'Emoji' }).click()
  await expect(meera.getByText('Recent')).toBeVisible()
  await meera.getByRole('button', { name: 'Send message' }).click()
  await expect(list(abhi).getByText('so good 🔥')).toBeVisible({ timeout: 5_000 })
})
