import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { useToast } from '@/components/ui/Toast'
import {
  inviteLink,
  inviteMessage,
  spaceErrorMessage,
  useRevokeInvite,
  useRotateInvite,
} from './api'

function formatExpiry(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

/**
 * The invite, ready to share. The link itself is only known right after it was
 * made (the server keeps just a hash); after that the person can make a new one.
 */
export function InviteCard({
  spaceId,
  token,
  expiresAt,
  onToken,
}: {
  spaceId: string
  /** Present only right after creating or replacing the link. */
  token: string | null
  expiresAt: string | null
  onToken: (token: string | null) => void
}) {
  const toast = useToast()
  const rotate = useRotateInvite(spaceId)
  const revoke = useRevokeInvite(spaceId)
  const [copied, setCopied] = useState(false)
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  async function copy() {
    if (!token) return
    try {
      await navigator.clipboard.writeText(inviteMessage(token))
      setCopied(true)
      toast.show({
        title: 'Invite copied',
        description: 'Paste it into your chat.',
        tone: 'success',
      })
      window.setTimeout(() => setCopied(false), 2500)
    } catch {
      toast.show({
        title: 'Couldn’t copy',
        description: 'Press and hold the link to copy it.',
        tone: 'danger',
      })
    }
  }

  async function share() {
    if (!token) return
    try {
      await navigator.share({ text: inviteMessage(token) })
    } catch {
      // Closing the share sheet is not an error.
    }
  }

  async function makeNewLink() {
    try {
      const res = await rotate.mutateAsync()
      onToken(res.invite_token)
      toast.show({
        title: 'New invite link ready',
        description: 'The old link no longer works.',
        tone: 'success',
      })
    } catch (err) {
      toast.show({
        title: 'Couldn’t make a new link',
        description: spaceErrorMessage(err),
        tone: 'danger',
      })
    }
  }

  async function cancelLink() {
    try {
      await revoke.mutateAsync()
      onToken(null)
      toast.show({ title: 'Invite link cancelled' })
    } catch (err) {
      toast.show({
        title: 'Couldn’t cancel the link',
        description: spaceErrorMessage(err),
        tone: 'danger',
      })
    }
  }

  return (
    <section
      aria-labelledby="invite-heading"
      className="rounded-card border border-line surface-panel p-5"
    >
      <p id="invite-heading" className="label-meta flex items-center gap-1.5 text-gold">
        <Icon name="link" size={14} />
        Your invite
      </p>

      {token ? (
        <>
          <div className="mt-4 rounded-bubble rounded-br-[var(--radius-bubble-tail)] bg-you px-4 py-3 text-you-ink">
            <p className="text-base">Enough of the dating-app chat. Come slide into my space 👉</p>
            <p className="mt-1 font-meta text-xs break-all opacity-80">{inviteLink(token)}</p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {canShare ? (
              <Button onClick={() => void share()}>
                <Icon name="send" size={18} />
                Share invite
              </Button>
            ) : null}
            <Button variant={canShare ? 'secondary' : 'primary'} onClick={() => void copy()}>
              <Icon name={copied ? 'check' : 'copy'} size={18} />
              {copied ? 'Copied' : 'Copy invite'}
            </Button>
          </div>
          <p className="mt-4 text-sm text-fg-muted">
            Anyone with this link can join until someone does
            {expiresAt ? `, or until ${formatExpiry(expiresAt)}` : ''}. Send it only to the person
            you want in this space.
          </p>
        </>
      ) : expiresAt ? (
        <p className="mt-3 text-sm text-fg-muted">
          Your link works until {formatExpiry(expiresAt)}. For your privacy SLIDE can’t show the
          same link twice. Make a new one to share it again; the old one will stop working.
        </p>
      ) : (
        <p className="mt-3 text-sm text-fg-muted">
          There’s no active invite link. Make one to invite someone.
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-x-2">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-4"
          loading={rotate.isPending}
          onClick={() => void makeNewLink()}
        >
          <Icon name="retry" size={16} />
          {token || expiresAt ? 'Make a new link' : 'Make an invite link'}
        </Button>
        {token || expiresAt ? (
          <Button
            variant="ghost"
            size="sm"
            loading={revoke.isPending}
            onClick={() => void cancelLink()}
            className="text-fg-muted"
          >
            Cancel link
          </Button>
        ) : null}
      </div>
    </section>
  )
}
