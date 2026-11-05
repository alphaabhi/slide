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

/**
 * The latest invite link for a space, remembered for this browser tab only, so
 * its creator can copy it again after moving around the app. Never sent
 * anywhere; gone when the tab closes.
 */
const linkKey = (spaceId: string) => `slide.inviteLink.${spaceId}`

export function rememberInviteToken(spaceId: string, token: string | null): void {
  try {
    if (token) window.sessionStorage.setItem(linkKey(spaceId), token)
    else window.sessionStorage.removeItem(linkKey(spaceId))
  } catch {
    // Storage blocked: the person can still make a new link.
  }
}

export function recallInviteToken(spaceId: string): string | null {
  try {
    return window.sessionStorage.getItem(linkKey(spaceId))
  } catch {
    return null
  }
}
