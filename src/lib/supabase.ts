import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from './env'

let client: SupabaseClient | null = null

/**
 * Lazily created browser client using the public anon key. All access control is
 * enforced by Postgres row-level security, never by this client.
 */
export function getSupabase(): SupabaseClient {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    throw new Error('Supabase is not configured. Copy .env.example to .env.local and fill it in.')
  }
  client ??= createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  })
  return client
}
