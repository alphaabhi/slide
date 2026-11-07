import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'
import { MAX_MESSAGE_LENGTH, shouldSendOnKey } from './model'

const EmojiPickerPanel = lazy(() => import('./EmojiPickerPanel'))

const draftKey = (spaceId: string) => `slide.draft.${spaceId}`
function loadDraft(spaceId: string) {
  try {
    return window.sessionStorage.getItem(draftKey(spaceId)) ?? ''
  } catch {
    return ''
  }
}

export interface ComposerHandle {
  /** Replace the draft (e.g. a conversation starter). */
  insert: (text: string) => void
  focus: () => void
}

/**
 * The message box. Grows with the text up to ~6 lines. Desktop: Enter sends,
 * Shift+Enter adds a line. Phones: the keyboard's return key adds a line and the
 * send button sends, and the keyboard stays open after sending.
 * The draft is kept for this tab, so leaving the screen or a refresh never loses it.
 */
export function Composer({
  spaceId,
  partnerName,
  onSend,
  onReady,
  leading,
  replyTo,
  onCancelReply,
}: {
  spaceId: string
  partnerName: string
  onSend: (body: string) => void
  onReady?: (handle: ComposerHandle) => void
  /** Shown before the text box, e.g. the Play button. */
  leading?: React.ReactNode
  /** The message being replied to, shown above the box with a cancel button. */
  replyTo?: { name: string; text: string }
  onCancelReply?: () => void
}) {
  const [value, setValue] = useState(() => loadDraft(spaceId))
  const [emojiOpen, setEmojiOpen] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)
  const coarse = useRef(false)
  // Where the cursor was, so an emoji lands there even after the box lost focus.
  const caret = useRef<{ start: number; end: number } | null>(null)

  useEffect(() => {
    coarse.current = window.matchMedia('(pointer: coarse)').matches
    onReady?.({
      insert: (text) => {
        setValue(text)
        ref.current?.focus()
      },
      focus: () => ref.current?.focus(),
    })
  }, [onReady])

  useEffect(() => {
    try {
      if (value) window.sessionStorage.setItem(draftKey(spaceId), value)
      else window.sessionStorage.removeItem(draftKey(spaceId))
    } catch {
      // Best effort.
    }
  }, [spaceId, value])

  // Auto-grow.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [value])

  const trimmed = value.trim()
  const tooLong = value.length > MAX_MESSAGE_LENGTH
  const canSend = trimmed.length > 0 && !tooLong

  function insertEmoji(emoji: string) {
    const el = ref.current
    const at = caret.current ?? { start: value.length, end: value.length }
    const next = value.slice(0, at.start) + emoji + value.slice(at.end)
    const pos = at.start + emoji.length
    caret.current = { start: pos, end: pos }
    setValue(next)
    // On a computer, keep typing straight after; on a phone, don't pop the keyboard up.
    if (!coarse.current && el) {
      requestAnimationFrame(() => {
        el.focus()
        el.setSelectionRange(pos, pos)
      })
    }
  }

  function rememberCaret() {
    const el = ref.current
    if (el) caret.current = { start: el.selectionStart, end: el.selectionEnd }
  }

  function submit(e?: FormEvent) {
    e?.preventDefault()
    if (!canSend) return
    onSend(trimmed)
    setValue('')
    caret.current = null
    ref.current?.focus()
  }

  return (
    <div className="border-t border-line bg-canvas/95 backdrop-blur">
      {replyTo ? (
        <div className="slide-pop flex items-center gap-3 px-gutter pt-2">
          <Icon name="reply" size={18} className="shrink-0 text-them" />
          <div className="min-w-0 flex-1 border-l-[3px] border-them pl-3">
            <p className="label-meta text-them">Replying to {replyTo.name}</p>
            <p className="truncate text-sm text-fg-muted">{replyTo.text}</p>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            aria-label="Cancel reply"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-fg-muted hover:bg-surface-high"
          >
            <Icon name="close" size={18} />
          </button>
        </div>
      ) : null}
      {emojiOpen ? (
        <div
          className="slide-pop px-gutter pt-2"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setEmojiOpen(false)
              ref.current?.focus()
            }
          }}
        >
          <Suspense
            fallback={
              <div className="flex h-[21rem] items-center justify-center text-sm text-fg-muted">
                Loading…
              </div>
            }
          >
            <EmojiPickerPanel onPick={insertEmoji} />
          </Suspense>
        </div>
      ) : null}
      <form onSubmit={submit} className="flex items-end gap-2 px-gutter pt-2 pb-safe">
        {leading}
        <div className="relative min-w-0 flex-1">
          <label htmlFor={`composer-${spaceId}`} className="sr-only">
            Message {partnerName}
          </label>
          <textarea
            ref={ref}
            id={`composer-${spaceId}`}
            rows={1}
            value={value}
            placeholder={`Message ${partnerName}`}
            enterKeyHint="enter"
            autoComplete="off"
            aria-describedby={tooLong ? `composer-${spaceId}-limit` : undefined}
            onChange={(e) => {
              setValue(e.target.value)
              caret.current = { start: e.target.selectionStart, end: e.target.selectionEnd }
            }}
            onSelect={rememberCaret}
            onBlur={rememberCaret}
            onFocus={() => {
              // Typing on a phone: the keyboard and the emoji panel shouldn't both be open.
              if (coarse.current) setEmojiOpen(false)
            }}
            onKeyDown={(e) => {
              if (
                shouldSendOnKey(
                  {
                    key: e.key,
                    shiftKey: e.shiftKey,
                    isComposing: e.nativeEvent.isComposing,
                    keyCode: e.keyCode,
                  },
                  coarse.current,
                )
              ) {
                e.preventDefault()
                submit()
              }
            }}
            className={cn(
              'block max-h-40 min-h-[var(--control-height)] w-full resize-none rounded-[1.5rem] border bg-surface py-3 pr-12 pl-4 text-base text-fg placeholder:text-fg-muted/80',
              'focus:outline-none focus-visible:outline-none focus:border-fg-muted',
              tooLong ? 'border-danger' : 'border-line',
            )}
          />
          <button
            type="button"
            aria-label={emojiOpen ? 'Close emoji' : 'Emoji'}
            aria-expanded={emojiOpen}
            onPointerDown={(e) => {
              // Don't steal focus from the box on a computer.
              if (!coarse.current) e.preventDefault()
            }}
            onClick={() => {
              rememberCaret()
              setEmojiOpen((o) => !o)
              if (coarse.current) ref.current?.blur()
            }}
            className={cn(
              'absolute right-1.5 bottom-1.5 inline-flex size-9 items-center justify-center rounded-full',
              emojiOpen ? 'bg-surface-high text-fg' : 'text-fg-muted hover:text-fg',
            )}
          >
            <Icon name="smile" size={20} />
          </button>
          {value.length > MAX_MESSAGE_LENGTH - 200 ? (
            <p
              id={`composer-${spaceId}-limit`}
              className={cn('mt-1 px-2 text-xs', tooLong ? 'text-danger' : 'text-fg-muted')}
            >
              {value.length.toLocaleString()} / {MAX_MESSAGE_LENGTH.toLocaleString()}
            </p>
          ) : null}
        </div>
        <button
          type="submit"
          aria-label="Send message"
          disabled={!canSend}
          // Keep focus (and the phone keyboard) on the text box when tapping send.
          onPointerDown={(e) => e.preventDefault()}
          className={cn(
            'mb-0.5 inline-flex size-[var(--control-height)] shrink-0 items-center justify-center rounded-full',
            'transition-[transform,background-color,opacity] duration-[var(--duration-fast)] active:scale-90',
            canSend ? 'bg-you text-you-ink' : 'bg-surface-high text-fg-muted',
          )}
        >
          <Icon name="send" size={20} />
        </button>
      </form>
    </div>
  )
}
