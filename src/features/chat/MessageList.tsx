import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { MessageBubble } from '@/components/ui/MessageBubble'
import { Spinner } from '@/components/ui/Spinner'
import { formatTime, toRows, type ChatMessage } from './model'

const NEAR_BOTTOM_PX = 120

/**
 * Scrollable history. Opens at the newest message; loads older pages when you
 * reach the top without jumping; follows new messages only if you're already at
 * the bottom (or sent it yourself), otherwise shows a "New messages" button.
 */
export function MessageList({
  messages,
  hasOlder,
  loadingOlder,
  onLoadOlder,
  onRetry,
  empty,
  me,
  them,
}: {
  messages: ChatMessage[]
  hasOlder: boolean
  loadingOlder: boolean
  onLoadOlder: () => void
  onRetry: (clientId: string) => void
  empty: React.ReactNode
  /** Shown beside your messages and theirs. Pass stable objects (memoised). */
  me?: { name: string; avatar?: string | null }
  them?: { name: string; avatar?: string | null }
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const topSentinel = useRef<HTMLDivElement>(null)
  const atBottom = useRef(true)
  const prepending = useRef<{ height: number; top: number } | null>(null)
  const [unseen, setUnseen] = useState(0)
  const rows = useMemo(() => toRows(messages), [messages])

  const last = messages[messages.length - 1]
  const lastKey = last?.key
  const firstKey = messages[0]?.key

  const scrollToBottom = (smooth = false) => {
    const el = scroller.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
    setUnseen(0)
  }

  // Older messages were added at the top: keep the view exactly where it was.
  useLayoutEffect(() => {
    const el = scroller.current
    const p = prepending.current
    if (el && p) {
      el.scrollTop = p.top + (el.scrollHeight - p.height)
      prepending.current = null
    }
  }, [firstKey])

  // A new message at the bottom: follow it if appropriate.
  useLayoutEffect(() => {
    if (!last) return
    if (atBottom.current || last.mine) scrollToBottom()
    else setUnseen((n) => n + 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastKey])

  // Load older messages when the top comes into view.
  useEffect(() => {
    const el = scroller.current
    const sentinel = topSentinel.current
    if (!el || !sentinel || !hasOlder) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loadingOlder) {
          prepending.current = { height: el.scrollHeight, top: el.scrollTop }
          onLoadOlder()
        }
      },
      { root: el, rootMargin: '200px 0px 0px 0px' },
    )
    io.observe(sentinel)
    return () => io.disconnect()
  }, [hasOlder, loadingOlder, onLoadOlder])

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget
          atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX
          if (atBottom.current && unseen) setUnseen(0)
        }}
        className="h-full overflow-y-auto overscroll-contain px-gutter pt-4 pb-2 [overflow-anchor:none]"
        data-testid="message-list"
      >
        <div ref={topSentinel} aria-hidden="true" />
        {loadingOlder ? (
          <div className="flex justify-center py-3 text-fg-muted">
            <Spinner label="Loading earlier messages" />
          </div>
        ) : null}
        {messages.length === 0 ? (
          empty
        ) : (
          <ol aria-label="Messages" className="mx-auto max-w-[var(--composer-max)]">
            {rows.map((row) =>
              row.kind === 'day' ? (
                <li key={row.key} className="my-4 flex justify-center">
                  <span className="label-meta rounded-pill border border-line px-3 py-1 text-fg-muted">
                    {row.label}
                  </span>
                </li>
              ) : (
                <li key={row.key}>
                  {row.message.mine ? null : <span className="sr-only">They said: </span>}
                  <MessageBubble
                    side={row.message.mine ? 'you' : 'them'}
                    body={row.message.body}
                    time={formatTime(row.message.createdAt)}
                    dateTime={row.message.createdAt}
                    status={row.message.mine ? row.message.status : undefined}
                    isLast={row.isLastInRun}
                    author={row.message.mine ? me : them}
                    onRetry={
                      row.message.error && !row.message.error.includes('Wait a moment')
                        ? undefined
                        : () => onRetry(row.message.clientId)
                    }
                  />
                  {row.message.error ? (
                    <p className="-mt-2 mb-3 text-right text-xs text-danger">{row.message.error}</p>
                  ) : null}
                </li>
              ),
            )}
          </ol>
        )}
      </div>
      {unseen > 0 ? (
        <button
          type="button"
          onClick={() => scrollToBottom(true)}
          className="slide-pop absolute bottom-3 left-1/2 inline-flex h-[var(--touch-target)] -translate-x-1/2 items-center gap-2 rounded-pill border border-line bg-surface-high px-4 font-display text-sm font-semibold shadow-[var(--shadow-overlay)]"
        >
          <Icon name="back" size={16} className="-rotate-90" />
          {unseen === 1 ? 'New message' : `${unseen} new messages`}
        </button>
      ) : null}
    </div>
  )
}
