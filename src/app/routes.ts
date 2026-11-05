/**
 * Code for the signed-in area, split from the landing page. All four modules are
 * requested together (never one after another), and the landing page preloads
 * them in the background so tapping "Get started" is instant.
 */
export const authArea = {
  layout: () => import('@/features/auth/AuthLayout'),
  signIn: () => import('@/features/auth/SignInPage'),
  onboarding: () => import('@/features/profile/OnboardingPage'),
  home: () => import('@/features/home/HomePage'),
  space: () => import('@/features/spaces/SpacePage'),
  join: () => import('@/features/spaces/JoinPage'),
}

let started = false
export function preloadAuthArea(): void {
  if (started) return
  started = true
  for (const load of Object.values(authArea)) void load().catch(() => (started = false))
}

const AUTH_PATHS = ['/sign-in', '/welcome', '/home', '/s', '/i', '/join']
export function isAuthPath(pathname: string): boolean {
  return AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}
