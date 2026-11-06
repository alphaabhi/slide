import { useCallback, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Avatar } from '@/components/ui/Avatar'
import { Dialog } from '@/components/ui/Dialog'
import { Icon } from '@/components/ui/Icon'
import { useMyProfile } from '@/features/profile/api'
import { spaceLabel, type Space } from '@/features/spaces/api'
import { LeaveSpace } from '@/features/spaces/LeaveSpace'
import { cn } from '@/lib/cn'
import { useLiveMessages, useMessageHistory, useOutbox, type LiveStatus } from './api'
import { Composer, type ComposerHandle } from './Composer'
import { MessageList } from './MessageList'
import { mergeMessages, type Message } from './model'
import { useViewportFit } from './useViewportFit'

const STARTERS = [
  'What’s the best thing that happened to you this week?',
  'Coffee, chai or neither?',
  'What were you doing before we matched?',
]

export function ChatScreen({
  space,
  userId,
  justJoined,
}: {
  space: Space
  userId: string
  justJoined?: boolean
}) {
  const shell = useViewportFit<HTMLDivElement>()
  const myName = useMyProfile(userId).data?.display_name ?? 'You'
  const partnerName = space.partner?.name ?? 'them'
  const history = useMessageHistory(space.id)
  const composer = useRef<ComposerHandle | null>(null)
  const [announcement, setAnnouncement] = useState('')

  const onIncoming = useCallback(
    (m: Message) => {
      if (m.sender_id !== userId) setAnnouncement(`${partnerName}: ${m.body}`)
    },
    [userId, partnerName],
  )
  const live = useLiveMessages(space.id, onIncoming)
  const noop = useCallback(() => {}, [])
  const outbox = useOutbox(space.id, noop)

  const server = useMemo(() => history.data?.pages.flat() ?? [], [history.data])
  const messages = useMemo(
    () => mergeMessages(server, outbox.items, userId),
    [server, outbox.items, userId],
  )
  const loadOlder = useCallback(() => void history.fetchNextPage(), [history])
  const closed = space.phase === 'closed'

  return (
    <div ref={shell} className="fixed inset-x-0 top-0 flex h-dvh flex-col bg-canvas">
      <header className="flex items-center gap-3 border-b border-line px-gutter pt-safe">
        <div className="flex h-16 w-full items-center gap-3">
          <Link
            to="/home"
            aria-label="Back to your spaces"
            className="-ml-2 inline-flex size-[var(--touch-target)] shrink-0 items-center justify-center rounded-full text-fg-muted hover:bg-surface-high hover:text-fg"
          >
            <Icon name="back" size={20} />
          </Link>
          <div className="flex -space-x-2" aria-hidden="true">
            <Avatar
              name={myName}
              side="you"
              size="sm"
              className="ring-2 ring-[var(--color-canvas)]"
            />
            {space.partner ? (
              <Avatar
                name={space.partner.name}
                side="them"
                size="sm"
                className="ring-2 ring-[var(--color-canvas)]"
              />
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-base font-semibold">{spaceLabel(space)}</h1>
            <ConnectionLine closed={closed} partnerName={partnerName} />
          </div>
          <Dialog
            title="Space options"
            trigger={
              <button
                type="button"
                aria-label="Space options"
                className="-mr-2 inline-flex size-[var(--touch-target)] items-center justify-center rounded-full text-fg-muted hover:bg-surface-high hover:text-fg"
              >
                <Icon name="more" size={20} />
              </button>
            }
          >
            <LeaveSpace space={space} userId={userId} />
          </Dialog>
        </div>
      </header>
      {closed ? null : <ConnectionBanner status={live} />}

      {justJoined ? (
        <p className="slide-pop mx-gutter mt-3 rounded-card border border-line surface-panel px-4 py-3 text-center font-display font-semibold">
          You’re in. Say hi to {partnerName} 👋
        </p>
      ) : null}

      {history.isPending ? (
        <div className="flex flex-1 items-center justify-center text-fg-muted">
          <span className="slide-loader-mark" aria-label="Loading messages" role="status">
            <span />
            <span />
          </span>
        </div>
      ) : history.isError ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-gutter text-center">
          <p className="font-display font-semibold">Couldn’t load your messages</p>
          <button
            type="button"
            onClick={() => void history.refetch()}
            className="rounded-pill border border-line px-5 py-2 font-display text-sm font-semibold"
          >
            Try again
          </button>
        </div>
      ) : (
        <MessageList
          messages={messages}
          hasOlder={!!history.hasNextPage}
          loadingOlder={history.isFetchingNextPage}
          onLoadOlder={loadOlder}
          onRetry={outbox.retry}
          empty={
            <EmptyChat
              partnerName={partnerName}
              closed={closed}
              onPick={(t) => composer.current?.insert(t)}
            />
          }
        />
      )}

      {closed ? (
        <p className="border-t border-line px-gutter pt-3 pb-safe text-center text-sm text-fg-muted">
          {partnerName === 'them' ? 'The other person' : partnerName} left. This space is closed, so
          no new messages can be sent.
        </p>
      ) : (
        <Composer
          spaceId={space.id}
          partnerName={partnerName}
          onSend={outbox.send}
          onReady={(h) => (composer.current = h)}
        />
      )}

      {/* Announces only new incoming messages to screen readers, not the whole history. */}
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </div>
  )
}

function ConnectionLine({ closed, partnerName }: { closed: boolean; partnerName: string }) {
  return (
    <p className="truncate text-xs text-fg-muted">{closed ? 'Closed' : `You & ${partnerName}`}</p>
  )
}

/** A full-width strip under the header, only when messages can't flow right now. */
function ConnectionBanner({ status }: { status: LiveStatus }) {
  if (status !== 'offline' && status !== 'reconnecting') return null
  const offline = status === 'offline'
  return (
    <p
      role="status"
      className={cn(
        'flex items-center justify-center gap-2 border-b border-line px-gutter py-2 text-center text-xs',
        offline ? 'bg-gold/10 text-gold' : 'text-fg-muted',
      )}
    >
      {offline ? (
        <Icon name="wifiOff" size={14} />
      ) : (
        <span
          className="size-1.5 animate-pulse rounded-full bg-fg-muted motion-reduce:animate-none"
          aria-hidden="true"
        />
      )}
      {offline ? 'You’re offline. Messages will send when you’re back.' : 'Reconnecting…'}
    </p>
  )
}

function EmptyChat({
  partnerName,
  closed,
  onPick,
}: {
  partnerName: string
  closed: boolean
  onPick: (t: string) => void
}) {
  return (
    <div className="mx-auto flex h-full max-w-sm flex-col items-center justify-center py-8 text-center">
      <p className="text-4xl" aria-hidden="true">
        👋
      </p>
      <h2 className="mt-3 text-xl">
        {closed ? (
          'No messages here'
        ) : (
          <>
            Say hi to <span className="text-spark">{partnerName}</span>
          </>
        )}
      </h2>
      {closed ? null : (
        <>
          <p className="mt-2 text-sm text-fg-muted">
            This is the start of your space. Stuck? Tap one to use it.
          </p>
          <ul className="mt-5 grid w-full gap-2">
            {STARTERS.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => onPick(s)}
                  className="w-full rounded-card border border-line px-4 py-3 text-left text-sm transition-colors hover:bg-surface-high"
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
