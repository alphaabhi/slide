import { memo } from 'react'
import { cn } from '@/lib/cn'
import type { Side } from './Avatar'
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
}: MessageBubbleProps) {
  const mine = side === 'you'
  const failed = status === 'failed'

  return (
    <div
      className={cn('flex flex-col', mine ? 'items-end' : 'items-start', isLast ? 'mb-3' : 'mb-1')}
    >
      <div
        className={cn(
          'slide-bubble max-w-[min(80%,34rem)] whitespace-pre-wrap rounded-bubble px-4 py-2.5 text-base [overflow-wrap:anywhere]',
          mine ? 'bg-you text-you-ink' : 'bg-pine-high text-mist',
          isLast &&
            (mine
              ? 'rounded-br-[var(--radius-bubble-tail)]'
              : 'rounded-bl-[var(--radius-bubble-tail)]'),
          status === 'sending' && 'opacity-70',
          failed && 'bg-danger-surface text-mist outline outline-1 outline-danger/60',
        )}
      >
        {body}
      </div>

      {isLast || failed ? (
        <div
          className={cn(
            'mt-1 flex items-center gap-2 px-1 text-xs',
            failed ? 'text-danger' : 'text-moss',
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
              className="-my-3 ml-1 inline-flex h-[var(--touch-target)] items-center gap-1 rounded-pill px-2 font-semibold text-mist underline decoration-danger underline-offset-4 hover:text-white"
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
