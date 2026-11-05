import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'
import { BrandLoader } from '@/components/BrandLoader'
import { ToastProvider } from '@/components/ui/Toast'
import { env } from '@/lib/env'
import { authArea } from './routes'
import { ErrorBoundary } from './ErrorBoundary'
import { HomePage as LandingPage } from '@/pages/HomePage'
import { NotFoundPage } from '@/pages/NotFoundPage'

// Route-level code splitting: the landing page never waits for Supabase or the style guide.
const StyleguidePage = lazy(() => import('@/pages/StyleguidePage'))
const AuthLayout = lazy(authArea.layout)
const SignInPage = lazy(authArea.signIn)
const OnboardingPage = lazy(authArea.onboarding)
const HomePage = lazy(authArea.home)
const SpacePage = lazy(authArea.space)
const JoinPage = lazy(authArea.join)
const InviteLinkRedirect = lazy(() =>
  authArea.join().then((m) => ({ default: m.InviteLinkRedirect })),
)

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
      // Quick first retry on flaky mobile networks: 400 ms, 800 ms (default waits 1 s, 2 s).
      retryDelay: (attempt) => Math.min(400 * 2 ** attempt, 3000),
      refetchOnWindowFocus: false,
    },
    mutations: { retry: 0 },
  },
})

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ErrorBoundary>
          <BrowserRouter>
            <Suspense fallback={<BrandLoader />}>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                {env.enableStyleguide ? (
                  <Route path="/styleguide" element={<StyleguidePage />} />
                ) : null}

                <Route element={<AuthLayout />}>
                  <Route path="/sign-in" element={<SignInPage />} />
                  {/* Each page applies its own sign-in / profile checks (see the page modules). */}
                  <Route path="/welcome" element={<OnboardingPage />} />
                  <Route path="/home" element={<HomePage />} />
                  <Route path="/s/:spaceId" element={<SpacePage />} />
                  <Route path="/i/:token" element={<InviteLinkRedirect />} />
                  <Route path="/join" element={<JoinPage />} />
                </Route>

                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </ErrorBoundary>
      </ToastProvider>
    </QueryClientProvider>
  )
}
