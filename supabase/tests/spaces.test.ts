// @vitest-environment node
import type { PGlite, PGliteInterface } from '@electric-sql/pglite'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { as, asAdmin, createDb, createUser } from './harness'

// Owner (creates), partner (joins), third (outsider), noname (no profile yet)
const OWNER = '00000000-0000-4000-8000-0000000000a1'
const PARTNER = '00000000-0000-4000-8000-0000000000b2'
const THIRD = '00000000-0000-4000-8000-0000000000c3'
const NONAME = '00000000-0000-4000-8000-0000000000d4'

let template: PGlite
let db: PGliteInterface

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
  await createUser(template, NONAME)
  await asAdmin(template)
})

beforeEach(async () => {
  db = await template.clone()
})

// Each clone is a full in-memory Postgres; free it or the test run runs out of memory.
afterEach(async () => {
  await db.close()
})

afterAll(async () => {
  await template.close()
})

async function rpc<T = Record<string, unknown>>(user: string | null, fn: string, args: unknown[] = []) {
  await as(db, user)
  const params = args.map((_, i) => `$${i + 1}`).join(', ')
  const { rows } = await db.query<{ r: T }>(`select public.${fn}(${params}) as r`, args)
  return rows[0]!.r
}

async function newSpace(title: string | null = 'Not the Hinge chat') {
  return rpc<{ space_id: string; invite_token: string }>(OWNER, 'create_space', [title])
}

async function rows(user: string | null, sql: string, args: unknown[] = []) {
  await as(db, user)
  return (await db.query(sql, args)).rows
}

describe('create_space', () => {
  it('creates a space with you as the only member and a 43-character invite token', async () => {
    const { space_id, invite_token } = await newSpace()
    expect(invite_token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(await rows(OWNER, 'select user_id from public.space_members where space_id = $1', [space_id])).toEqual([
      { user_id: OWNER },
    ])
  })

  it('stores only a hash of the token, never the token itself', async () => {
    const { invite_token } = await newSpace()
    await asAdmin(db)
    const dump = JSON.stringify((await db.query('select * from public.invitations')).rows)
    expect(dump).not.toContain(invite_token)
  })

  it('generates a different token every time', async () => {
    const a = await newSpace()
    const b = await newSpace()
    expect(a.invite_token).not.toBe(b.invite_token)
  })

  it('tidies the title and allows no title', async () => {
    const { space_id } = await newSpace('  late   night   chats  ')
    expect(await rows(OWNER, 'select title from public.spaces where id = $1', [space_id])).toEqual([
      { title: 'late night chats' },
    ])
    const untitled = await newSpace('   ')
    expect(await rows(OWNER, 'select title from public.spaces where id = $1', [untitled.space_id])).toEqual([
      { title: null },
    ])
  })

  it('rejects a title over 60 characters', async () => {
    await expect(newSpace('x'.repeat(61))).rejects.toThrow(/check constraint/)
  })

  it('requires being signed in with a display name', async () => {
    await expect(rpc(null, 'create_space', ['x'])).rejects.toThrow(/permission denied/)
    await expect(rpc(NONAME, 'create_space', ['x'])).rejects.toThrow(/profile_required/)
  })

  it('limits how many spaces one person can create per day', async () => {
    for (let i = 0; i < 20; i++) await newSpace(null)
    await expect(newSpace(null)).rejects.toThrow(/rate_limited/)
  })
})

describe('get_invitation (join page preview)', () => {
  it('shows who invited you, even before you sign in', async () => {
    const { invite_token } = await newSpace()
    const preview = await rpc(null, 'get_invitation', [invite_token])
    expect(preview).toMatchObject({ status: 'valid', inviter_name: 'Abhi', space_title: 'Not the Hinge chat' })
    expect(preview).not.toHaveProperty('space_id')
  })

  it('recognises your own invite', async () => {
    const { invite_token, space_id } = await newSpace()
    expect(await rpc(OWNER, 'get_invitation', [invite_token])).toEqual({ status: 'own', space_id })
  })

  it('reveals nothing about unknown, used or revoked links', async () => {
    expect(await rpc(null, 'get_invitation', ['made-up-token'])).toEqual({ status: 'not_found' })
    const { invite_token } = await newSpace()
    await rpc(PARTNER, 'accept_invitation', [invite_token])
    expect(await rpc(THIRD, 'get_invitation', [invite_token])).toEqual({ status: 'used' })
  })
})

describe('accept_invitation', () => {
  it('lets one other person join; both see the space and each other’s names', async () => {
    const { space_id, invite_token } = await newSpace()
    expect(await rpc(PARTNER, 'accept_invitation', [invite_token])).toEqual({ space_id, already_member: false })

    for (const user of [OWNER, PARTNER]) {
      expect(await rows(user, 'select id from public.spaces')).toEqual([{ id: space_id }])
      const names = await rows(user, 'select display_name from public.profiles order by display_name')
      expect(names).toEqual([{ display_name: 'Abhi' }, { display_name: 'Meera' }])
    }
  })

  it('rejects a third person', async () => {
    const { space_id, invite_token } = await newSpace()
    await rpc(PARTNER, 'accept_invitation', [invite_token])
    await expect(rpc(THIRD, 'accept_invitation', [invite_token])).rejects.toThrow(/invite_used/)
    // Even with a fresh link the space is full.
    await expect(rpc(OWNER, 'rotate_invitation', [space_id])).rejects.toThrow(/space_full/)
  })

  it('never allows a third member, even bypassing the functions', async () => {
    const { space_id, invite_token } = await newSpace()
    await rpc(PARTNER, 'accept_invitation', [invite_token])
    await asAdmin(db)
    await expect(
      db.query('insert into public.space_members (space_id, user_id) values ($1, $2)', [space_id, THIRD]),
    ).rejects.toThrow(/space_full/)
  })

  it('stops the creator joining their own space twice', async () => {
    const { invite_token } = await newSpace()
    await expect(rpc(OWNER, 'accept_invitation', [invite_token])).rejects.toThrow(/invite_own/)
  })

  it('is safe to tap twice', async () => {
    const { space_id, invite_token } = await newSpace()
    await rpc(PARTNER, 'accept_invitation', [invite_token])
    expect(await rpc(PARTNER, 'accept_invitation', [invite_token])).toEqual({ space_id, already_member: true })
    expect(await rows(OWNER, 'select count(*)::int as n from public.space_members')).toEqual([{ n: 2 }])
  })

  it('rejects expired links', async () => {
    const { invite_token } = await newSpace()
    await asAdmin(db)
    await db.query(`update public.invitations set expires_at = now() - interval '1 minute'`)
    expect(await rpc(PARTNER, 'get_invitation', [invite_token])).toEqual({ status: 'expired' })
    await expect(rpc(PARTNER, 'accept_invitation', [invite_token])).rejects.toThrow(/invite_expired/)
  })

  it('rejects revoked links', async () => {
    const { space_id, invite_token } = await newSpace()
    await rpc(OWNER, 'revoke_invitation', [space_id])
    expect(await rpc(PARTNER, 'get_invitation', [invite_token])).toEqual({ status: 'revoked' })
    await expect(rpc(PARTNER, 'accept_invitation', [invite_token])).rejects.toThrow(/invite_revoked/)
  })

  it('rejects made-up links and requires a display name', async () => {
    await expect(rpc(PARTNER, 'accept_invitation', ['nope'])).rejects.toThrow(/invite_not_found/)
    const { invite_token } = await newSpace()
    await expect(rpc(NONAME, 'accept_invitation', [invite_token])).rejects.toThrow(/profile_required/)
    await expect(rpc(null, 'accept_invitation', [invite_token])).rejects.toThrow(/permission denied/)
  })
})

describe('rotate_invitation', () => {
  it('makes a new link and kills the old one', async () => {
    const { space_id, invite_token: oldToken } = await newSpace()
    const { invite_token: newToken } = await rpc<{ invite_token: string }>(OWNER, 'rotate_invitation', [space_id])
    expect(newToken).not.toBe(oldToken)
    await expect(rpc(PARTNER, 'accept_invitation', [oldToken])).rejects.toThrow(/invite_revoked/)
    expect(await rpc(PARTNER, 'accept_invitation', [newToken])).toMatchObject({ space_id })
  })

  it('only works for members', async () => {
    const { space_id } = await newSpace()
    await expect(rpc(THIRD, 'rotate_invitation', [space_id])).rejects.toThrow(/not_member/)
    await expect(rpc(THIRD, 'revoke_invitation', [space_id])).rejects.toThrow(/not_member/)
  })
})

describe('privacy between spaces and outsiders', () => {
  it('outsiders see nothing: no spaces, members, invites or names', async () => {
    const { invite_token } = await newSpace()
    await rpc(PARTNER, 'accept_invitation', [invite_token])
    expect(await rows(THIRD, 'select * from public.spaces')).toEqual([])
    expect(await rows(THIRD, 'select * from public.space_members')).toEqual([])
    expect(await rows(THIRD, 'select id from public.invitations')).toEqual([])
    expect(await rows(THIRD, 'select display_name from public.profiles')).toEqual([{ display_name: 'Stranger' }])
  })

  it('two spaces never see each other’s data', async () => {
    const mine = await newSpace('mine')
    await as(db, THIRD)
    const theirs = await rpc<{ space_id: string }>(THIRD, 'create_space', ['theirs'])
    expect(await rows(OWNER, 'select title from public.spaces')).toEqual([{ title: 'mine' }])
    expect(await rows(THIRD, 'select title from public.spaces')).toEqual([{ title: 'theirs' }])
    expect(mine.space_id).not.toBe(theirs.space_id)
  })

  it('nobody can read token hashes', async () => {
    await newSpace()
    await expect(rows(OWNER, 'select token_hash from public.invitations')).rejects.toThrow(/permission denied/)
  })

  it('clients cannot write spaces, members or invites directly', async () => {
    const { space_id } = await newSpace()
    await expect(
      rows(THIRD, 'insert into public.space_members (space_id, user_id) values ($1, $2)', [space_id, THIRD]),
    ).rejects.toThrow(/permission denied/)
    await expect(rows(OWNER, `insert into public.spaces (created_by) values ($1)`, [OWNER])).rejects.toThrow(
      /permission denied/,
    )
    await expect(rows(OWNER, `update public.spaces set status = 'closed'`)).rejects.toThrow(/permission denied/)
    await expect(rows(OWNER, 'delete from public.invitations')).rejects.toThrow(/permission denied/)
  })

  it('members can rename their space; outsiders cannot', async () => {
    const { space_id } = await newSpace()
    await rows(OWNER, `update public.spaces set title = 'renamed' where id = $1`, [space_id])
    await as(db, THIRD)
    const res = await db.query(`update public.spaces set title = 'hijack' where id = $1`, [space_id])
    expect(res.affectedRows).toBe(0)
    expect(await rows(OWNER, 'select title from public.spaces')).toEqual([{ title: 'renamed' }])
  })

  it('anonymous visitors can only use the invite preview', async () => {
    const { space_id } = await newSpace()
    await expect(rows(null, 'select * from public.spaces')).rejects.toThrow(/permission denied/)
    await expect(rpc(null, 'leave_space', [space_id])).rejects.toThrow(/permission denied/)
    await expect(rpc(null, 'rotate_invitation', [space_id])).rejects.toThrow(/permission denied/)
  })
})

describe('leave_space', () => {
  it('when one person leaves, they lose access and the space closes for the other', async () => {
    const { space_id, invite_token } = await newSpace()
    await rpc(PARTNER, 'accept_invitation', [invite_token])
    expect(await rpc(PARTNER, 'leave_space', [space_id])).toEqual({ deleted: false })

    expect(await rows(PARTNER, 'select * from public.spaces')).toEqual([])
    expect(await rows(OWNER, 'select status from public.spaces')).toEqual([{ status: 'closed' }])
    // The leaver's name is no longer visible to the remaining member.
    expect(await rows(OWNER, 'select display_name from public.profiles')).toEqual([{ display_name: 'Abhi' }])
    // Nobody can get a new link into a closed space.
    await expect(rpc(OWNER, 'rotate_invitation', [space_id])).rejects.toThrow(/space_closed/)
  })

  it('when the last person leaves, the space is deleted', async () => {
    const { space_id, invite_token } = await newSpace()
    expect(await rpc(OWNER, 'leave_space', [space_id])).toEqual({ deleted: true })
    await asAdmin(db)
    expect((await db.query('select * from public.spaces')).rows).toEqual([])
    expect((await db.query('select * from public.invitations')).rows).toEqual([])
    expect(await rpc(PARTNER, 'get_invitation', [invite_token])).toEqual({ status: 'not_found' })
  })

  it('cancels any open invite', async () => {
    const { space_id, invite_token } = await newSpace()
    await asAdmin(db)
    // Keep a second member so the space survives and the invite can be inspected.
    await db.query('insert into public.space_members (space_id, user_id) values ($1, $2)', [space_id, THIRD])
    await rpc(OWNER, 'leave_space', [space_id])
    expect(await rpc(PARTNER, 'get_invitation', [invite_token])).toEqual({ status: 'revoked' })
  })

  it('only members can leave', async () => {
    const { space_id } = await newSpace()
    await expect(rpc(THIRD, 'leave_space', [space_id])).rejects.toThrow(/not_member/)
  })
})
