import { Component, type ErrorInfo, type ReactNode } from 'react'
import { isChunkLoadError, reloadOnce } from '@/lib/reloadOnce'

interface State {
  error: unknown
}

/**
 * Last line of defence: never leave someone on a blank screen.
 * - A new version was deployed while the page was open → reload silently once.
 * - Anything else → plain message with a reload button (no technical detail).
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: unknown): State {
    return { error }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    if (isChunkLoadError(error) && reloadOnce()) return
    console.error('Unhandled UI error', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <main className="mx-auto flex min-h-dvh max-w-[var(--content-max)] flex-col justify-center px-gutter">
        <h1 className="text-2xl">Something went wrong on this page</h1>
        <p className="mt-3 text-fg-muted">
          {isChunkLoadError(this.state.error)
            ? 'SLIDE was just updated. Reload to get the latest version.'
            : 'Reload to try again. If it keeps happening, check your connection.'}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 inline-flex h-[var(--control-height)] w-fit items-center rounded-pill bg-you px-6 font-display font-semibold text-you-ink"
        >
          Reload
        </button>
      </main>
    )
  }
}
