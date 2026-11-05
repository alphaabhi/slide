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

  // Only a request that never got an answer is a connection problem.
  if (
    e.status === 0 ||
    e.name === 'TypeError' ||
    (e.name === 'AuthRetryableFetchError' && !e.status)
  ) {
    return 'Can’t reach SLIDE right now. Check your connection and try again.'
  }
  // The server answered but couldn't send the email (e.g. the email service refused the address).
  if ((e.status ?? 0) >= 500 && /send|email|smtp/i.test(e.message ?? '')) {
    return 'We couldn’t send a code to that address. Check it’s typed correctly, or try a different email.'
  }
  if ((e.status ?? 0) >= 500) {
    return 'SLIDE’s sign-in service had a problem. Please try again in a minute.'
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
