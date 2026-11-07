/**
 * Splits message text into plain text and web links, so links can be tapped.
 * Only http(s) links (or ones starting "www.") become links; anything else
 * (javascript:, data:, mailto: …) stays plain text. No HTML is ever produced.
 */
export type Piece = { text: string; href?: string }

// A run of non-space characters starting with http(s):// or www.
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"]+/gi
// Punctuation that usually ends a sentence rather than belonging to the link.
const TRAILING = /[.,;:!?…’”'"]+$/

export function linkify(text: string): Piece[] {
  const pieces: Piece[] = []
  let last = 0
  for (const match of text.matchAll(URL_RE)) {
    let raw = match[0]
    const start = match.index
    // Drop trailing punctuation, and a closing bracket with no opening one in the link.
    raw = raw.replace(TRAILING, '')
    while (/[)\]}]$/.test(raw)) {
      const close = raw.slice(-1)
      const open = close === ')' ? '(' : close === ']' ? '[' : '{'
      if (raw.split(open).length >= raw.split(close).length) break
      raw = raw.slice(0, -1).replace(TRAILING, '')
    }
    const href = toHref(raw)
    if (!href) continue
    if (start > last) pieces.push({ text: text.slice(last, start) })
    pieces.push({ text: raw, href })
    last = start + raw.length
  }
  if (last < text.length) pieces.push({ text: text.slice(last) })
  return pieces.length ? pieces : [{ text }]
}

function toHref(raw: string): string | undefined {
  const candidate = /^www\./i.test(raw) ? `https://${raw}` : raw
  try {
    const url = new URL(candidate)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined
    if (!url.hostname.includes('.')) return undefined
    return url.href
  } catch {
    return undefined
  }
}
