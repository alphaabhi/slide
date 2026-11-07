import { describe, expect, it } from 'vitest'
import { linkify } from './linkify'

const links = (t: string) =>
  linkify(t)
    .filter((p) => p.href)
    .map((p) => [p.text, p.href])

describe('linkify', () => {
  it('finds https, http and www links in a sentence', () => {
    expect(linkify('watch https://youtu.be/dQw4w9WgXcQ and www.slidedm.space now')).toEqual([
      { text: 'watch ' },
      { text: 'https://youtu.be/dQw4w9WgXcQ', href: 'https://youtu.be/dQw4w9WgXcQ' },
      { text: ' and ' },
      { text: 'www.slidedm.space', href: 'https://www.slidedm.space/' },
      { text: ' now' },
    ])
  })

  it('keeps query strings, but not the full stop or a closing bracket after the link', () => {
    expect(links('see https://www.youtube.com/watch?v=abc&t=42s.')).toEqual([
      ['https://www.youtube.com/watch?v=abc&t=42s', 'https://www.youtube.com/watch?v=abc&t=42s'],
    ])
    expect(
      links('(open.spotify.com is not a link but https://open.spotify.com/track/1 is)'),
    ).toEqual([['https://open.spotify.com/track/1', 'https://open.spotify.com/track/1']])
    expect(links('https://en.wikipedia.org/wiki/Slide_(album)')).toEqual([
      [
        'https://en.wikipedia.org/wiki/Slide_(album)',
        'https://en.wikipedia.org/wiki/Slide_(album)',
      ],
    ])
  })

  it('never turns other schemes or markup into links', () => {
    expect(links('javascript:alert(1) data:text/html,x mailto:a@b.com')).toEqual([])
    expect(links('<a href="x">https://ok.com</a>')).toEqual([['https://ok.com', 'https://ok.com/']])
    expect(links('http://localhost:3000')).toEqual([])
  })

  it('plain text stays one piece', () => {
    expect(linkify('no links here')).toEqual([{ text: 'no links here' }])
    expect(linkify('')).toEqual([{ text: '' }])
  })
})
