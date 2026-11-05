import { z } from 'zod'

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Enter your email address.')
  .max(254, 'That email address is too long.')
  .pipe(z.email('Enter a valid email address, like you@example.com.'))

/** Supabase email codes are 6 digits by default; allow up to 10 in case the project setting changes. */
export const codeSchema = z
  .string()
  .transform((v) => v.replace(/\s+/g, ''))
  .pipe(z.string().regex(/^\d{6,10}$/, 'Enter the code from the email. It’s numbers only.'))

/** Same rules as the database constraints in supabase/migrations/*_profiles.sql. */
export const displayNameSchema = z
  .string()
  .transform((v) => v.replace(/\s+/g, ' ').trim())
  .pipe(
    z
      .string()
      .min(1, 'Enter a name. It’s what the other person will see.')
      .max(40, 'Keep it to 40 characters or fewer.')
      // eslint-disable-next-line no-control-regex
      .regex(/^[^\u0000-\u001f\u007f]*$/, 'Use letters, numbers, spaces and emoji only.'),
  )

export function firstError(result: { success: boolean; error?: z.ZodError }): string | undefined {
  return result.success ? undefined : result.error?.issues[0]?.message
}

/** Only allow redirects back into this app (blocks "//evil.com" and absolute URLs). */
export function safeNext(next: string | null | undefined, fallback = '/home'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\'))
    return fallback
  return next
}
