/** First visible grapheme of a name, so emoji and non-Latin names work. */
export function initialOf(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '?'
  const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  const first = seg.segment(trimmed)[Symbol.iterator]().next().value?.segment ?? '?'
  return first.toLocaleUpperCase()
}
