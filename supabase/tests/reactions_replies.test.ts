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
  body: string
  reply_to: string | null
}

async function send(user: string, body: string, replyTo: string | null = null, space = spaceId) {
  await as(db, user)
  const { rows } = await db.query<{ r: Msg }>('select public.send_message($1, $2, $3, $4) as r', [
    space,
    crypto.randomUUID(),
    body,
    replyTo,
  ])
  return rows[0]!.r
}

async function react(user: string | null, messageId: string, emoji: string | null) {
  await as(db, user)
  const { rows } = await db.query<{ r: { emoji: string | null } }>(
    'select public.react_to_message($1, $2) as r',
    [messageId, emoji],
  )
  return rows[0]!.r
}

async function reactions(user: string | null, messageId: string) {
  await as(db, user)
  return (
    await db.query<{ user_id: string; emoji: string | null }>(
      'select user_id, emoji from public.message_reactions where message_id = $1 order by user_id',
      [messageId],
    )
  ).rows
}

describe('replies', () => {
  it('a message can quote an earlier one from the same space', async () => {
    const original = await send(OWNER, 'what are you doing saturday?')
    const reply = await send(PARTNER, 'nothing yet 👀', original.id)
    expect(reply.reply_to).toBe(original.id)
  })

  it('cannot quote a message from another space (or one that does not exist)', async () => {
    const elsewhere = await send(THIRD, 'secret', null, otherSpaceId)
    await expect(send(OWNER, 'quoting you', elsewhere.id)).rejects.toThrow(/reply_invalid/)
    await expect(send(OWNER, 'quoting nothing', crypto.randomUUID())).rejects.toThrow(
      /reply_invalid/,
    )
  })

  it('older app versions can still send with three arguments', async () => {
    await as(db, OWNER)
    const { rows } = await db.query<{ r: Msg }>(
      'select public.send_message(p_space_id => $1, p_client_id => $2, p_body => $3) as r',
      [spaceId, crypto.randomUUID(), 'old app'],
    )
    expect(rows[0]!.r.reply_to).toBeNull()
  })
})

describe('reactions', () => {
  it('either member can react; both see it', async () => {
    const m = await send(OWNER, 'I booked the tickets')
    await react(PARTNER, m.id, '❤️')
    const expected = [{ user_id: PARTNER, emoji: '❤️' }]
    expect(await reactions(OWNER, m.id)).toEqual(expected)
    expect(await reactions(PARTNER, m.id)).toEqual(expected)
  })

  it('one reaction per person: a new one replaces it, null removes it', async () => {
    const m = await send(OWNER, 'hello')
    await react(PARTNER, m.id, '❤️')
    await react(PARTNER, m.id, '😂')
    expect(await reactions(OWNER, m.id)).toEqual([{ user_id: PARTNER, emoji: '😂' }])
    await react(PARTNER, m.id, null)
    expect(await reactions(OWNER, m.id)).toEqual([{ user_id: PARTNER, emoji: null }])
    // Both can react to the same message, including their own.
    await react(OWNER, m.id, '🔥')
    await react(PARTNER, m.id, '👍🏽')
    expect((await reactions(OWNER, m.id)).map((r) => r.emoji)).toEqual(['🔥', '👍🏽'])
  })

  it('accepts multi-part emoji, rejects text and markup', async () => {
    const m = await send(OWNER, 'hi')
    await expect(react(PARTNER, m.id, '👩‍❤️‍👨')).resolves.toMatchObject({ emoji: '👩‍❤️‍👨' })
    for (const bad of ['lol', '<b>', 'a❤️', '❤️ ❤️', 'x'.repeat(17)]) {
      await expect(react(PARTNER, m.id, bad)).rejects.toThrow(/reaction_invalid/)
    }
  })

  it('outsiders and signed-out visitors can neither react nor see reactions', async () => {
    const m = await send(OWNER, 'private')
    await react(PARTNER, m.id, '❤️')
    await expect(react(THIRD, m.id, '❤️')).rejects.toThrow(/not_member/)
    expect(await reactions(THIRD, m.id)).toEqual([])
    await expect(react(null, m.id, '❤️')).rejects.toThrow(/permission denied/)
  })

  it('nobody can write reactions directly', async () => {
    const m = await send(OWNER, 'hi')
    await as(db, OWNER)
    await expect(
      db.query(
        `insert into public.message_reactions (message_id, user_id, space_id, emoji) values ($1, $2, $3, '❤️')`,
        [m.id, PARTNER, spaceId],
      ),
    ).rejects.toThrow(/permission denied/)
  })

  it('a closed space takes no new reactions; deleting the space removes them', async () => {
    const m = await send(OWNER, 'bye')
    await react(OWNER, m.id, '❤️')
    await as(db, PARTNER)
    await db.query('select public.leave_space($1)', [spaceId])
    await expect(react(OWNER, m.id, '😢')).rejects.toThrow(/space_closed/)
    await as(db, OWNER)
    await db.query('select public.leave_space($1)', [spaceId])
    await asAdmin(db)
    expect((await db.query('select * from public.message_reactions')).rows).toEqual([])
  })

  it('reactions are published for live updates', async () => {
    await asAdmin(db)
    const { rows } = await db.query<{ tablename: string }>(
      `select tablename from pg_publication_tables where pubname = 'supabase_realtime'`,
    )
    expect(rows.map((r) => r.tablename)).toContain('message_reactions')
  })
})
