import type { Page, Route } from '@playwright/test'

/**
 * A tiny in-memory stand-in for the Supabase Auth + REST endpoints this app uses,
 * so browser tests can run the real UI flow without a network or real emails.
 * Database rules themselves are tested separately in supabase/tests.
 */
export const MOCK_SUPABASE_URL = 'https://e2e-mock.supabase.co'
export const VALID_CODE = '424242'

function b64url(obj: object) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url')
}

export interface MockState {
  profile: { id: string; display_name: string } | null
  codesSent: number
  failNextSend?: 'rate_limit' | 'email_refused'
}

export async function mockSupabase(page: Page, init: Partial<MockState> = {}): Promise<MockState> {
  const state: MockState = { profile: null, codesSent: 0, ...init }
  const userId = '11111111-1111-4111-8111-111111111111'
  const email = 'abhi@example.com'
  const now = Math.floor(Date.now() / 1000)
  const user = {
    id: userId,
    aud: 'authenticated',
    role: 'authenticated',
    email,
    app_metadata: { provider: 'email' },
    user_metadata: {},
    created_at: new Date().toISOString(),
  }
  const accessToken = [
    b64url({ alg: 'HS256', typ: 'JWT' }),
    b64url({
      sub: userId,
      email,
      role: 'authenticated',
      aud: 'authenticated',
      exp: now + 3600,
      iat: now,
    }),
    'signature',
  ].join('.')

  const json = (route: Route, status: number, body: unknown) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

  await page.route(`${MOCK_SUPABASE_URL}/auth/v1/**`, async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/otp')) {
      if (state.failNextSend === 'rate_limit') {
        state.failNextSend = undefined
        return json(route, 429, { code: 'over_email_send_rate_limit', msg: 'rate limit' })
      }
      if (state.failNextSend === 'email_refused') {
        state.failNextSend = undefined
        return json(route, 500, {
          code: 'unexpected_failure',
          msg: 'Error sending magic link email',
        })
      }
      state.codesSent++
      return json(route, 200, {})
    }
    if (url.pathname.endsWith('/verify')) {
      const body = route.request().postDataJSON() as { token?: string }
      if (body.token !== VALID_CODE) {
        return json(route, 403, { code: 'otp_expired', msg: 'Token has expired or is invalid' })
      }
      return json(route, 200, {
        access_token: accessToken,
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: now + 3600,
        refresh_token: 'refresh-token',
        user,
      })
    }
    if (url.pathname.endsWith('/logout')) return route.fulfill({ status: 204 })
    if (url.pathname.endsWith('/user')) return json(route, 200, user)
    return json(route, 404, {})
  })

  await page.route(`${MOCK_SUPABASE_URL}/rest/v1/profiles**`, async (route) => {
    const req = route.request()
    const wantsObject = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object')
    const respond = (row: MockState['profile']) => {
      if (wantsObject) {
        if (!row) {
          return json(route, 406, {
            code: 'PGRST116',
            message: 'JSON object requested, multiple (or no) rows returned',
            details: 'The result contains 0 rows',
          })
        }
        return json(route, 200, row)
      }
      return json(route, 200, row ? [row] : [])
    }
    if (req.method() === 'GET') return respond(state.profile)
    if (req.method() === 'POST' || req.method() === 'PATCH') {
      const body = req.postDataJSON() as { display_name: string } | { display_name: string }[]
      const name = Array.isArray(body) ? body[0]!.display_name : body.display_name
      state.profile = { id: userId, display_name: name }
      return respond(state.profile)
    }
    return json(route, 405, {})
  })

  return state
}
