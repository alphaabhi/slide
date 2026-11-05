import { useEffect } from 'react'
import { Link } from 'react-router'
import { preloadAuthArea } from '@/app/routes'
import { Wordmark } from '@/components/Wordmark'

/**
 * Temporary landing page until the real one (stage 7).
 * Deliberately makes no product or privacy claims yet.
 */
export function HomePage() {
  // Download the sign-in code in the background once the page is idle, so "Get started" opens instantly.
  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1200))
    const cancel = window.cancelIdleCallback ?? window.clearTimeout
    const id = idle(() => preloadAuthArea())
    return () => cancel(id)
  }, [])

  return (
    <main className="mx-auto flex min-h-dvh max-w-[var(--content-max)] flex-col justify-center px-gutter pt-safe pb-safe">
      <Wordmark className="text-4xl" />
      <h1 className="mt-6 text-2xl">
        Take the conversation <span className="text-spark">somewhere else.</span>
      </h1>
      <p className="mt-3 max-w-[38ch] text-fg-muted">
        A private space for exactly two people. We’re building it now.
      </p>
      <Link
        to="/sign-in"
        onPointerDown={preloadAuthArea}
        onFocus={preloadAuthArea}
        className="mt-8 inline-flex h-[var(--control-height)] w-fit items-center rounded-pill bg-you px-6 font-display font-semibold text-you-ink transition-transform duration-[var(--duration-fast)] active:scale-[0.97]"
      >
        Get started
      </Link>
    </main>
  )
}
