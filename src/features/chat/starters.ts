/**
 * Conversation starters for an empty space. Tone: playful, curious, a little
 * cheeky; never explicit. Each space gets its own three, chosen from its id, so
 * both people see the same ones and they don't reshuffle on refresh.
 */
export const STARTERS = [
  'What’s something you’ve always wanted to do but need the right partner in crime for?',
  'What’s more seductive: a brilliant mind, effortless confidence or wicked humour?',
  'What’s your most dangerously charming quality?',
  'What’s a green flag that instantly makes you more interested in someone?',
  'What’s the most spontaneous thing you’ve ever done, and would you do it again?',
  'What’s a hill you’re fully prepared to die on?',
  'What do people usually get wrong about you at first?',
  'What’s your idea of a perfect first date that isn’t dinner and a movie?',
  'What’s the best compliment you’ve ever received and secretly still think about?',
  'Which of your opinions would start an argument at a dinner party?',
  'What’s one thing you’re irrationally competitive about?',
  'If we planned a trip tomorrow, where are we going and who’s in charge?',
  'What’s a small thing someone could do that would completely win you over?',
  'What’s your guilty-pleasure song that you’d never admit to on a first date?',
  'What’s the most “main character” moment of your life so far?',
  'What’s something you’re weirdly good at that nobody would guess?',
  'Truthfully: what made you swipe right, or say yes to this?',
  'What’s a risk you took that completely paid off?',
] as const

/** A stable, well-spread number from a string (FNV-1a). */
function hash(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Three different starters for this space; always the same three for the same id. */
export function pickStarters(seed: string, count = 3): string[] {
  const pool = [...STARTERS]
  let h = hash(seed)
  const picked: string[] = []
  while (picked.length < Math.min(count, pool.length)) {
    const i = h % pool.length
    picked.push(pool.splice(i, 1)[0]!)
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0 || 1
  }
  return picked
}
