import { describe, expect, it } from 'vitest'
import { pickStarters, STARTERS } from './starters'

describe('pickStarters', () => {
  it('gives three different starters from the list', () => {
    const s = pickStarters('3f0e2a7c-0000-4000-8000-000000000001')
    expect(s).toHaveLength(3)
    expect(new Set(s).size).toBe(3)
    for (const q of s) expect(STARTERS).toContain(q)
  })

  it('is the same for the same space, so both people see the same ones', () => {
    expect(pickStarters('space-a')).toEqual(pickStarters('space-a'))
  })

  it('varies between spaces and uses the whole list', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 300; i++) pickStarters(`space-${i}`).forEach((q) => seen.add(q))
    expect(seen.size).toBe(STARTERS.length)
    expect(pickStarters('space-1')).not.toEqual(pickStarters('space-2'))
  })
})
