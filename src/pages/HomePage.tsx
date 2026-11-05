import { Link } from 'react-router'
import { Wordmark } from '@/components/Wordmark'

/**
 * Temporary landing page until the real one (stage 7).
 * Deliberately makes no product or privacy claims yet.
 */
export function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[var(--content-max)] flex-col justify-center px-gutter pt-safe pb-safe">
      <Wordmark className="text-4xl" />
      <h1 className="mt-6 text-2xl">Take the conversation somewhere else.</h1>
      <p className="mt-3 max-w-[38ch] text-fg-muted">
        A private space for exactly two people. We’re building it now.
      </p>
      <Link
        to="/sign-in"
        className="mt-8 inline-flex h-[var(--control-height)] w-fit items-center rounded-pill bg-you px-6 font-display font-semibold text-you-ink transition-transform duration-[var(--duration-fast)] active:scale-[0.97]"
      >
        Get started
      </Link>
    </main>
  )
}
