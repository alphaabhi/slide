/**
 * Public, browser-safe configuration only. Never add service-role keys or other
 * secrets here — anything prefixed VITE_ is shipped to every visitor.
 * (Plain checks instead of zod: this runs on every page, so it must stay tiny.)
 */
function optionalUrl(key: string, value: unknown): string | undefined {
  if (typeof value !== 'string' || value === '') return undefined
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
      throw new Error('must use https')
    }
    return value
  } catch {
    // Report which key is wrong, never its value.
    console.error(`Invalid environment variable ${key}: expected an https URL`)
    return undefined
  }
}

const e = import.meta.env

export const env = {
  supabaseUrl: optionalUrl('VITE_SUPABASE_URL', e.VITE_SUPABASE_URL),
  supabaseAnonKey:
    typeof e.VITE_SUPABASE_ANON_KEY === 'string' && e.VITE_SUPABASE_ANON_KEY.length > 20
      ? (e.VITE_SUPABASE_ANON_KEY as string)
      : undefined,
  /** Style guide is on in dev and previews, off in production unless explicitly enabled. */
  enableStyleguide: e.DEV || e.VITE_ENABLE_STYLEGUIDE === 'true',
  get hasSupabase(): boolean {
    return Boolean(this.supabaseUrl && this.supabaseAnonKey)
  },
}
