import type { Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useToast } from '@/components/ui/Toast'
import { getSupabase } from '@/lib/supabase'
import { signOut as apiSignOut } from './api'

type AuthState =
  | { status: 'loading'; session: null }
  | { status: 'signed-out'; session: null }
  | { status: 'signed-in'; session: Session }

interface AuthContextValue {
  state: AuthState
  /** Sign out this device. Resolves once local state is cleared. */
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

// eslint-disable-next-line react/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

/** The signed-in user. Only call inside routes guarded by <RequireAuth>. */
// eslint-disable-next-line react/only-export-components
export function useSession(): Session {
  const { state } = useAuth()
  if (state.status !== 'signed-in') throw new Error('useSession requires a signed-in user')
  return state.session
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading', session: null })
  const queryClient = useQueryClient()
  const toast = useToast()
  const signingOut = useRef(false)
  const wasSignedIn = useRef(false)

  useEffect(() => {
    const supabase = getSupabase()
    const lifecycle = { active: true }

    const apply = (session: Session | null) => {
      if (!lifecycle.active) return
      if (session) {
        wasSignedIn.current = true
        setState({ status: 'signed-in', session })
      } else {
        setState({ status: 'signed-out', session: null })
      }
    }

    void supabase.auth.getSession().then(({ data }) => apply(data.session))

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        // Private data must not outlive the session in memory.
        queryClient.clear()
        if (wasSignedIn.current && !signingOut.current) {
          toast.show({
            title: 'You’ve been signed out',
            description: 'Your session ended. Sign in again to continue.',
          })
        }
        wasSignedIn.current = false
        signingOut.current = false
      }
      apply(session)
    })

    return () => {
      lifecycle.active = false
      sub.subscription.unsubscribe()
    }
  }, [queryClient, toast])

  const signOut = useCallback(async () => {
    signingOut.current = true
    try {
      await apiSignOut()
    } finally {
      queryClient.clear()
      setState({ status: 'signed-out', session: null })
    }
  }, [queryClient])

  const value = useMemo(() => ({ state, signOut }), [state, signOut])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
