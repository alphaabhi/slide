import { describe, expect, it } from 'vitest'
import { mergeMessages, shouldSendOnKey, toRows, type Message, type OutboxItem } from './model'

const ME = 'me'
const THEM = 'them'
const msg = (n: number, sender: string, at: string, client = `c${n}`): Message => ({
  id: `id${n}`,
  space_id: 's',
  sender_id: sender,
  client_id: client,
  body: `m${n}`,
  created_at: at,
})

describe('mergeMessages', () => {
  it('orders by server time and drops duplicates (e.g. realtime + refetch)', () => {
    const a = msg(1, ME, '2026-11-06T10:00:00Z')
    const b = msg(2, THEM, '2026-11-06T10:01:00Z')
    const out = mergeMessages([b, a, b], [], ME)
    expect(out.map((m) => m.body)).toEqual(['m1', 'm2'])
    expect(out[0]!.status).toBe('sent')
    expect(out[1]!.status).toBeUndefined()
  })

  it('shows unconfirmed messages at the end, and hides them once the server has them', () => {
    const pending: OutboxItem = {
      clientId: 'cX',
      body: 'typing…',
      createdAt: '2026-11-06T09:00:00Z',
      status: 'sending',
    }
    const server = [msg(1, THEM, '2026-11-06T10:00:00Z')]
    expect(mergeMessages(server, [pending], ME).map((m) => [m.body, m.status])).toEqual([
      ['m1', undefined],
      ['typing…', 'sending'],
    ])
    const confirmed = [...server, msg(2, ME, '2026-11-06T10:02:00Z', 'cX')]
    const merged = mergeMessages(confirmed, [pending], ME)
    expect(merged).toHaveLength(2)
    expect(merged[1]).toMatchObject({ key: 'cX', status: 'sent' })
  })
})

describe('toRows', () => {
  const now = new Date('2026-11-06T12:00:00')
  it('adds day separators and marks the end of each run', () => {
    const list = mergeMessages(
      [
        msg(1, THEM, new Date('2026-11-05T22:00:00').toISOString()),
        msg(2, ME, new Date('2026-11-06T10:00:00').toISOString()),
        msg(3, ME, new Date('2026-11-06T10:01:00').toISOString()),
        msg(4, ME, new Date('2026-11-06T10:30:00').toISOString()),
      ],
      [],
      ME,
    )
    const rows = toRows(list, now)
    expect(
      rows.map((r) =>
        r.kind === 'day' ? r.label : `${r.message.body}${r.isLastInRun ? '*' : ''}`,
      ),
    ).toEqual(['Yesterday', 'm1*', 'Today', 'm2', 'm3*', 'm4*'])
  })
})

describe('shouldSendOnKey', () => {
  it('desktop: Enter sends, Shift+Enter does not', () => {
    expect(shouldSendOnKey({ key: 'Enter', shiftKey: false }, false)).toBe(true)
    expect(shouldSendOnKey({ key: 'Enter', shiftKey: true }, false)).toBe(false)
  })
  it('never sends while an input method is composing', () => {
    expect(shouldSendOnKey({ key: 'Enter', shiftKey: false, isComposing: true }, false)).toBe(false)
    expect(shouldSendOnKey({ key: 'Enter', shiftKey: false, keyCode: 229 }, false)).toBe(false)
  })
  it('touch screens: Enter makes a new line', () => {
    expect(shouldSendOnKey({ key: 'Enter', shiftKey: false }, true)).toBe(false)
  })
})
