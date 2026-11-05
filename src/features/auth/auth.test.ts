import { describe, expect, it } from 'vitest'
import { authErrorMessage, profileErrorMessage } from './errors'
import { codeSchema, displayNameSchema, emailSchema, safeNext } from './validation'

describe('emailSchema', () => {
  it('trims and accepts normal addresses', () => {
    expect(emailSchema.parse('  me@example.com ')).toBe('me@example.com')
  })
  it.each(['', 'nope', 'a@b', 'me@@example.com'])('rejects %j', (v) => {
    expect(emailSchema.safeParse(v).success).toBe(false)
  })
})

describe('codeSchema', () => {
  it('accepts 6-digit codes, ignoring spaces', () => {
    expect(codeSchema.parse('424 242')).toBe('424242')
  })
  it.each(['', '12345', '1234567', 'abcdef', '12345a'])('rejects %j', (v) => {
    expect(codeSchema.safeParse(v).success).toBe(false)
  })
})

describe('displayNameSchema (mirrors the database rules)', () => {
  it('collapses and trims whitespace', () => {
    expect(displayNameSchema.parse('  Abhi   Jha ')).toBe('Abhi Jha')
  })
  it.each(['अभिनव', '🌻 Sunny', 'x'.repeat(40)])('accepts %j', (v) => {
    expect(displayNameSchema.safeParse(v).success).toBe(true)
  })
  it.each(['', '   ', 'x'.repeat(41), 'a\u0007b'])('rejects %j', (v) => {
    expect(displayNameSchema.safeParse(v).success).toBe(false)
  })
})

describe('safeNext (open-redirect protection)', () => {
  it.each([
    ['/home', '/home'],
    ['/s/abc?x=1', '/s/abc?x=1'],
    [null, '/home'],
    ['https://evil.com', '/home'],
    ['//evil.com', '/home'],
    ['/\\evil.com', '/home'],
    ['javascript:alert(1)', '/home'],
  ])('%j → %j', (input, expected) => {
    expect(safeNext(input)).toBe(expected)
  })
})

describe('error messages never leak server text', () => {
  it.each([
    [{ name: 'AuthRetryableFetchError', status: 0 }, /connection/],
    [
      { name: 'AuthRetryableFetchError', status: 500, message: 'Error sending magic link email' },
      /couldn’t send a code to that address/,
    ],
    [
      { name: 'AuthRetryableFetchError', status: 503, message: 'Service Unavailable' },
      /had a problem/,
    ],
    [{ code: 'over_email_send_rate_limit', status: 429 }, /Too many attempts/],
    [{ code: 'otp_expired', status: 403 }, /wrong or has expired/],
    [{ code: 'something_new', message: 'relation "x" does not exist' }, /^Something went wrong/],
  ])('%j', (err, expected) => {
    const msg = authErrorMessage(err)
    expect(msg).toMatch(expected)
    expect(msg).not.toMatch(/relation|does not exist/)
  })

  it('maps database check violations on names', () => {
    expect(profileErrorMessage({ code: '23514' })).toMatch(/1–40/)
  })
})
