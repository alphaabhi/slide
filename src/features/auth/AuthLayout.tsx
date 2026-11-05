import { Outlet } from 'react-router'
import { env } from '@/lib/env'
import { AuthProvider } from './AuthProvider'

/**
 * Wraps every route that talks to Supabase. Lazy-loaded, so the landing page
 * never downloads the Supabase client.
 */
export default function AuthLayout() {
  if (!env.hasSupabase) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[var(--content-max)] flex-col justify-center px-gutter">
        <h1 className="text-2xl">SLIDE isn’t connected yet</h1>
        <p className="mt-3 text-fg-muted">
          {import.meta.env.DEV
            ? 'Copy .env.example to .env.local and add the Supabase project URL and publishable key.'
            : 'We’re finishing setup. Please try again shortly.'}
        </p>
      </main>
    )
  }
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  )
}
