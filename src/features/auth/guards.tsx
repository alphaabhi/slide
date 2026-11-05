import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useMyProfile } from '@/features/profile/api'
import { useAuth, useSession } from './AuthProvider'

export function FullPageSpinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="grid min-h-dvh place-items-center text-fg-muted">
      <Spinner label={label} className="size-6" />
    </div>
  )
}

function currentPath(loc: { pathname: string; search: string }) {
  return encodeURIComponent(loc.pathname + loc.search)
}

/** Signed-in only. Everyone else is sent to sign in, then brought back here. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { state } = useAuth()
  const location = useLocation()
  if (state.status === 'loading') return <FullPageSpinner />
  if (state.status === 'signed-out') {
    return <Navigate to={`/sign-in?next=${currentPath(location)}`} replace />
  }
  return <>{children}</>
}

/** Signed-in and has chosen a display name. */
export function RequireProfile({ children }: { children: ReactNode }) {
  const session = useSession()
  const location = useLocation()
  const profile = useMyProfile(session.user.id)

  if (profile.isPending) return <FullPageSpinner />
  if (profile.isError) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[var(--content-max)] flex-col justify-center px-gutter">
        <h1 className="text-2xl">Couldn’t load your account</h1>
        <p className="mt-3 text-fg-muted">Check your connection, then try again.</p>
        <Button
          className="mt-6 w-fit"
          loading={profile.isFetching}
          onClick={() => void profile.refetch()}
        >
          Try again
        </Button>
      </main>
    )
  }
  if (!profile.data) return <Navigate to={`/welcome?next=${currentPath(location)}`} replace />
  return <>{children}</>
}
