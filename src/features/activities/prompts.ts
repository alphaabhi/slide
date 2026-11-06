/**
 * Prompts for SLIDE's games. Tone: playful, curious, a little cheeky; never
 * explicit, never mean. Keys are permanent (rounds store them to avoid repeats):
 * add new prompts with new keys, never renumber.
 */

export type GameKind = 'would_you_rather' | 'this_or_that' | 'question_of_the_day'

export interface ChoicePrompt {
  key: string
  prompt: string
  a: string
  b: string
}

export interface OpenPrompt {
  key: string
  prompt: string
}

export const GAMES: Record<GameKind, { title: string; blurb: string; emoji: string }> = {
  would_you_rather: {
    title: 'Would you rather',
    blurb: 'Two options, no fence-sitting.',
    emoji: '🤔',
  },
  this_or_that: {
    title: 'This or that',
    blurb: 'Quick picks. Trust your gut.',
    emoji: '⚡',
  },
  question_of_the_day: {
    title: 'Question of the day',
    blurb: 'One question a day. Answers unlock together.',
    emoji: '🌙',
  },
}

const wyr = (n: number, prompt: string, a: string, b: string): ChoicePrompt => ({
  key: `wyr-${n}`,
  prompt,
  a,
  b,
})

export const WOULD_YOU_RATHER: ChoicePrompt[] = [
  wyr(1, 'Would you rather…', 'Know what I’m thinking', 'Know what I’m about to say'),
  wyr(2, 'Would you rather…', 'A spontaneous midnight drive', 'A perfectly planned weekend away'),
  wyr(3, 'Would you rather…', 'Be the funny one', 'Be the mysterious one'),
  wyr(4, 'Would you rather…', 'Only communicate in voice notes', 'Only communicate in memes'),
  wyr(5, 'Would you rather…', 'Win every argument', 'Never need to have one'),
  wyr(6, 'Would you rather…', 'Have a chef’s cooking skills', 'Have a DJ’s taste in music'),
  wyr(7, 'Would you rather…', 'Relive your best day', 'Skip ahead to see your future'),
  wyr(
    8,
    'Would you rather…',
    'Be famous for something embarrassing',
    'Be unknown for something brilliant',
  ),
  wyr(9, 'Would you rather…', 'Read my texts before I send them', 'Hear my thoughts for one hour'),
  wyr(10, 'Would you rather…', 'Go on a date planned entirely by me', 'Plan one entirely for me'),
  wyr(11, 'Would you rather…', 'Lose your phone for a week', 'Lose your sense of taste for a week'),
  wyr(12, 'Would you rather…', 'Always be 10 minutes late', 'Always be 30 minutes early'),
  wyr(13, 'Would you rather…', 'Have a rewind button for life', 'Have a pause button for life'),
  wyr(14, 'Would you rather…', 'Be brutally honest', 'Be flawlessly charming'),
  wyr(15, 'Would you rather…', 'Live in the mountains', 'Live by the sea'),
  wyr(
    16,
    'Would you rather…',
    'Have the perfect comeback every time',
    'Always know when someone’s lying',
  ),
  wyr(17, 'Would you rather…', 'Slow dance in the kitchen', 'Sing badly in the car'),
  wyr(18, 'Would you rather…', 'Travel the world for a year', 'Get your dream home today'),
  wyr(19, 'Would you rather…', 'Be the one who texts first', 'Be the one who gets texted first'),
  wyr(20, 'Would you rather…', 'Have a secret talent', 'Have a secret admirer'),
  wyr(21, 'Would you rather…', 'Fight one horse-sized duck', 'Fight a hundred duck-sized horses'),
  wyr(22, 'Would you rather…', 'Give up chai forever', 'Give up dessert forever'),
  wyr(23, 'Would you rather…', 'A deep conversation at 3am', 'An adventure at 6am'),
  wyr(24, 'Would you rather…', 'Know every language', 'Play every instrument'),
  wyr(
    25,
    'Would you rather…',
    'Be stuck in a lift with your ex',
    'Be stuck in a lift with your boss',
  ),
]

const tot = (n: number, a: string, b: string): ChoicePrompt => ({
  key: `tot-${n}`,
  prompt: `${a} or ${b}?`,
  a,
  b,
})

export const THIS_OR_THAT: ChoicePrompt[] = [
  tot(1, 'Sunrise', '2am'),
  tot(2, 'Chai', 'Coffee'),
  tot(3, 'Beach', 'Mountains'),
  tot(4, 'Text', 'Call'),
  tot(5, 'Street food', 'Fine dining'),
  tot(6, 'Big party', 'Small group'),
  tot(7, 'Road trip', 'Flight'),
  tot(8, 'Cats', 'Dogs'),
  tot(9, 'Plans', 'Spontaneity'),
  tot(10, 'Netflix in bed', 'Night out'),
  tot(11, 'Sweet', 'Spicy'),
  tot(12, 'First move', 'Wait and see'),
  tot(13, 'Books', 'Podcasts'),
  tot(14, 'Rain', 'Sunshine'),
  tot(15, 'Old songs', 'New songs'),
  tot(16, 'Morning person', 'Night owl'),
  tot(17, 'Hugs', 'High fives'),
  tot(18, 'Biryani', 'Pizza'),
  tot(19, 'City lights', 'Starry sky'),
  tot(20, 'Overthink', 'Overshare'),
  tot(21, 'Flowers', 'Food'),
  tot(22, 'Early reply', 'Long reply'),
  tot(23, 'Dance floor', 'Bar corner'),
  tot(24, 'Window seat', 'Aisle seat'),
  tot(25, 'Cook together', 'Order in'),
]

const q = (n: number, prompt: string): OpenPrompt => ({ key: `qotd-${n}`, prompt })

export const QUESTIONS_OF_THE_DAY: OpenPrompt[] = [
  q(1, 'What’s something small that instantly makes your day better?'),
  q(2, 'What’s a memory you’d happily relive, exactly as it happened?'),
  q(3, 'What’s the most underrated quality a person can have?'),
  q(4, 'What’s something you changed your mind about recently?'),
  q(5, 'If today had a soundtrack, what song would be playing?'),
  q(6, 'What’s a place you’ve never been but feel strangely drawn to?'),
  q(7, 'What’s the best advice you’ve ever ignored?'),
  q(8, 'What would your friends say is your most chaotic trait?'),
  q(9, 'What’s one thing on your bucket list you’ve never told anyone?'),
  q(10, 'What does a perfect lazy Sunday look like for you?'),
  q(11, 'What’s a tiny gesture that means a lot to you?'),
  q(12, 'What’s the last thing that made you laugh until it hurt?'),
  q(13, 'What’s something you’re proud of that nobody really noticed?'),
  q(14, 'If you could master one skill overnight, what would it be?'),
  q(15, 'What’s a first impression you got completely wrong?'),
  q(16, 'What’s a smell that instantly takes you back somewhere?'),
  q(17, 'What’s the bravest thing you’ve done this year?'),
  q(18, 'What’s your comfort film, and why that one?'),
  q(19, 'What do you wish people asked you about more often?'),
  q(20, 'What’s a rule you live by that you made up yourself?'),
  q(21, 'What’s the most spontaneous plan you’d say yes to right now?'),
  q(22, 'What’s something you’re looking forward to this month?'),
  q(23, 'What’s a song you could listen to on repeat forever?'),
  q(24, 'Describe your ideal evening in three words.'),
  q(25, 'What’s a question you wish I’d ask you?'),
]

export function promptsFor(kind: GameKind): (ChoicePrompt | OpenPrompt)[] {
  if (kind === 'would_you_rather') return WOULD_YOU_RATHER
  if (kind === 'this_or_that') return THIS_OR_THAT
  return QUESTIONS_OF_THE_DAY
}

/**
 * The next prompt for a space: one it hasn't played yet, picked at random.
 * When every prompt has been played, starts again but still avoids the most
 * recent ones, so nothing repeats within a short session.
 */
export function pickPrompt<T extends { key: string }>(
  list: T[],
  playedNewestFirst: string[],
  random: () => number = Math.random,
): T {
  const played = new Set(playedNewestFirst)
  let pool = list.filter((p) => !played.has(p.key))
  if (pool.length === 0) {
    const recent = new Set(playedNewestFirst.slice(0, Math.floor(list.length / 2)))
    pool = list.filter((p) => !recent.has(p.key))
  }
  if (pool.length === 0) pool = list
  return pool[Math.floor(random() * pool.length) % pool.length]!
}
