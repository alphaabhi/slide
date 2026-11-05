import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'
import { Spinner } from '@/components/ui/Spinner'
import { ToastProvider } from '@/components/ui/Toast'
import { env } from '@/lib/env'
import { HomePage as LandingPage } from '@/pages/HomePage'
import { NotFoundPage } from '@/pages/NotFoundPage'

// Route-level code splitting: the landing page never downloads Supabase or the style guide.
const StyleguidePage = lazy(() => import('@/pages/StyleguidePage'))
const AuthLayout = lazy(() => import('@/features/auth/AuthLayout'))
const SignInPage = lazy(() => import('@/features/auth/SignInPage'))
const OnboardingPage = lazy(() => import('@/features/profile/OnboardingPage'))
const HomePage = lazy(() => import('@/features/home/HomePage'))
const RequireAuth = lazy(() =>
  import('@/features/auth/guards').then((m) => ({ default: m.RequireAuth })),
)
const RequireProfile = lazy(() =>
  import('@/features/auth/guards').then((m) => ({ default: m.RequireProfile })),
)

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 2, refetchOnWindowFocus: false },
    mutations: { retry: 0 },
  },
})

function PageFallback() {
  return (
    <div className="grid min-h-dvh place-items-center text-fg-muted">
      <Spinner label="Loading" className="size-6" />
    </div>
  )
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              {env.enableStyleguide ? (
                <Route path="/styleguide" element={<StyleguidePage />} />
              ) : null}

              <Route element={<AuthLayout />}>
                <Route path="/sign-in" element={<SignInPage />} />
                <Route
                  path="/welcome"
                  element={
                    <RequireAuth>
                      <OnboardingPage />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/home"
                  element={
                    <RequireAuth>
                      <RequireProfile>
                        <HomePage />
                      </RequireProfile>
                    </RequireAuth>
                  }
                />
              </Route>

              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  )
}
