import { describe, expect, it } from 'vitest'
import { pickPrompt, QUESTIONS_OF_THE_DAY, THIS_OR_THAT, WOULD_YOU_RATHER } from './prompts'

const all = [...WOULD_YOU_RATHER, ...THIS_OR_THAT, ...QUESTIONS_OF_THE_DAY]

describe('prompt lists', () => {
  it('keys are unique and fit the database rules', () => {
    const keys = all.map((p) => p.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const k of keys) expect(k).toMatch(/^[a-z0-9-]{1,40}$/)
  })

  it('texts fit the database limits', () => {
    for (const p of all) expect(p.prompt.length).toBeLessThanOrEqual(200)
    for (const p of [...WOULD_YOU_RATHER, ...THIS_OR_THAT]) {
      expect(p.a.length).toBeLessThanOrEqual(80)
      expect(p.b.length).toBeLessThanOrEqual(80)
      expect(p.a).not.toBe(p.b)
    }
  })
})

describe('pickPrompt', () => {
  it('never repeats until every prompt has been played', () => {
    const played: string[] = []
    for (let i = 0; i < THIS_OR_THAT.length; i++) {
      played.unshift(pickPrompt(THIS_OR_THAT, played).key)
    }
    expect(new Set(played).size).toBe(THIS_OR_THAT.length)
  })

  it('after a full cycle, still avoids the most recent half', () => {
    const played = THIS_OR_THAT.map((p) => p.key) // newest first
    for (let i = 0; i < 50; i++) {
      const next = pickPrompt(THIS_OR_THAT, played)
      expect(played.slice(0, Math.floor(THIS_OR_THAT.length / 2))).not.toContain(next.key)
    }
  })
})
