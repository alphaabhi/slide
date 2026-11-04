import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'
import { Spinner } from '@/components/ui/Spinner'
import { ToastProvider } from '@/components/ui/Toast'
import { HomePage } from '@/pages/HomePage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { env } from '@/lib/env'

// Route-level code splitting: the style guide never ships in the initial bundle.
const StyleguidePage = lazy(() => import('@/pages/StyleguidePage'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 2, refetchOnWindowFocus: false },
    mutations: { retry: 0 },
  },
})

function PageFallback() {
  return (
    <div className="grid min-h-dvh place-items-center text-moss">
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
              <Route path="/" element={<HomePage />} />
              {env.enableStyleguide ? (
                <Route path="/styleguide" element={<StyleguidePage />} />
              ) : null}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  )
}
