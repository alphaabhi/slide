// @vitest-environment node
import type { PGlite, PGliteInterface } from '@electric-sql/pglite'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { as, asAdmin, createDb, createUser } from './harness'

const OWNER = '00000000-0000-4000-8000-0000000000a1'
const PARTNER = '00000000-0000-4000-8000-0000000000b2'
const THIRD = '00000000-0000-4000-8000-0000000000c3'

let template: PGlite
let db: PGliteInterface
let spaceId: string
let otherSpaceId: string

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

beforeAll(async () => {
  template = await createDb()
  for (const [id, name] of [
    [OWNER, 'Abhi'],
    [PARTNER, 'Meera'],
    [THIRD, 'Stranger'],
  ] as const) {
    await createUser(template, id)
    await as(template, id)
    await template.query('insert into public.profiles (display_name) values ($1)', [name])
  }
  // OWNER + PARTNER share a space; THIRD has their own.
  await as(template, OWNER)
  const s = await template.query<{ r: { space_id: string; invite_token: string } }>(
    `select public.create_space('us') as r`,
  )
  spaceId = s.rows[0]!.r.space_id
  await as(template, PARTNER)
  await template.query('select public.accept_invitation($1)', [s.rows[0]!.r.invite_token])
  await as(template, THIRD)
  const o = await template.query<{ r: { space_id: string } }>(
    `select public.create_space('mine') as r`,
  )
  otherSpaceId = o.rows[0]!.r.space_id
  await asAdmin(template)
})

beforeEach(async () => {
  db = await template.clone()
})
afterEach(async () => {
  await db.close()
})
afterAll(async () => {
  await template.close()
})

interface Msg {
  id: string
  space_id: string
  sender_id: string
  client_id: string
  body: string
  created_at: string
}

async function send(
  user: string | null,
  body: string,
  clientId: string = crypto.randomUUID(),
  space = spaceId,
) {
  await as(db, user)
  const { rows } = await db.query<{ r: Msg }>('select public.send_message($1, $2, $3) as r', [
    space,
    clientId,
    body,
  ])
  return rows[0]!.r
}

async function read(user: string | null, space = spaceId) {
  await as(db, user)
  return (
    await db.query<{ body: string; sender_id: string }>(
      'select body, sender_id from public.messages where space_id = $1 order by created_at, id',
      [space],
    )
  ).rows
}

describe('sending', () => {
  it('both members can send and read, in order, with the real sender recorded', async () => {
    await send(OWNER, 'hey')
    await send(PARTNER, 'hi 👋')
    await send(OWNER, 'नमस्ते\nsecond line')
    const expected = [
      { body: 'hey', sender_id: OWNER },
      { body: 'hi 👋', sender_id: PARTNER },
      { body: 'नमस्ते\nsecond line', sender_id: OWNER },
    ]
    expect(await read(OWNER)).toEqual(expected)
    expect(await read(PARTNER)).toEqual(expected)
  })

  it('uses server time, not anything the client says', async () => {
    const before = Date.now()
    const m = await send(OWNER, 'hey')
    expect(new Date(m.created_at).getTime()).toBeGreaterThanOrEqual(before - 5000)
  })

  it('trims surrounding whitespace and rejects empty or oversized messages', async () => {
    expect((await send(OWNER, '  \n hello \n ')).body).toBe('hello')
    await expect(send(OWNER, '   \n ')).rejects.toThrow(/message_empty/)
    await expect(send(OWNER, 'x'.repeat(4001))).rejects.toThrow(/message_too_long/)
    expect((await send(OWNER, 'x'.repeat(4000))).body).toHaveLength(4000)
  })

  it('rejects control characters but keeps tabs and newlines', async () => {
    await expect(send(OWNER, 'bell\u0007')).rejects.toThrow(/check constraint/)
    expect((await send(OWNER, 'a\tb\nc')).body).toBe('a\tb\nc')
  })
})

describe('no duplicates', () => {
  it('a retry with the same client id returns the original instead of a copy', async () => {
    const id = uuid(1)
    const first = await send(OWNER, 'only once', id)
    const retry = await send(OWNER, 'only once', id)
    expect(retry.id).toBe(first.id)
    expect(await read(OWNER)).toHaveLength(1)
  })

  it('someone else cannot hijack a client id', async () => {
    const id = uuid(2)
    await send(OWNER, 'mine', id)
    await expect(send(PARTNER, 'theirs', id)).rejects.toThrow(/message_invalid/)
  })
})

describe('who can read and send', () => {
  it('outsiders can neither read nor send', async () => {
    await send(OWNER, 'private')
    expect(await read(THIRD)).toEqual([])
    await expect(send(THIRD, 'let me in')).rejects.toThrow(/not_member/)
  })

  it('signed-out visitors can do nothing', async () => {
    await send(OWNER, 'private')
    await expect(read(null)).rejects.toThrow(/permission denied/)
    await expect(send(null, 'x')).rejects.toThrow(/permission denied/)
  })

  it('two spaces never see each other’s messages', async () => {
    await send(OWNER, 'in our space')
    await send(THIRD, 'in my space', crypto.randomUUID(), otherSpaceId)
    expect(await read(OWNER, otherSpaceId)).toEqual([])
    expect(await read(THIRD, spaceId)).toEqual([])
    await expect(send(OWNER, 'cross-post', crypto.randomUUID(), otherSpaceId)).rejects.toThrow(
      /not_member/,
    )
  })

  it('nobody can insert, edit or delete messages directly', async () => {
    const m = await send(OWNER, 'original')
    await as(db, OWNER)
    await expect(
      db.query(
        'insert into public.messages (space_id, sender_id, client_id, body) values ($1, $2, $3, $4)',
        [spaceId, PARTNER, uuid(9), 'spoofed as Meera'],
      ),
    ).rejects.toThrow(/permission denied/)
    await expect(
      db.query(`update public.messages set body = 'edited' where id = $1`, [m.id]),
    ).rejects.toThrow(/permission denied/)
    await expect(db.query('delete from public.messages where id = $1', [m.id])).rejects.toThrow(
      /permission denied/,
    )
  })

  it('limits flooding: 20 messages per 10 seconds', async () => {
    for (let i = 0; i < 20; i++) await send(OWNER, `msg ${i}`)
    await expect(send(OWNER, 'one too many')).rejects.toThrow(/rate_limited/)
    // The other person is unaffected.
    await expect(send(PARTNER, 'still fine')).resolves.toBeDefined()
  })
})

describe('leaving', () => {
  it('after someone leaves: they lose the history, the other keeps it read-only', async () => {
    await send(OWNER, 'before')
    await as(db, PARTNER)
    await db.query('select public.leave_space($1)', [spaceId])
    expect(await read(PARTNER)).toEqual([])
    expect(await read(OWNER)).toEqual([{ body: 'before', sender_id: OWNER }])
    await expect(send(OWNER, 'anyone there?')).rejects.toThrow(/space_closed/)
    await expect(send(PARTNER, 'let me back')).rejects.toThrow(/not_member/)
  })

  it('when the last person leaves, the messages are deleted too', async () => {
    await send(OWNER, 'bye')
    await as(db, PARTNER)
    await db.query('select public.leave_space($1)', [spaceId])
    await as(db, OWNER)
    await db.query('select public.leave_space($1)', [spaceId])
    await asAdmin(db)
    expect((await db.query('select * from public.messages')).rows).toEqual([])
  })
})

describe('live updates', () => {
  it('messages are published for Supabase Realtime', async () => {
    await asAdmin(db)
    const { rows } = await db.query<{ tablename: string }>(
      `select tablename from pg_publication_tables where pubname = 'supabase_realtime'`,
    )
    expect(rows.map((r) => r.tablename)).toContain('messages')
  })
})
