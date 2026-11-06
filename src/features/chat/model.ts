/**
 * Pure chat logic (no React, no network) so it can be unit-tested directly.
 */

export interface Message {
  id: string
  space_id: string
  sender_id: string
  client_id: string
  body: string
  created_at: string
}

export type OutboxStatus = 'sending' | 'failed'

/** A message typed on this device that the server hasn't confirmed yet. */
export interface OutboxItem {
  clientId: string
  body: string
  createdAt: string
  status: OutboxStatus
  /** Plain-language reason, for failures the person can't fix by retrying. */
  error?: string
}

export interface ChatMessage {
  key: string
  mine: boolean
  body: string
  createdAt: string
  status?: 'sending' | 'sent' | 'failed'
  error?: string
  clientId: string
}

/** Server messages (any order, possibly duplicated) + unconfirmed local ones → one ordered list. */
export function mergeMessages(
  server: Message[],
  outbox: OutboxItem[],
  myId: string,
): ChatMessage[] {
  const seen = new Set<string>()
  const confirmed: ChatMessage[] = []
  for (const m of server) {
    if (seen.has(m.client_id)) continue
    seen.add(m.client_id)
    confirmed.push({
      // Keyed by client id so a bubble keeps its identity from "sending" to "sent" (no flicker).
      key: m.client_id,
      mine: m.sender_id === myId,
      body: m.body,
      createdAt: m.created_at,
      status: m.sender_id === myId ? 'sent' : undefined,
      clientId: m.client_id,
    })
  }
  confirmed.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.key.localeCompare(b.key))
  const pending = outbox
    .filter((o) => !seen.has(o.clientId))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map<ChatMessage>((o) => ({
      key: o.clientId,
      mine: true,
      body: o.body,
      createdAt: o.createdAt,
      status: o.status,
      error: o.error,
      clientId: o.clientId,
    }))
  // Unconfirmed messages always sit at the end, where the person just typed them.
  return [...confirmed, ...pending]
}

export type ChatRow =
  | { kind: 'day'; key: string; label: string }
  | { kind: 'message'; key: string; message: ChatMessage; isLastInRun: boolean }
  | { kind: 'extra'; key: string; id: string }

/** Something other than a message that sits in the timeline (e.g. a game card). */
export interface TimelineExtra {
  id: string
  createdAt: string
  /** Started by me: the list scrolls to it like my own message. */
  mine?: boolean
  /** Changes when its content changes size (e.g. answered, revealed). */
  version?: string
}

const RUN_GAP_MS = 5 * 60 * 1000

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

export function dayLabel(date: Date, now = new Date()): string {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const that = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const days = Math.round((today.getTime() - that.getTime()) / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return date.toLocaleDateString(undefined, { weekday: 'long' })
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  })
}

/**
 * Adds day separators and marks the last bubble of each run (same sender,
 * same day, under 5 minutes apart) — that one gets the tail and the time.
 * Extras (game cards) are placed by time among confirmed messages and break runs.
 * Unconfirmed messages always stay at the very end, where they were typed.
 */
export function toRows(
  messages: ChatMessage[],
  now = new Date(),
  extras: TimelineExtra[] = [],
): ChatRow[] {
  type Item = { t: 'm'; m: ChatMessage } | { t: 'x'; x: TimelineExtra }
  const confirmed = messages.filter((m) => m.status !== 'sending' && m.status !== 'failed')
  const pending = messages.filter((m) => m.status === 'sending' || m.status === 'failed')
  const sortedExtras = [...extras].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const items: Item[] = []
  let xi = 0
  for (const m of confirmed) {
    while (xi < sortedExtras.length && sortedExtras[xi]!.createdAt <= m.createdAt) {
      items.push({ t: 'x', x: sortedExtras[xi++]! })
    }
    items.push({ t: 'm', m })
  }
  while (xi < sortedExtras.length) items.push({ t: 'x', x: sortedExtras[xi++]! })
  for (const m of pending) items.push({ t: 'm', m })

  const rows: ChatRow[] = []
  let lastDay = ''
  items.forEach((item, i) => {
    const created = item.t === 'm' ? item.m.createdAt : item.x.createdAt
    const d = new Date(created)
    const k = dayKey(d)
    if (k !== lastDay) {
      rows.push({ kind: 'day', key: `day-${k}`, label: dayLabel(d, now) })
      lastDay = k
    }
    if (item.t === 'x') {
      rows.push({ kind: 'extra', key: `x-${item.x.id}`, id: item.x.id })
      return
    }
    const m = item.m
    const next = items[i + 1]
    const nextMsg = next?.t === 'm' ? next.m : undefined
    const isLastInRun =
      !nextMsg ||
      nextMsg.mine !== m.mine ||
      dayKey(new Date(nextMsg.createdAt)) !== k ||
      new Date(nextMsg.createdAt).getTime() - d.getTime() > RUN_GAP_MS ||
      m.status === 'failed'
    rows.push({ kind: 'message', key: m.key, message: m, isLastInRun })
  })
  return rows
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

/** Desktop: Enter sends, Shift+Enter is a new line. Touch: Enter is a new line; the button sends. */
export function shouldSendOnKey(
  e: { key: string; shiftKey: boolean; isComposing?: boolean; keyCode?: number },
  coarsePointer: boolean,
): boolean {
  if (e.key !== 'Enter' || e.shiftKey) return false
  // Don't send while an input method (e.g. Hindi or Japanese keyboard) is composing a word.
  if (e.isComposing || e.keyCode === 229) return false
  return !coarsePointer
}

export const MAX_MESSAGE_LENGTH = 4000
