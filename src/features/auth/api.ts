import { getSupabase } from '@/lib/supabase'

/** Emails a one-time sign-in code. Creates the account on first use. */
export async function sendSignInCode(email: string): Promise<void> {
  const { error } = await getSupabase().auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  })
  if (error) throw error
}

export async function verifySignInCode(email: string, token: string): Promise<void> {
  const { error } = await getSupabase().auth.verifyOtp({ email, token, type: 'email' })
  if (error) throw error
}

export async function signOut(): Promise<void> {
  // 'local' signs out this device only; other devices stay signed in.
  const { error } = await getSupabase().auth.signOut({ scope: 'local' })
  if (error) throw error
}
