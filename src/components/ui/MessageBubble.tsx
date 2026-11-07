import { memo, type HTMLAttributes, type ReactNode } from 'react'
import { linkify } from '@/lib/linkify'
import { cn } from '@/lib/cn'
import { Avatar, type Side } from './Avatar'
import { Icon } from './Icon'

export type DeliveryStatus = 'sending' | 'sent' | 'failed'

export interface MessageBubbleProps {
  side: Side
  body: string
  /** Pre-formatted local time, e.g. "9:41 pm". Formatting lives outside the component. */
  time: string
  /** ISO timestamp for the <time> element. */
  dateTime: string
  /** Only messages you sent have a delivery status. */
  status?: DeliveryStatus
  /** Last bubble in a run from the same sender — gets the tail corner and the meta row. */
  isLast?: boolean
  onRetry?: () => void
  /**
   * Who sent it. When given, their avatar sits beside the last bubble of each
   * run (earlier bubbles in the run keep the same indent). Pass a stable object.
   */
  author?: { name: string; avatar?: string | null }
  /** Server id: becomes the element id (msg-…) so replies can jump here. */
  id?: string
  /** The message this one replies to. */
  quote?: { name: string; text: string; side: Side; onOpen?: () => void }
  reactions?: { emoji: string; count: number; mine: boolean; who: string }[]
  onReactionTap?: (emoji: string) => void
  /** Gesture handlers etc. for the bubble itself. */
  bubbleProps?: HTMLAttributes<HTMLDivElement>
  /** Horizontal drag while swiping to reply (px). */
  swipeOffset?: number
  /** Buttons shown beside the bubble on hover/focus (computers). */
  actions?: ReactNode
  /** Briefly highlighted (e.g. after jumping to it from a reply). */
  highlighted?: boolean
  /** Changes each time a ❤️ is double-tapped, to play the heart burst. */
  burstKey?: number
}

const statusLabel: Record<DeliveryStatus, string> = {
  sending: 'Sending',
  sent: 'Sent',
  failed: 'Not sent',
}

/**
 * A single chat message. Memoised: a new message or a keystroke in the composer
 * must not re-render the whole history.
 */
export const MessageBubble = memo(function MessageBubble({
  side,
  body,
  time,
  dateTime,
  status,
  isLast = true,
  onRetry,
  author,
  id,
  quote,
  reactions,
  onReactionTap,
  bubbleProps,
  swipeOffset = 0,
  actions,
  highlighted = false,
  burstKey = 0,
}: MessageBubbleProps) {
  const mine = side === 'you'
  const failed = status === 'failed'

  return (
    <div
      id={id ? `msg-${id}` : undefined}
      className={cn(
        'flex scroll-mt-24 flex-col',
        mine ? 'items-end' : 'items-start',
        isLast || reactions?.length ? 'mb-3' : 'mb-1',
      )}
    >
      <div className={cn('group/msg flex w-full items-end gap-2', mine && 'flex-row-reverse')}>
        {author ? (
          isLast ? (
            <Avatar name={author.name} avatar={author.avatar} side={side} size="sm" />
          ) : (
            <span aria-hidden="true" className="w-7 shrink-0" />
          )
        ) : null}
        <div
          className={cn(
            'relative flex max-w-[min(80%,34rem)] min-w-0 flex-col',
            mine ? 'items-end' : 'items-start',
          )}
        >
          {swipeOffset > 0 ? (
            <span
              aria-hidden="true"
              className="absolute top-1/2 -left-9 -translate-y-1/2 text-fg-muted"
              style={{ opacity: Math.min(1, swipeOffset / 56) }}
            >
              <Icon name="reply" size={20} />
            </span>
          ) : null}
          <div
            {...bubbleProps}
            style={{
              ...bubbleProps?.style,
              transform: swipeOffset ? `translateX(${swipeOffset}px)` : undefined,
              transition: swipeOffset ? 'none' : 'transform 220ms var(--ease-spring)',
            }}
            className={cn(
              'slide-bubble relative max-w-full touch-pan-y whitespace-pre-wrap rounded-bubble px-4 py-2.5 text-base [overflow-wrap:anywhere] pointer-coarse:select-none pointer-coarse:[-webkit-touch-callout:none]',
              highlighted && 'slide-highlight',
              failed
                ? 'bg-danger-surface text-fg outline outline-1 outline-danger/60'
                : mine
                  ? 'bg-you text-you-ink'
                  : 'bg-surface-high text-fg',
              isLast &&
                (mine
                  ? 'rounded-br-[var(--radius-bubble-tail)]'
                  : 'rounded-bl-[var(--radius-bubble-tail)]'),
              status === 'sending' && 'opacity-70',
            )}
          >
            {quote ? (
              <button
                type="button"
                onClick={quote.onOpen}
                className={cn(
                  'mb-1.5 -mx-1 flex w-[calc(100%+0.5rem)] min-w-40 flex-col rounded-[0.875rem] border-l-[3px] px-3 py-1.5 text-left text-sm',
                  mine ? 'bg-you-ink/10' : 'bg-canvas/50',
                  quote.side === 'you' ? 'border-fg' : 'border-them',
                )}
              >
                <span className={cn('label-meta', quote.side === 'them' && !mine && 'text-them')}>
                  {quote.name}
                </span>
                <span className="line-clamp-2 whitespace-pre-wrap opacity-80">{quote.text}</span>
              </button>
            ) : null}
            <Linkified text={body} mine={mine} />
            {burstKey ? (
              <span
                key={burstKey}
                aria-hidden="true"
                className="slide-heart-burst pointer-events-none absolute inset-0 flex items-center justify-center text-4xl"
              >
                ❤️
              </span>
            ) : null}
          </div>
          {actions ? (
            <div
              className={cn(
                'absolute -top-4 z-20 flex gap-0.5 rounded-pill border border-line surface-panel p-0.5 opacity-0 transition-opacity duration-[var(--duration-fast)]',
                'group-hover/msg:opacity-100 focus-within:opacity-100 pointer-coarse:sr-only',
                mine ? 'left-0 -translate-x-1/3' : 'right-0 translate-x-1/3',
              )}
            >
              {actions}
            </div>
          ) : null}
          {reactions?.length ? (
            <div
              className={cn(
                'relative z-10 -mt-2 flex gap-1',
                mine ? 'mr-2 justify-end' : 'ml-2 justify-start',
              )}
            >
              {reactions.map((r) => (
                <button
                  key={r.emoji}
                  type="button"
                  onClick={() => onReactionTap?.(r.emoji)}
                  aria-label={`${r.emoji} from ${r.who}${r.mine ? '. Tap to remove yours' : ''}`}
                  aria-pressed={r.mine}
                  className={cn(
                    'slide-pop inline-flex h-6 items-center gap-0.5 rounded-pill border px-1.5 text-sm leading-none shadow-[var(--shadow-raised)]',
                    r.mine ? 'border-them/60 bg-surface-high' : 'border-line bg-surface',
                  )}
                >
                  <span>{r.emoji}</span>
                  {r.count > 1 ? <span className="text-xs text-fg-muted">{r.count}</span> : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {isLast || failed ? (
        <div
          className={cn(
            'font-meta mt-1 flex items-center gap-2 px-1 text-xs',
            author && (mine ? 'mr-9' : 'ml-9'),
            failed ? 'text-danger' : 'text-fg-muted',
          )}
        >
          <time dateTime={dateTime}>{time}</time>
          {mine && status ? (
            <>
              <span className="inline-flex items-center gap-1">
                {status === 'sending' ? <Icon name="clock" size={13} /> : null}
                {status === 'sent' ? <Icon name="check" size={13} /> : null}
                {failed ? <Icon name="alert" size={13} /> : null}
                {statusLabel[status]}
              </span>
            </>
          ) : null}
          {failed && onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="-my-3 ml-1 inline-flex h-[var(--touch-target)] items-center gap-1 rounded-pill px-2 font-semibold text-fg underline decoration-danger underline-offset-4 hover:text-white"
            >
              <Icon name="retry" size={14} />
              Retry
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
})

/** Message text with web links made tappable (opened in a new tab). */
function Linkified({ text, mine }: { text: string; mine: boolean }) {
  const pieces = linkify(text)
  if (pieces.length === 1 && !pieces[0]!.href) return <span>{text}</span>
  return (
    <>
      {pieces.map((p, i) =>
        p.href ? (
          <a
            key={i}
            href={p.href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className={cn(
              'underline underline-offset-2 [overflow-wrap:anywhere]',
              mine ? 'decoration-you-ink/40' : 'text-them decoration-them/50',
            )}
          >
            {p.text}
          </a>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  )
}
