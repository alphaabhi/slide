import { expect, test, type Page } from '@playwright/test'
import { Backend } from './mock-supabase'
import { expectNoSeriousA11y, pair } from './people'

test.beforeEach(() => {
  test.skip(test.info().project.name !== 'mobile', 'multi-person journeys run once')
})

async function play(page: Page, game: string) {
  await page.getByRole('button', { name: 'Play a game' }).click()
  await page
    .getByRole('dialog', { name: 'Play something' })
    .getByRole('button', { name: game })
    .click()
  await expect(page.getByRole('dialog', { name: 'Play something' })).toBeHidden()
}

const card = (page: Page, game: string) => page.getByRole('region', { name: game }).last()

test('this or that: picks stay hidden until both choose, then reveal for both', async ({
  browser,
}) => {
  test.setTimeout(90_000)
  const backend = new Backend()
  const { abhi, meera } = await pair(browser, backend)

  // Abhi starts a game from the Play sheet; it appears for both.
  await abhi.getByRole('button', { name: 'Play a game' }).click()
  await expect(abhi.getByRole('dialog', { name: 'Play something' })).toBeVisible()
  await expectNoSeriousA11y(abhi)
  await abhi.getByRole('button', { name: /This or that/ }).click()

  const abhiCard = card(abhi, 'This or that')
  const meeraCard = card(meera, 'This or that')
  await expect(abhiCard).toBeVisible()
  await expect(meeraCard).toBeVisible({ timeout: 5_000 })
  await expect(meeraCard.getByText('Abhi started this')).toBeVisible()
  await expectNoSeriousA11y(meera)

  // Abhi picks. Meera learns that he picked, not what.
  const options = abhiCard.getByRole('group', { name: 'Choices' }).getByRole('button')
  const first = (await options.first().innerText()).trim()
  await options.first().click()
  await expect(abhiCard.getByText('Waiting for Meera to choose')).toBeVisible()
  await expect(meeraCard.getByText('Abhi has chosen. Your turn.')).toBeVisible({ timeout: 5_000 })
  await expect(meeraCard.getByText('Abhi', { exact: true })).toHaveCount(0)

  // Meera picks the other option; both see both picks.
  await meeraCard.getByRole('group', { name: 'Choices' }).getByRole('button').last().click()
  for (const c of [abhiCard, meeraCard]) {
    await expect(c.getByText('Different picks. Discuss.')).toBeVisible({ timeout: 5_000 })
    await expect(c.getByText('Abhi', { exact: true })).toBeVisible()
    await expect(c.getByText('Meera', { exact: true })).toBeVisible()
  }
  await expect(abhiCard.getByRole('button', { name: new RegExp(first) })).toHaveAttribute(
    'aria-pressed',
    'true',
  )

  // "Another one" starts a fresh round with a different prompt.
  await abhiCard.getByRole('button', { name: 'Another one' }).click()
  await expect(abhi.getByRole('region', { name: 'This or that' })).toHaveCount(2)
  await expect(meera.getByRole('region', { name: 'This or that' })).toHaveCount(2, {
    timeout: 5_000,
  })
  const prompts = backend.rounds.map((r) => r.prompt_key)
  expect(new Set(prompts).size).toBe(2)

  // An untitled space is named "You & Meera" once, not twice.
  await expect(abhi.getByRole('heading', { name: 'You & Meera' })).toBeVisible()
  await expect(abhi.getByText('Private · just the two of you')).toBeVisible()
  await expect(abhi.getByText('You & Meera', { exact: true })).toHaveCount(1)

  // History survives a refresh, still revealed.
  await meera.reload()
  await expect(
    meera
      .getByRole('region', { name: 'This or that' })
      .first()
      .getByText('Different picks. Discuss.'),
  ).toBeVisible()
})

test('question of the day: written answers unlock together, once a day', async ({ browser }) => {
  test.setTimeout(90_000)
  const backend = new Backend()
  const { abhi, meera } = await pair(browser, backend)

  await play(meera, 'Question of the day')
  const meeraCard = card(meera, 'Question of the day')
  const abhiCard = card(abhi, 'Question of the day')
  await expect(abhiCard).toBeVisible({ timeout: 5_000 })

  await abhiCard.getByLabel('Your answer').fill('Kyoto, in the rain')
  await abhiCard.getByRole('button', { name: 'Answer' }).click()
  await expect(abhiCard.getByText('Waiting for Meera to answer')).toBeVisible()
  await expect(meeraCard.getByText('Abhi has answered. Your turn.')).toBeVisible({ timeout: 5_000 })
  await expect(meera.getByText('Kyoto, in the rain')).toHaveCount(0)
  await expectNoSeriousA11y(meera)

  await meeraCard.getByLabel('Your answer').fill('Goa, obviously 🌊')
  await meeraCard.getByRole('button', { name: 'Answer' }).click()
  for (const c of [abhiCard, meeraCard]) {
    await expect(c.getByText('Kyoto, in the rain')).toBeVisible({ timeout: 5_000 })
    await expect(c.getByText('Goa, obviously 🌊')).toBeVisible()
  }

  // Asking for another today brings back today's instead of a new one.
  await abhi.getByRole('button', { name: 'Play a game' }).click()
  await expect(abhi.getByText('Today’s is in the chat')).toBeVisible()
  await abhi
    .getByRole('dialog')
    .getByRole('button', { name: /Question of the day/ })
    .click()
  await expect(abhi.getByRole('region', { name: 'Question of the day' })).toHaveCount(1)
  expect(backend.rounds).toHaveLength(1)
})

test('skip, the "your turn" strip, and reveals arriving while the live connection is down', async ({
  browser,
}) => {
  test.setTimeout(90_000)
  const backend = new Backend()
  const { abhi, meera, spaceId, abhiId } = await pair(browser, backend)

  // Meera skips a game Abhi started; both see it was skipped.
  await play(abhi, 'Would you rather')
  const meeraWyr = card(meera, 'Would you rather')
  await expect(meeraWyr).toBeVisible({ timeout: 5_000 })
  await meeraWyr.getByRole('button', { name: 'Skip' }).click()
  await expect(meera.getByText(/You skipped would you rather/)).toBeVisible()
  await expect(abhi.getByText(/Meera skipped would you rather/)).toBeVisible({ timeout: 5_000 })

  // A new game scrolls out of view under a burst of messages: the strip brings Meera back.
  await play(abhi, 'This or that')
  await expect(card(meera, 'This or that')).toBeVisible({ timeout: 5_000 })
  for (let i = 0; i < 14; i++) backend.addMessage(spaceId, abhiId, `message ${i}`)
  const strip = meera.getByRole('button', { name: /Abhi started this or that · your turn/ })
  await expect(strip).toBeVisible({ timeout: 5_000 })
  await strip.click()
  await expect(card(meera, 'This or that')).toBeInViewport()
  await expect(strip).toBeHidden()

  // Live updates drop; the reveal still reaches Abhi through the fallback.
  await card(abhi, 'This or that')
    .getByRole('group', { name: 'Choices' })
    .getByRole('button')
    .first()
    .click()
  backend.dropLive()
  await card(meera, 'This or that')
    .getByRole('group', { name: 'Choices' })
    .getByRole('button')
    .first()
    .click()
  await expect(card(abhi, 'This or that').getByText('Same pick. Interesting… ✨')).toBeVisible({
    timeout: 15_000,
  })
  backend.restoreLive()
})

test('no games once the other person has left', async ({ browser }) => {
  test.setTimeout(90_000)
  const backend = new Backend()
  const { abhi, meera } = await pair(browser, backend)
  await play(abhi, 'This or that')
  await expect(card(meera, 'This or that')).toBeVisible({ timeout: 5_000 })

  await meera.getByRole('button', { name: 'Space options' }).click()
  await meera.getByRole('button', { name: 'Leave space' }).click()
  await meera
    .getByRole('dialog', { name: 'Leave this space?' })
    .getByRole('button', { name: 'Leave space' })
    .click()
  await expect(meera).toHaveURL(/\/home/)

  await abhi.reload()
  await expect(abhi.getByRole('button', { name: 'Play a game' })).toHaveCount(0)
  const abhiCard = card(abhi, 'This or that')
  await expect(abhiCard).toBeVisible()
  await expect(abhiCard.getByRole('button', { name: 'Skip' })).toHaveCount(0)
  for (const b of await abhiCard
    .getByRole('group', { name: 'Choices' })
    .getByRole('button')
    .all()) {
    await expect(b).toBeDisabled()
  }
})
