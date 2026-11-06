// @vitest-environment node
import type { PGlite, PGliteInterface } from '@electric-sql/pglite'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { as, asAdmin, createDb, createUser } from './harness'

const A = '00000000-0000-4000-8000-0000000000a1'
const B = '00000000-0000-4000-8000-0000000000b2'
const C = '00000000-0000-4000-8000-0000000000c3'

let template: PGlite
let db: PGliteInterface
let token: string

beforeAll(async () => {
  template = await createDb()
  for (const [id, name] of [
    [A, 'Abhi'],
    [B, 'Meera'],
    [C, 'Stranger'],
  ] as const) {
    await createUser(template, id)
    await as(template, id)
    await template.query('insert into public.profiles (display_name) values ($1)', [name])
  }
  await as(template, A)
  const r = await template.query<{ r: { invite_token: string } }>(
    `select public.create_space('x') as r`,
  )
  token = r.rows[0]!.r.invite_token
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

const setAvatar = async (user: string, avatar: string | null) => {
  await as(db, user)
  return db.query('update public.profiles set avatar = $1 where id = $2', [avatar, user])
}

describe('avatars', () => {
  it('you can pick, change and clear your own avatar', async () => {
    await setAvatar(A, 'kai')
    await setAvatar(A, 'emi')
    await as(db, A)
    expect((await db.query('select avatar from public.profiles where id = $1', [A])).rows).toEqual([
      { avatar: 'emi' },
    ])
    await setAvatar(A, null)
    expect((await db.query('select avatar from public.profiles where id = $1', [A])).rows).toEqual([
      { avatar: null },
    ])
  })

  it('only SLIDE’s own avatars are allowed (no URLs or made-up values)', async () => {
    await expect(setAvatar(A, 'https://evil.example/x.png')).rejects.toThrow(/check constraint/)
    await expect(setAvatar(A, 'killua')).rejects.toThrow(/check constraint/)
  })

  it('you cannot change someone else’s avatar', async () => {
    await as(db, A)
    const res = await db.query(`update public.profiles set avatar = 'kai' where id = $1`, [B])
    expect(res.affectedRows).toBe(0)
  })

  it('can be chosen when the profile is first created', async () => {
    await asAdmin(db)
    const D = '00000000-0000-4000-8000-0000000000d4'
    await createUser(db, D)
    await as(db, D)
    await db.query(`insert into public.profiles (display_name, avatar) values ('Dee', 'sora')`)
    expect((await db.query('select avatar from public.profiles where id = $1', [D])).rows).toEqual([
      { avatar: 'sora' },
    ])
  })

  it('the invite preview shows the inviter’s avatar; your partner sees it, outsiders don’t', async () => {
    await setAvatar(A, 'rin')
    await as(db, null)
    const preview = (
      await db.query<{ r: Record<string, unknown> }>('select public.get_invitation($1) as r', [
        token,
      ])
    ).rows[0]!.r
    expect(preview).toMatchObject({ status: 'valid', inviter_name: 'Abhi', inviter_avatar: 'rin' })

    await as(db, B)
    await db.query('select public.accept_invitation($1)', [token])
    expect((await db.query('select avatar from public.profiles where id = $1', [A])).rows).toEqual([
      { avatar: 'rin' },
    ])
    await as(db, C)
    expect((await db.query('select avatar from public.profiles where id = $1', [A])).rows).toEqual(
      [],
    )
  })
})
