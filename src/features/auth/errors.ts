/**
 * Turns Supabase Auth / PostgREST errors into plain-language messages.
 * Never surfaces raw server text, which can leak internals.
 */
interface MaybeAuthError {
  code?: string
  status?: number
  name?: string
  message?: string
}

export function authErrorMessage(error: unknown): string {
  const e = (error ?? {}) as MaybeAuthError
  const code = e.code ?? ''

  if (e.name === 'AuthRetryableFetchError' || e.status === 0 || e.name === 'TypeError') {
    return 'Can’t reach SLIDE right now. Check your connection and try again.'
  }
  if (
    code === 'over_email_send_rate_limit' ||
    code === 'over_request_rate_limit' ||
    e.status === 429
  ) {
    return 'Too many attempts. Wait a minute, then try again.'
  }
  if (code === 'otp_expired' || /expired|invalid/i.test(e.message ?? '')) {
    return 'That code is wrong or has expired. Check the latest email, or send a new code.'
  }
  if (code === 'email_address_invalid' || code === 'validation_failed') {
    return 'Enter a valid email address, like you@example.com.'
  }
  if (code === 'signup_disabled' || code === 'otp_disabled' || code === 'email_provider_disabled') {
    return 'Sign-in is switched off right now. Please try again later.'
  }
  return 'Something went wrong. Please try again.'
}

export function profileErrorMessage(error: unknown): string {
  const e = (error ?? {}) as MaybeAuthError
  if (e.code === '23514')
    return 'That name isn’t allowed. Use 1–40 letters, numbers, spaces or emoji.'
  if (e.name === 'TypeError' || e.status === 0) {
    return 'Can’t reach SLIDE right now. Check your connection and try again.'
  }
  return 'Couldn’t save your name. Please try again.'
}
