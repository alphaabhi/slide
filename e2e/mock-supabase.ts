import type { Page, Route } from '@playwright/test'

/**
 * An in-memory stand-in for the Supabase Auth, REST and RPC endpoints this app
 * uses, so browser tests can run real multi-person journeys without a network
 * or real emails. One Backend can be shared by several browser pages (two
 * people in a space). The real database rules are tested in supabase/tests;
 * this mock mirrors their outcomes closely enough to drive the UI.
 */
export const MOCK_SUPABASE_URL = 'https://e2e-mock.supabase.co'
export const VALID_CODE = '424242'

const b64url = (obj: object) => Buffer.from(JSON.stringify(obj)).toString('base64url')

interface MockSpace {
  id: string
  title: string | null
  status: 'active' | 'closed'
  created_by: string
  created_at: string
  members: { user_id: string; joined_at: string }[]
}

interface MockInvite {
  token: string
  space_id: string
  created_by: string
  expires_at: string
  revoked_at: string | null
  accepted_at: string | null
}

export class Backend {
  usersByEmail = new Map<string, string>()
  profiles = new Map<string, string>()
  spaces = new Map<string, MockSpace>()
  invites: MockInvite[] = []
  codesSent = 0
  failNextSend?: 'rate_limit' | 'email_refused'
  private seq = 0

  userFor(email: string, id?: string): string {
    const existing = this.usersByEmail.get(email)
    if (existing) return existing
    const uid = id ?? `00000000-0000-4000-8000-${String(++this.seq).padStart(12, '0')}`
    this.usersByEmail.set(email, uid)
    return uid
  }

  profileOf(email: string): string | undefined {
    const id = this.usersByEmail.get(email)
    return id ? this.profiles.get(id) : undefined
  }

  private newId() {
    return `aaaaaaaa-0000-4000-8000-${String(++this.seq).padStart(12, '0')}`
  }

  private newToken() {
    return `tok${++this.seq}_${'x'.repeat(36)}`.slice(0, 43)
  }

  // ---- RPCs (mirroring supabase/migrations/*_spaces_and_invitations.sql) ----

  rpc(fn: string, uid: string | null, args: Record<string, unknown>): unknown {
    const fail = (code: string) => {
      throw new RpcError(code)
    }
    const now = Date.now()
    const openInvite = (spaceId: string) =>
      this.invites.find((i) => i.space_id === spaceId && !i.revoked_at && !i.accepted_at)

    switch (fn) {
      case 'create_space': {
        if (!uid) fail('not_signed_in')
        if (!this.profiles.has(uid!)) fail('profile_required')
        const raw = (args.p_title as string | null) ?? ''
        const title = raw.replace(/\s+/g, ' ').trim() || null
        const space: MockSpace = {
          id: this.newId(),
          title,
          status: 'active',
          created_by: uid!,
          created_at: new Date(now + this.seq).toISOString(),
          members: [{ user_id: uid!, joined_at: new Date().toISOString() }],
        }
        this.spaces.set(space.id, space)
        const token = this.newToken()
        this.invites.push({
          token,
          space_id: space.id,
          created_by: uid!,
          expires_at: new Date(now + 7 * 864e5).toISOString(),
          revoked_at: null,
          accepted_at: null,
        })
        return { space_id: space.id, invite_token: token }
      }
      case 'get_invitation': {
        const inv = this.invites.find((i) => i.token === args.p_token)
        if (!inv) return { status: 'not_found' }
        const space = this.spaces.get(inv.space_id)!
        if (uid && space.members.some((m) => m.user_id === uid)) {
          return { status: inv.created_by === uid ? 'own' : 'member', space_id: space.id }
        }
        if (inv.revoked_at) return { status: 'revoked' }
        if (inv.accepted_at) return { status: 'used' }
        if (new Date(inv.expires_at).getTime() <= now) return { status: 'expired' }
        if (space.status !== 'active') return { status: 'closed' }
        if (space.members.length >= 2) return { status: 'full' }
        return {
          status: 'valid',
          inviter_name: this.profiles.get(inv.created_by) ?? null,
          space_title: space.title,
          expires_at: inv.expires_at,
        }
      }
      case 'accept_invitation': {
        if (!uid) fail('not_signed_in')
        if (!this.profiles.has(uid!)) fail('profile_required')
        const inv = this.invites.find((i) => i.token === args.p_token)
        if (!inv) return fail('invite_not_found')
        const space = this.spaces.get(inv.space_id)!
        if (inv.created_by === uid) fail('invite_own')
        if (space.members.some((m) => m.user_id === uid))
          return { space_id: space.id, already_member: true }
        if (inv.revoked_at) fail('invite_revoked')
        if (inv.accepted_at) fail('invite_used')
        if (new Date(inv.expires_at).getTime() <= now) fail('invite_expired')
        if (space.status !== 'active') fail('space_closed')
        if (space.members.length >= 2) fail('space_full')
        space.members.push({ user_id: uid!, joined_at: new Date().toISOString() })
        inv.accepted_at = new Date().toISOString()
        return { space_id: space.id, already_member: false }
      }
      case 'rotate_invitation':
      case 'revoke_invitation': {
        const space = this.spaces.get(args.p_space_id as string)
        if (!uid || !space || !space.members.some((m) => m.user_id === uid))
          return fail('not_member')
        if (fn === 'rotate_invitation') {
          if (space.status !== 'active') fail('space_closed')
          if (space.members.length >= 2) fail('space_full')
        }
        const open = openInvite(space.id)
        if (open) open.revoked_at = new Date().toISOString()
        if (fn === 'revoke_invitation') return null
        const token = this.newToken()
        const expires_at = new Date(now + 7 * 864e5).toISOString()
        this.invites.push({
          token,
          space_id: space.id,
          created_by: uid,
          expires_at,
          revoked_at: null,
          accepted_at: null,
        })
        return { invite_token: token, expires_at }
      }
      case 'leave_space': {
        const space = this.spaces.get(args.p_space_id as string)
        if (!uid || !space || !space.members.some((m) => m.user_id === uid))
          return fail('not_member')
        space.members = space.members.filter((m) => m.user_id !== uid)
        const open = openInvite(space.id)
        if (open) open.revoked_at = new Date().toISOString()
        if (space.members.length === 0) {
          this.spaces.delete(space.id)
          this.invites = this.invites.filter((i) => i.space_id !== space.id)
          return { deleted: true }
        }
        space.status = 'closed'
        return { deleted: false }
      }
    }
    throw new Error(`mock: unknown rpc ${fn}`)
  }

  spaceRowsFor(uid: string, onlyId?: string) {
    return [...this.spaces.values()]
      .filter((s) => s.members.some((m) => m.user_id === uid) && (!onlyId || s.id === onlyId))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((s) => ({
        id: s.id,
        title: s.title,
        status: s.status,
        created_at: s.created_at,
        created_by: s.created_by,
        space_members: s.members.map((m) => ({
          user_id: m.user_id,
          joined_at: m.joined_at,
          profiles: { display_name: this.profiles.get(m.user_id) ?? 'Someone' },
        })),
        invitations: this.invites
          .filter((i) => i.space_id === s.id)
          .map(({ expires_at, revoked_at, accepted_at }) => ({
            expires_at,
            revoked_at,
            accepted_at,
          })),
      }))
  }
}

class RpcError extends Error {}

function userFromAuthHeader(header: string | undefined): string | null {
  const token = header?.replace(/^Bearer\s+/i, '') ?? ''
  const parts = token.split('.')
  if (parts.length !== 3) return null // the publishable key: anonymous
  try {
    return (
      (JSON.parse(Buffer.from(parts[1]!, 'base64url').toString()) as { sub?: string }).sub ?? null
    )
  } catch {
    return null
  }
}

/** Route one browser page's Supabase traffic to a (possibly shared) backend. */
export async function attachBackend(page: Page, backend: Backend): Promise<void> {
  const json = (route: Route, status: number, body: unknown) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

  await page.route(`${MOCK_SUPABASE_URL}/auth/v1/**`, async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/otp')) {
      if (backend.failNextSend === 'rate_limit') {
        backend.failNextSend = undefined
        return json(route, 429, { code: 'over_email_send_rate_limit', msg: 'rate limit' })
      }
      if (backend.failNextSend === 'email_refused') {
        backend.failNextSend = undefined
        return json(route, 500, {
          code: 'unexpected_failure',
          msg: 'Error sending magic link email',
        })
      }
      backend.codesSent++
      return json(route, 200, {})
    }
    if (url.pathname.endsWith('/verify')) {
      const body = route.request().postDataJSON() as { token?: string; email?: string }
      if (body.token !== VALID_CODE) {
        return json(route, 403, { code: 'otp_expired', msg: 'Token has expired or is invalid' })
      }
      const email = body.email ?? 'abhi@example.com'
      const id = backend.userFor(email)
      const now = Math.floor(Date.now() / 1000)
      const user = {
        id,
        aud: 'authenticated',
        role: 'authenticated',
        email,
        app_metadata: { provider: 'email' },
        user_metadata: {},
        created_at: new Date().toISOString(),
      }
      const access_token = [
        b64url({ alg: 'HS256', typ: 'JWT' }),
        b64url({
          sub: id,
          email,
          role: 'authenticated',
          aud: 'authenticated',
          exp: now + 3600,
          iat: now,
        }),
        'signature',
      ].join('.')
      return json(route, 200, {
        access_token,
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: now + 3600,
        refresh_token: `refresh-${id}`,
        user,
      })
    }
    if (url.pathname.endsWith('/logout')) return route.fulfill({ status: 204 })
    return json(route, 404, {})
  })

  await page.route(`${MOCK_SUPABASE_URL}/rest/v1/**`, async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const uid = userFromAuthHeader(req.headers()['authorization'])
    const wantsObject = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object')
    const one = (row: unknown) => {
      if (!wantsObject) return json(route, 200, row ? [row] : [])
      if (!row) {
        return json(route, 406, {
          code: 'PGRST116',
          message: 'JSON object requested, multiple (or no) rows returned',
          details: 'The result contains 0 rows',
        })
      }
      return json(route, 200, row)
    }

    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      const fn = url.pathname.split('/').pop()!
      try {
        const args = (req.postDataJSON() ?? {}) as Record<string, unknown>
        return json(route, 200, backend.rpc(fn, uid, args))
      } catch (e) {
        if (e instanceof RpcError) {
          return json(route, 400, { code: 'P0001', message: e.message, details: null, hint: null })
        }
        throw e
      }
    }

    if (url.pathname === '/rest/v1/profiles') {
      if (!uid) return json(route, 401, { message: 'permission denied' })
      if (req.method() === 'GET') {
        const name = backend.profiles.get(uid)
        return one(name ? { id: uid, display_name: name } : null)
      }
      const body = req.postDataJSON() as { display_name: string } | { display_name: string }[]
      const name = Array.isArray(body) ? body[0]!.display_name : body.display_name
      backend.profiles.set(uid, name)
      return one({ id: uid, display_name: name })
    }

    if (url.pathname === '/rest/v1/spaces') {
      if (!uid) return json(route, 401, { message: 'permission denied' })
      const idFilter = url.searchParams.get('id')?.replace(/^eq\./, '')
      const rows = backend.spaceRowsFor(uid, idFilter)
      return wantsObject ? one(rows[0] ?? null) : json(route, 200, rows)
    }

    return json(route, 404, { message: `mock: no route for ${url.pathname}` })
  })
}

/**
 * Single-person helper used by the sign-in tests: a fresh backend with
 * abhi@example.com as the user (optionally already named).
 */
export const ABHI_ID = '11111111-1111-4111-8111-111111111111'

export async function mockSupabase(
  page: Page,
  init: { profile?: { display_name: string }; failNextSend?: Backend['failNextSend'] } = {},
): Promise<Backend & { readonly profile: { display_name: string } | null }> {
  const backend = new Backend()
  backend.userFor('abhi@example.com', ABHI_ID)
  if (init.profile) backend.profiles.set(ABHI_ID, init.profile.display_name)
  backend.failNextSend = init.failNextSend
  await attachBackend(page, backend)
  // defineProperty (not Object.assign) so the getter stays live.
  return Object.defineProperty(backend, 'profile', {
    get: () => {
      const name = backend.profiles.get(ABHI_ID)
      return name ? { display_name: name } : null
    },
  }) as Backend & { readonly profile: { display_name: string } | null }
}
