// @vitest-environment node
import type { PGlite } from '@electric-sql/pglite'
import { beforeEach, describe, expect, it } from 'vitest'
import { as, asAdmin, createDb, createUser } from './harness'

const A = '00000000-0000-4000-8000-00000000000a'
const B = '00000000-0000-4000-8000-00000000000b'

let db: PGlite

beforeEach(async () => {
  db = await createDb()
  await createUser(db, A)
  await createUser(db, B)
  await as(db, B)
  await db.query(`insert into public.profiles (display_name) values ('Meera')`)
})

const names = async () =>
  (
    await db.query<{ id: string; display_name: string }>(
      'select id, display_name from public.profiles order by id',
    )
  ).rows

describe('profiles: anonymous visitors', () => {
  it('cannot read or create profiles', async () => {
    await as(db, null)
    await expect(db.query('select * from public.profiles')).rejects.toThrow(/permission denied/)
    await expect(
      db.query(`insert into public.profiles (display_name) values ('x')`),
    ).rejects.toThrow(/permission denied/)
  })
})

describe('profiles: signed-in user', () => {
  it('creates their own profile; id comes from the session', async () => {
    await as(db, A)
    await db.query(`insert into public.profiles (display_name) values ('Abhi')`)
    expect(await names()).toEqual([{ id: A, display_name: 'Abhi' }])
  })

  it('cannot create a profile for someone else', async () => {
    await as(db, A)
    await expect(
      db.query('insert into public.profiles (id, display_name) values ($1, $2)', [
        '00000000-0000-4000-8000-0000000000cc',
        'Imposter',
      ]),
    ).rejects.toThrow(/permission denied/)
  })

  it('cannot create a second profile', async () => {
    await as(db, B)
    await expect(
      db.query(`insert into public.profiles (display_name) values ('Again')`),
    ).rejects.toThrow(/duplicate key/)
  })

  it('reads only their own profile', async () => {
    await as(db, A)
    expect(await names()).toEqual([])
    await as(db, B)
    expect(await names()).toEqual([{ id: B, display_name: 'Meera' }])
  })

  it('renames only their own profile', async () => {
    await as(db, A)
    const res = await db.query(`update public.profiles set display_name = 'Hacked' where id = $1`, [
      B,
    ])
    expect(res.affectedRows).toBe(0)
    await as(db, B)
    await db.query(`update public.profiles set display_name = 'Meera J' where id = $1`, [B])
    expect(await names()).toEqual([{ id: B, display_name: 'Meera J' }])
  })

  it('cannot change protected columns', async () => {
    await as(db, B)
    await expect(db.query(`update public.profiles set id = $1`, [A])).rejects.toThrow(
      /permission denied/,
    )
    await expect(db.query(`update public.profiles set created_at = now()`)).rejects.toThrow(
      /permission denied/,
    )
  })

  it('cannot delete a profile', async () => {
    await as(db, B)
    await expect(db.query('delete from public.profiles')).rejects.toThrow(/permission denied/)
  })
})

describe('profiles: data rules', () => {
  const tryName = async (name: string) => {
    await as(db, A)
    return db.query('insert into public.profiles (display_name) values ($1)', [name])
  }

  it.each([
    ['empty', ''],
    ['too long', 'x'.repeat(41)],
    ['leading space', ' Abhi'],
    ['trailing space', 'Abhi '],
    ['newline', 'Ab\nhi'],
  ])('rejects a %s name', async (_label, name) => {
    await expect(tryName(name)).rejects.toThrow(/check constraint/)
  })

  it.each([['Abhi'], ['अभिनव'], ['🌻 Sunny'], ['x'.repeat(40)]])('accepts %s', async (name) => {
    await expect(tryName(name)).resolves.toBeDefined()
  })

  it('sets updated_at on rename, ignoring any client value', async () => {
    await asAdmin(db)
    await db.query(`update public.profiles set updated_at = '2000-01-01' where id = $1`, [B])
    await as(db, B)
    await db.query(`update public.profiles set display_name = 'M'`)
    await asAdmin(db)
    const { rows } = await db.query<{ updated_at: Date }>(
      'select updated_at from public.profiles where id = $1',
      [B],
    )
    expect(rows[0]!.updated_at.getFullYear()).toBeGreaterThan(2000)
  })

  it('removes the profile when the account is deleted', async () => {
    await asAdmin(db)
    await db.query('delete from auth.users where id = $1', [B])
    expect((await db.query('select * from public.profiles')).rows).toEqual([])
  })
})
