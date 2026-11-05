/**
 * The invite token travels from the link (/i/<token>) to the join page via
 * sessionStorage, so it can be removed from the address bar immediately: it
 * then never appears in browser history, screenshots of the URL, or analytics.
 * It survives the sign-in steps because they happen in the same tab.
 */
const KEY = 'slide.pendingInvite'

export function savePendingInvite(token: string): void {
  try {
    window.sessionStorage.setItem(KEY, token)
  } catch {
    // Storage blocked: the join page will explain the link couldn't be read.
  }
}

export function readPendingInvite(): string | null {
  try {
    return window.sessionStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function clearPendingInvite(): void {
  try {
    window.sessionStorage.removeItem(KEY)
  } catch {
    // Nothing to clear.
  }
}
