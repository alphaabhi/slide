import type { Page, Route, WebSocketRoute } from '@playwright/test'

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

export interface MockMessage {
  id: string
  space_id: string
  sender_id: string
  client_id: string
  body: string
  created_at: string
}

export interface MockRound {
  id: string
  space_id: string
  kind: 'would_you_rather' | 'this_or_that' | 'question_of_the_day'
  prompt_key: string
  prompt: string
  option_a: string | null
  option_b: string | null
  started_by: string
  status: 'open' | 'revealed' | 'skipped'
  answered_by: string[]
  skipped_by: string | null
  created_at: string
}

interface MockResponse {
  round_id: string
  user_id: string
  choice: 'a' | 'b' | null
  answer: string | null
}

/** One browser's live-updates connection and the channels it has joined. */
interface LiveSocket {
  ws: WebSocketRoute
  uid: string | null
  subs: Map<string, { joinRef: string; spaceId: string; bindings: Map<string, number> }>
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
  /** Chosen avatar keys, by user id (absent = just the initial). */
  avatars = new Map<string, string | null>()
  spaces = new Map<string, MockSpace>()
  invites: MockInvite[] = []
  messages: MockMessage[] = []
  rounds: MockRound[] = []
  responses: MockResponse[] = []
  sockets = new Set<LiveSocket>()
  /** When true, live updates are down (simulates a dropped websocket). */
  liveDown = false
  /** When set, the next N send_message calls fail as if the network dropped. */
  failSends = 0
  codesSent = 0
  failNextSend?: 'rate_limit' | 'email_refused'
  private seq = 0
  private lastTs = 0

  private nextTimestamp() {
    this.lastTs = Math.max(Date.now(), this.lastTs + 1)
    return new Date(this.lastTs).toISOString()
  }

  /** Push a new message to every connected member of its space. */
  publish(m: MockMessage) {
    this.broadcast('messages', 'INSERT', m)
  }

  /** Push a round change (new, answered, revealed, skipped) to the space's members. */
  publishRound(r: MockRound, type: 'INSERT' | 'UPDATE') {
    this.broadcast('activity_rounds', type, r)
  }

  private broadcast(table: string, type: string, m: { space_id: string; created_at: string }) {
    if (this.liveDown) return
    const space = this.spaces.get(m.space_id)
    for (const sock of this.sockets) {
      for (const [topic, sub] of sock.subs) {
        if (sub.spaceId !== m.space_id) continue
        const bindingId = sub.bindings.get(table)
        if (bindingId === undefined) continue
        if (!sock.uid || !space?.members.some((x) => x.user_id === sock.uid)) continue
        const columns = Object.keys(m).map((name) => ({ name, type: 'text' }))
        sock.ws.send(
          JSON.stringify([
            sub.joinRef,
            null,
            topic,
            'postgres_changes',
            {
              ids: [bindingId],
              data: {
                schema: 'public',
                table,
                commit_timestamp: m.created_at,
                type,
                record: m,
                columns,
                errors: null,
              },
            },
          ]),
        )
      }
    }
  }

  /** Close every live connection (they'll try to reconnect; refused while liveDown). */
  dropLive() {
    this.liveDown = true
    for (const s of this.sockets) s.ws.close({ code: 1006, reason: 'test drop' })
    this.sockets.clear()
  }

  restoreLive() {
    this.liveDown = false
  }

  /** Insert a message directly (as if sent from another device). */
  addMessage(spaceId: string, senderId: string, body: string): MockMessage {
    const m: MockMessage = {
      id: this.newId(),
      space_id: spaceId,
      sender_id: senderId,
      client_id: crypto.randomUUID(),
      body,
      created_at: this.nextTimestamp(),
    }
    this.messages.push(m)
    this.publish(m)
    return m
  }

  messagesFor(uid: string, spaceId: string, before?: string, limit = 50) {
    const space = this.spaces.get(spaceId)
    if (!space?.members.some((m) => m.user_id === uid)) return []
    return this.messages
      .filter((m) => m.space_id === spaceId && (!before || m.created_at < before))
      .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))
      .slice(0, limit)
  }

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
          inviter_avatar: this.avatars.get(inv.created_by) ?? null,
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
      case 'send_message': {
        const spaceId = args.p_space_id as string
        const clientId = args.p_client_id as string
        const existing = this.messages.find(
          (m) => m.space_id === spaceId && m.client_id === clientId,
        )
        if (existing) return existing
        const space = this.spaces.get(spaceId)
        if (!uid || !space || !space.members.some((m) => m.user_id === uid))
          return fail('not_member')
        if (space.status !== 'active') fail('space_closed')
        const body = String(args.p_body ?? '').trim()
        if (!body) fail('message_empty')
        if (body.length > 4000) fail('message_too_long')
        const m: MockMessage = {
          id: this.newId(),
          space_id: spaceId,
          sender_id: uid,
          client_id: clientId,
          body,
          created_at: this.nextTimestamp(),
        }
        this.messages.push(m)
        this.publish(m)
        return m
      }
      case 'start_round': {
        const space = this.spaces.get(args.p_space_id as string)
        if (!uid || !space || !space.members.some((m) => m.user_id === uid))
          return fail('not_member')
        if (space.status !== 'active') fail('space_closed')
        if (space.members.length < 2) fail('space_waiting')
        const kind = args.p_kind as MockRound['kind']
        const open = this.rounds.find(
          (r) => r.space_id === space.id && r.kind === kind && r.status === 'open',
        )
        if (open) return open
        if (kind === 'question_of_the_day') {
          const today = this.rounds.find(
            (r) =>
              r.space_id === space.id &&
              r.kind === kind &&
              now - new Date(r.created_at).getTime() < 20 * 3600_000,
          )
          if (today) return today
        }
        const round: MockRound = {
          id: this.newId(),
          space_id: space.id,
          kind,
          prompt_key: args.p_prompt_key as string,
          prompt: String(args.p_prompt).trim(),
          option_a: kind === 'question_of_the_day' ? null : (args.p_option_a as string),
          option_b: kind === 'question_of_the_day' ? null : (args.p_option_b as string),
          started_by: uid,
          status: 'open',
          answered_by: [],
          skipped_by: null,
          created_at: this.nextTimestamp(),
        }
        this.rounds.push(round)
        this.publishRound(round, 'INSERT')
        return round
      }
      case 'answer_round': {
        const round = this.rounds.find((r) => r.id === args.p_round_id)
        const space = round && this.spaces.get(round.space_id)
        if (!uid || !round || !space?.members.some((m) => m.user_id === uid))
          return fail('not_member')
        if (round.answered_by.includes(uid)) return round
        if (round.status !== 'open') fail('round_closed')
        if (space.status !== 'active') fail('space_closed')
        if (round.kind === 'question_of_the_day') {
          const text = String(args.p_answer ?? '').trim()
          if (!text) fail('answer_empty')
          if (text.length > 500) fail('answer_too_long')
          this.responses.push({ round_id: round.id, user_id: uid, choice: null, answer: text })
        } else {
          const choice = args.p_choice as 'a' | 'b'
          if (choice !== 'a' && choice !== 'b') fail('activity_invalid')
          this.responses.push({ round_id: round.id, user_id: uid, choice, answer: null })
        }
        round.answered_by = [...round.answered_by, uid]
        if (round.answered_by.length >= 2) round.status = 'revealed'
        this.publishRound(round, 'UPDATE')
        return round
      }
      case 'skip_round': {
        const round = this.rounds.find((r) => r.id === args.p_round_id)
        const space = round && this.spaces.get(round.space_id)
        if (!uid || !round || !space?.members.some((m) => m.user_id === uid))
          return fail('not_member')
        if (round.status !== 'open') return round
        round.status = 'skipped'
        round.skipped_by = uid
        this.publishRound(round, 'UPDATE')
        return round
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
          this.messages = this.messages.filter((m) => m.space_id !== space.id)
          const gone = new Set(this.rounds.filter((r) => r.space_id === space.id).map((r) => r.id))
          this.rounds = this.rounds.filter((r) => !gone.has(r.id))
          this.responses = this.responses.filter((r) => !gone.has(r.round_id))
          return { deleted: true }
        }
        space.status = 'closed'
        return { deleted: false }
      }
    }
    throw new Error(`mock: unknown rpc ${fn}`)
  }

  /** Rounds as the database would return them to this person (RLS applied to answers). */
  roundRowsFor(uid: string, spaceId: string) {
    const space = this.spaces.get(spaceId)
    if (!space?.members.some((m) => m.user_id === uid)) return []
    return this.rounds
      .filter((r) => r.space_id === spaceId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 100)
      .map((r) => ({
        ...r,
        activity_responses: this.responses
          .filter((x) => x.round_id === r.id && (x.user_id === uid || r.status === 'revealed'))
          .map(({ user_id, choice, answer }) => ({ user_id, choice, answer })),
      }))
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
          profiles: {
            display_name: this.profiles.get(m.user_id) ?? 'Someone',
            avatar: this.avatars.get(m.user_id) ?? null,
          },
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
  await routeRealtime(page, backend)
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
      if (fn === 'send_message' && backend.failSends > 0) {
        backend.failSends--
        return route.abort('internetdisconnected')
      }
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
        return one(
          name ? { id: uid, display_name: name, avatar: backend.avatars.get(uid) ?? null } : null,
        )
      }
      type Body = { display_name: string; avatar?: string | null }
      const raw = req.postDataJSON() as Body | Body[]
      const body = Array.isArray(raw) ? raw[0]! : raw
      // Same rule as the database's check constraint.
      if (body.avatar != null && !AVATAR_KEYS.includes(body.avatar)) {
        return json(route, 400, { code: '23514', message: 'new row violates check constraint' })
      }
      backend.profiles.set(uid, body.display_name)
      if ('avatar' in body) backend.avatars.set(uid, body.avatar ?? null)
      return one({
        id: uid,
        display_name: body.display_name,
        avatar: backend.avatars.get(uid) ?? null,
      })
    }

    if (url.pathname === '/rest/v1/messages') {
      if (!uid) return json(route, 401, { message: 'permission denied' })
      const spaceId = url.searchParams.get('space_id')?.replace(/^eq\./, '') ?? ''
      const before = url.searchParams.get('created_at')?.replace(/^lt\./, '')
      const limit = Number(url.searchParams.get('limit') ?? 50)
      return json(route, 200, backend.messagesFor(uid, spaceId, before, limit))
    }

    if (url.pathname === '/rest/v1/activity_rounds') {
      if (!uid) return json(route, 401, { message: 'permission denied' })
      const spaceId = url.searchParams.get('space_id')?.replace(/^eq\./, '') ?? ''
      return json(route, 200, backend.roundRowsFor(uid, spaceId))
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
 * Speaks enough of Supabase Realtime's protocol (Phoenix channels, JSON v2:
 * [join_ref, ref, topic, event, payload]) for the app's live messages.
 */
async function routeRealtime(page: Page, backend: Backend) {
  const host = new URL(MOCK_SUPABASE_URL).host
  await page.routeWebSocket(
    new RegExp(`^wss://${host.replace(/\./g, '\\.')}/realtime/v1/websocket`),
    (ws) => {
      if (backend.liveDown) {
        ws.close({ code: 1006, reason: 'down' })
        return
      }
      const sock: LiveSocket = { ws, uid: null, subs: new Map() }
      backend.sockets.add(sock)
      let bindingSeq = 100
      const reply = (joinRef: string | null, ref: string, topic: string, response: object = {}) =>
        ws.send(JSON.stringify([joinRef, ref, topic, 'phx_reply', { status: 'ok', response }]))

      ws.onMessage((raw) => {
        const [joinRef, ref, topic, event, payload] = JSON.parse(String(raw)) as [
          string | null,
          string,
          string,
          string,
          Record<string, unknown>,
        ]
        if (event === 'heartbeat') return reply(null, ref, topic)
        if (event === 'access_token') {
          sock.uid = userFromAuthHeader(`Bearer ${String(payload.access_token ?? '')}`) ?? sock.uid
          return reply(joinRef, ref, topic)
        }
        if (event === 'phx_join') {
          sock.uid = userFromAuthHeader(`Bearer ${String(payload.access_token ?? '')}`) ?? sock.uid
          const config = (payload.config ?? {}) as {
            postgres_changes?: { filter?: string; table?: string }[]
          }
          const changes = (config.postgres_changes ?? []).map((c) => ({ ...c, id: ++bindingSeq }))
          const first = changes[0]
          const spaceId = first?.filter?.replace(/^space_id=eq\./, '') ?? ''
          if (first) {
            const bindings = new Map(changes.map((c) => [c.table ?? '', c.id]))
            sock.subs.set(topic, { joinRef: joinRef ?? '', spaceId, bindings })
          }
          return reply(joinRef, ref, topic, { postgres_changes: changes })
        }
        if (event === 'phx_leave') {
          sock.subs.delete(topic)
          return reply(joinRef, ref, topic)
        }
        return reply(joinRef, ref, topic)
      })
      ws.onClose(() => backend.sockets.delete(sock))
    },
  )
}

/**
 * Single-person helper used by the sign-in tests: a fresh backend with
 * abhi@example.com as the user (optionally already named).
 */
const AVATAR_KEYS: (string | null)[] = [
  'kai',
  'rin',
  'haru',
  'sora',
  'mika',
  'jin',
  'yuna',
  'ren',
  'aiko',
  'taro',
  'nori',
  'emi',
]

export const ABHI_ID = '11111111-1111-4111-8111-111111111111'

export async function mockSupabase(
  page: Page,
  init: { profile?: { display_name: string }; failNextSend?: Backend['failNextSend'] } = {},
): Promise<Backend & { readonly profile: { display_name: string; avatar: string | null } | null }> {
  const backend = new Backend()
  backend.userFor('abhi@example.com', ABHI_ID)
  if (init.profile) backend.profiles.set(ABHI_ID, init.profile.display_name)
  backend.failNextSend = init.failNextSend
  await attachBackend(page, backend)
  // defineProperty (not Object.assign) so the getter stays live.
  return Object.defineProperty(backend, 'profile', {
    get: () => {
      const name = backend.profiles.get(ABHI_ID)
      return name ? { display_name: name, avatar: backend.avatars.get(ABHI_ID) ?? null } : null
    },
  }) as Backend & { readonly profile: { display_name: string; avatar: string | null } | null }
}
