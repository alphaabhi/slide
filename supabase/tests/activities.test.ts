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
let waitingSpaceId: string

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
  // THIRD has a space nobody has joined yet.
  await as(template, THIRD)
  const w = await template.query<{ r: { space_id: string } }>(
    `select public.create_space('alone') as r`,
  )
  waitingSpaceId = w.rows[0]!.r.space_id
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

interface Round {
  id: string
  kind: string
  status: 'open' | 'revealed' | 'skipped'
  answered_by: string[]
  skipped_by: string | null
  prompt: string
  option_a: string | null
  option_b: string | null
  started_by: string
}

async function start(
  user: string | null,
  kind = 'would_you_rather',
  opts: {
    key?: string
    prompt?: string
    a?: string | null
    b?: string | null
    space?: string
  } = {},
): Promise<Round> {
  await as(db, user)
  const { rows } = await db.query<{ r: Round }>(
    'select public.start_round($1, $2, $3, $4, $5, $6) as r',
    [
      opts.space ?? spaceId,
      kind,
      opts.key ?? 'wyr-1',
      opts.prompt ?? 'Would you rather…',
      opts.a === undefined ? (kind === 'question_of_the_day' ? null : 'Fly') : opts.a,
      opts.b === undefined ? (kind === 'question_of_the_day' ? null : 'Be invisible') : opts.b,
    ],
  )
  return rows[0]!.r
}

async function answer(user: string | null, roundId: string, choice: string | null, text?: string) {
  await as(db, user)
  const { rows } = await db.query<{ r: Round }>('select public.answer_round($1, $2, $3) as r', [
    roundId,
    choice,
    text ?? null,
  ])
  return rows[0]!.r
}

async function skip(user: string | null, roundId: string) {
  await as(db, user)
  const { rows } = await db.query<{ r: Round }>('select public.skip_round($1) as r', [roundId])
  return rows[0]!.r
}

async function responses(user: string | null, roundId: string) {
  await as(db, user)
  return (
    await db.query<{ user_id: string; choice: string | null; answer: string | null }>(
      'select user_id, choice, answer from public.activity_responses where round_id = $1 order by user_id',
      [roundId],
    )
  ).rows
}

async function rounds(user: string | null) {
  await as(db, user)
  return (
    await db.query<Round>('select * from public.activity_rounds where space_id = $1', [spaceId])
  ).rows
}

describe('starting', () => {
  it('either member can start; the server records who', async () => {
    const r = await start(PARTNER)
    expect(r).toMatchObject({ status: 'open', started_by: PARTNER, answered_by: [] })
    expect(await rounds(OWNER)).toHaveLength(1)
  })

  it('one open round per game: starting again returns the open one', async () => {
    const first = await start(OWNER)
    const again = await start(PARTNER, 'would_you_rather', { key: 'wyr-2' })
    expect(again.id).toBe(first.id)
    // A different game is fine.
    const other = await start(OWNER, 'this_or_that', { key: 'tot-1', prompt: 'Tea or coffee?' })
    expect(other.id).not.toBe(first.id)
  })

  it('Question of the Day: once a day per space, no options', async () => {
    const q = await start(OWNER, 'question_of_the_day', { key: 'qotd-1', prompt: 'Best trip?' })
    expect(q.option_a).toBeNull()
    await answer(OWNER, q.id, null, 'Japan')
    await answer(PARTNER, q.id, null, 'Goa')
    const again = await start(PARTNER, 'question_of_the_day', { key: 'qotd-2', prompt: 'x' })
    expect(again.id).toBe(q.id)
  })

  it('validates games, prompts and options', async () => {
    await expect(start(OWNER, 'chess')).rejects.toThrow(/activity_invalid/)
    await expect(start(OWNER, 'would_you_rather', { a: null })).rejects.toThrow(/activity_invalid/)
    await expect(start(OWNER, 'would_you_rather', { key: 'Bad Key!' })).rejects.toThrow(
      /activity_invalid/,
    )
    await expect(start(OWNER, 'would_you_rather', { prompt: 'x'.repeat(201) })).rejects.toThrow(
      /activity_invalid/,
    )
    await expect(start(OWNER, 'would_you_rather', { a: 'x'.repeat(81) })).rejects.toThrow(
      /activity_invalid/,
    )
  })

  it('outsiders, signed-out visitors and half-empty spaces cannot start', async () => {
    await expect(start(THIRD)).rejects.toThrow(/not_member/)
    await expect(start(null)).rejects.toThrow(/permission denied/)
    await expect(start(THIRD, 'would_you_rather', { space: waitingSpaceId })).rejects.toThrow(
      /space_waiting/,
    )
  })
})

describe('answers stay hidden until both have answered', () => {
  it('the first answer is visible only to its author', async () => {
    const r = await start(OWNER)
    const after = await answer(OWNER, r.id, 'a')
    expect(after).toMatchObject({ status: 'open', answered_by: [OWNER] })
    expect(await responses(OWNER, r.id)).toEqual([{ user_id: OWNER, choice: 'a', answer: null }])
    // The other person learns *that* Abhi answered, not *what*.
    expect(await responses(PARTNER, r.id)).toEqual([])
    expect((await rounds(PARTNER))[0]!.answered_by).toEqual([OWNER])
  })

  it('the second answer reveals both, to both', async () => {
    const r = await start(OWNER)
    await answer(OWNER, r.id, 'a')
    const revealed = await answer(PARTNER, r.id, 'b')
    expect(revealed.status).toBe('revealed')
    const both = [
      { user_id: OWNER, choice: 'a', answer: null },
      { user_id: PARTNER, choice: 'b', answer: null },
    ]
    expect(await responses(OWNER, r.id)).toEqual(both)
    expect(await responses(PARTNER, r.id)).toEqual(both)
  })

  it('Question of the Day takes trimmed text, 1–500 characters', async () => {
    const q = await start(OWNER, 'question_of_the_day', { key: 'qotd-1', prompt: 'Best trip?' })
    await expect(answer(OWNER, q.id, null, '   ')).rejects.toThrow(/answer_empty/)
    await expect(answer(OWNER, q.id, null, 'x'.repeat(501))).rejects.toThrow(/answer_too_long/)
    await expect(answer(OWNER, q.id, null, 'bell\u0007')).rejects.toThrow(/activity_invalid/)
    await answer(OWNER, q.id, null, '  Kyoto, in the rain \n ')
    expect((await responses(OWNER, q.id))[0]!.answer).toBe('Kyoto, in the rain')
  })

  it('choices must be a or b', async () => {
    const r = await start(OWNER)
    await expect(answer(OWNER, r.id, 'c')).rejects.toThrow(/activity_invalid/)
    await expect(answer(OWNER, r.id, null)).rejects.toThrow(/activity_invalid/)
  })

  it('answering twice changes nothing (a safe retry)', async () => {
    const r = await start(OWNER)
    await answer(OWNER, r.id, 'a')
    const again = await answer(OWNER, r.id, 'b')
    expect(again.answered_by).toEqual([OWNER])
    expect(await responses(OWNER, r.id)).toEqual([{ user_id: OWNER, choice: 'a', answer: null }])
  })

  it('outsiders can neither answer nor see anything', async () => {
    const r = await start(OWNER)
    await answer(OWNER, r.id, 'a')
    await answer(PARTNER, r.id, 'b')
    await expect(answer(THIRD, r.id, 'a')).rejects.toThrow(/not_member/)
    expect(await rounds(THIRD)).toEqual([])
    expect(await responses(THIRD, r.id)).toEqual([])
    await expect(rounds(null)).rejects.toThrow(/permission denied/)
  })
})

describe('skipping', () => {
  it('either member can skip; an answer already given stays hidden', async () => {
    const r = await start(OWNER)
    await answer(OWNER, r.id, 'a')
    const skipped = await skip(PARTNER, r.id)
    expect(skipped).toMatchObject({ status: 'skipped', skipped_by: PARTNER })
    expect(await responses(PARTNER, r.id)).toEqual([])
    await expect(answer(PARTNER, r.id, 'b')).rejects.toThrow(/round_closed/)
  })

  it('after a skip a new round of the same game can start', async () => {
    const r = await start(OWNER)
    await skip(OWNER, r.id)
    const next = await start(OWNER, 'would_you_rather', { key: 'wyr-2' })
    expect(next.id).not.toBe(r.id)
  })

  it('outsiders cannot skip', async () => {
    const r = await start(OWNER)
    await expect(skip(THIRD, r.id)).rejects.toThrow(/not_member/)
  })
})

describe('integrity', () => {
  it('nobody can write rounds or answers directly', async () => {
    const r = await start(OWNER)
    await as(db, OWNER)
    await expect(
      db.query(`update public.activity_rounds set status = 'revealed' where id = $1`, [r.id]),
    ).rejects.toThrow(/permission denied/)
    await expect(
      db.query(
        `insert into public.activity_responses (round_id, user_id, choice) values ($1, $2, 'a')`,
        [r.id, PARTNER],
      ),
    ).rejects.toThrow(/permission denied/)
    await expect(
      db.query('delete from public.activity_rounds where id = $1', [r.id]),
    ).rejects.toThrow(/permission denied/)
  })

  it('a closed space takes no new rounds or answers but keeps its history', async () => {
    const r = await start(OWNER)
    await answer(OWNER, r.id, 'a')
    await as(db, PARTNER)
    await db.query('select public.leave_space($1)', [spaceId])
    await expect(start(OWNER, 'this_or_that', { key: 'tot-1' })).rejects.toThrow(/space_closed/)
    expect(await rounds(OWNER)).toHaveLength(1)
    expect(await rounds(PARTNER)).toEqual([])
  })

  it('when the last person leaves, rounds and answers are deleted', async () => {
    const r = await start(OWNER)
    await answer(OWNER, r.id, 'a')
    await as(db, PARTNER)
    await db.query('select public.leave_space($1)', [spaceId])
    await as(db, OWNER)
    await db.query('select public.leave_space($1)', [spaceId])
    await asAdmin(db)
    expect((await db.query('select * from public.activity_rounds')).rows).toEqual([])
    expect((await db.query('select * from public.activity_responses')).rows).toEqual([])
  })

  it('rounds are published for live updates; answers are not', async () => {
    await asAdmin(db)
    const { rows } = await db.query<{ tablename: string }>(
      `select tablename from pg_publication_tables where pubname = 'supabase_realtime'`,
    )
    const tables = rows.map((r) => r.tablename)
    expect(tables).toContain('activity_rounds')
    expect(tables).not.toContain('activity_responses')
  })
})
