import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { MessageBubble } from '@/components/ui/MessageBubble'
import { useQuotedMessage } from './api'
import { DOUBLE_TAP_REACTION, formatTime, summarizeReactions, type ChatMessage } from './model'
import { MessageMenu } from './MessageMenu'
import { useBubbleGestures } from './useBubbleGestures'

export interface ChatActions {
  spaceId: string
  myId: string
  partnerName: string
  /** The space is closed: history is read-only. */
  closed: boolean
  react: (messageId: string, emoji: string | null) => void
  reply: (m: ChatMessage) => void
  jumpTo: (messageId: string) => void
  highlightedId: string | null
}

const Ctx = createContext<ChatActions | null>(null)
export const ChatActionsProvider = Ctx.Provider

function useChatActions() {
  const v = useContext(Ctx)
  if (!v) throw new Error('ChatActionsProvider is missing')
  return v
}

/**
 * One message with everything you can do to it: double-tap to ❤️ (their
 * messages), press and hold (or right-click) for reactions/Reply/Copy, swipe
 * right to reply, and on a computer small React/Reply buttons on hover.
 */
export function ChatBubble({
  message,
  isLast,
  author,
  onRetry,
}: {
  message: ChatMessage
  isLast: boolean
  author?: { name: string; avatar?: string | null }
  onRetry?: () => void
}) {
  const ctx = useChatActions()
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
  const [burst, setBurst] = useState(0)
  const id = message.id
  const active = !!id && !ctx.closed
  const myReaction = message.reactions?.find((r) => r.user_id === ctx.myId)?.emoji ?? undefined

  const like = useCallback(() => {
    if (!id) return
    const next = myReaction === DOUBLE_TAP_REACTION ? null : DOUBLE_TAP_REACTION
    ctx.react(id, next)
    if (next) setBurst((b) => b + 1)
  }, [ctx, id, myReaction])

  const { offset, handlers } = useBubbleGestures({
    enabled: !!id,
    onDoubleTap: active && !message.mine ? like : undefined,
    onLongPress: (el) => setMenuAnchor(el),
    onSwipe: active ? () => ctx.reply(message) : undefined,
  })

  const quoted = useQuotedMessage(ctx.spaceId, message.replyTo)
  const quote = useMemo(() => {
    if (!message.replyTo) return undefined
    const theirs = quoted ? quoted.sender_id !== ctx.myId : true
    return {
      name: quoted ? (theirs ? ctx.partnerName : 'You') : '…',
      text: quoted?.body ?? 'Original message',
      side: theirs ? ('them' as const) : ('you' as const),
      onOpen: () => message.replyTo && ctx.jumpTo(message.replyTo),
    }
  }, [message.replyTo, quoted, ctx])

  const reactions = useMemo(
    () => summarizeReactions(message.reactions, ctx.myId, ctx.partnerName),
    [message.reactions, ctx.myId, ctx.partnerName],
  )

  const closeMenu = useCallback(() => setMenuAnchor(null), [])

  return (
    <>
      <MessageBubble
        id={id}
        side={message.mine ? 'you' : 'them'}
        body={message.body}
        time={formatTime(message.createdAt)}
        dateTime={message.createdAt}
        status={message.mine ? message.status : undefined}
        isLast={isLast}
        author={author}
        onRetry={onRetry}
        quote={quote}
        reactions={reactions}
        onReactionTap={
          active && id
            ? (emoji) => {
                // Tap your own to remove it; tap theirs to react the same.
                ctx.react(id, myReaction === emoji ? null : emoji)
              }
            : undefined
        }
        bubbleProps={handlers}
        swipeOffset={offset}
        highlighted={!!id && ctx.highlightedId === id}
        burstKey={burst}
        actions={
          id ? (
            <>
              <button
                type="button"
                aria-label={message.mine ? 'Message options' : 'React or reply'}
                onClick={(e) => {
                  const bubble = e.currentTarget
                    .closest('.group\\/msg')
                    ?.querySelector<HTMLElement>('.slide-bubble')
                  setMenuAnchor(bubble ?? e.currentTarget)
                }}
                className="inline-flex size-8 items-center justify-center rounded-full text-fg-muted hover:bg-surface-high hover:text-fg"
              >
                <Icon name="smile" size={18} />
              </button>
              {active ? (
                <button
                  type="button"
                  aria-label="Reply"
                  onClick={() => ctx.reply(message)}
                  className="inline-flex size-8 items-center justify-center rounded-full text-fg-muted hover:bg-surface-high hover:text-fg"
                >
                  <Icon name="reply" size={18} />
                </button>
              ) : null}
            </>
          ) : undefined
        }
      />
      {menuAnchor && id ? (
        <MessageMenu
          anchor={menuAnchor}
          mine={message.mine}
          text={message.body}
          myReaction={myReaction}
          canReact={active}
          canReply={active}
          onReact={(emoji) => {
            ctx.react(id, emoji)
            if (emoji === DOUBLE_TAP_REACTION) setBurst((b) => b + 1)
          }}
          onReply={() => ctx.reply(message)}
          onClose={closeMenu}
        />
      ) : null}
    </>
  )
}
