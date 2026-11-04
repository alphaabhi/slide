import { Wordmark } from '@/components/Wordmark'

/**
 * Temporary holding page until the real landing page (stage 7).
 * Deliberately makes no product or privacy claims yet.
 */
export function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[var(--content-max)] flex-col justify-center px-gutter pt-safe pb-safe">
      <Wordmark className="text-4xl" />
      <h1 className="mt-6 text-2xl">Take the conversation somewhere else.</h1>
      <p className="mt-3 max-w-[38ch] text-moss">
        A private space for exactly two people. We’re building it now.
      </p>
    </main>
  )
}
