export const THEMES = ['violet', 'graphite'] as const
export type Theme = (typeof THEMES)[number]

const KEY = 'slide.theme'

function isTheme(v: unknown): v is Theme {
  return typeof v === 'string' && (THEMES as readonly string[]).includes(v)
}

/** Current theme: ?theme= in the URL (for previews), then the saved choice, then Violet. */
export function readTheme(): Theme {
  const fromUrl = new URLSearchParams(window.location.search).get('theme')
  if (isTheme(fromUrl)) return fromUrl
  try {
    const saved = window.localStorage.getItem(KEY)
    if (isTheme(saved)) return saved
  } catch {
    // Storage can be unavailable (private mode, blocked site data) — fall through.
  }
  return 'violet'
}

export function applyTheme(theme: Theme, persist = false): void {
  const root = document.documentElement
  if (theme === 'violet') delete root.dataset.theme
  else root.dataset.theme = theme
  const meta = document.querySelector('meta[name="theme-color"]')
  meta?.setAttribute('content', theme === 'violet' ? '#3a1a9c' : '#0c0c0d')
  if (persist) {
    try {
      window.localStorage.setItem(KEY, theme)
    } catch {
      // Non-essential; the theme still applies for this visit.
    }
  }
}
