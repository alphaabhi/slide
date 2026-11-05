import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[var(--content-max)] flex-col justify-center px-gutter">
      <h1 className="text-2xl">This page doesn’t exist.</h1>
      <p className="mt-3 text-fg-muted">Check the link, or head back to the start.</p>
      <Link
        to="/"
        className="mt-6 inline-flex h-[var(--control-height)] w-fit items-center rounded-pill bg-you px-6 font-display font-semibold text-you-ink"
      >
        Go to home
      </Link>
    </main>
  )
}
