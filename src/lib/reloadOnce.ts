const KEY = 'slide.reloadedAt'

/**
 * Reload the page to pick up a new deploy, at most once every 20 seconds, so a
 * genuinely broken asset can never cause a reload loop.
 */
export function reloadOnce(): boolean {
  try {
    const last = Number(window.sessionStorage.getItem(KEY) ?? 0)
    if (Date.now() - last < 20_000) return false
    window.sessionStorage.setItem(KEY, String(Date.now()))
  } catch {
    // Storage unavailable: still reload once for this page view.
  }
  window.location.reload()
  return true
}

/** True for "this code file no longer exists" errors across Chrome, Safari and Firefox. */
export function isChunkLoadError(error: unknown): boolean {
  const msg = error instanceof Error ? `${error.name} ${error.message}` : String(error)
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError|Unable to preload CSS/i.test(
    msg,
  )
}
