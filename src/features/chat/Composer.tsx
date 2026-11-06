import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'
import { MAX_MESSAGE_LENGTH, shouldSendOnKey } from './model'

const draftKey = (spaceId: string) => `slide.draft.${spaceId}`
function loadDraft(spaceId: string) {
  try {
    return window.sessionStorage.getItem(draftKey(spaceId)) ?? ''
  } catch {
    return ''
  }
}

export interface ComposerHandle {
  insert: (text: string) => void
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
}: {
  spaceId: string
  partnerName: string
  onSend: (body: string) => void
  onReady?: (handle: ComposerHandle) => void
  /** Shown before the text box, e.g. the Play button. */
  leading?: React.ReactNode
}) {
  const [value, setValue] = useState(() => loadDraft(spaceId))
  const ref = useRef<HTMLTextAreaElement>(null)
  const coarse = useRef(false)

  useEffect(() => {
    coarse.current = window.matchMedia('(pointer: coarse)').matches
    onReady?.({
      insert: (text) => {
        setValue(text)
        ref.current?.focus()
      },
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

  function submit(e?: FormEvent) {
    e?.preventDefault()
    if (!canSend) return
    onSend(trimmed)
    setValue('')
    ref.current?.focus()
  }

  return (
    <form
      onSubmit={submit}
      className="flex items-end gap-2 border-t border-line bg-canvas/95 px-gutter pt-2 pb-safe backdrop-blur"
    >
      {leading}
      <div className="min-w-0 flex-1">
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
          onChange={(e) => setValue(e.target.value)}
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
            'block max-h-40 min-h-[var(--control-height)] w-full resize-none rounded-[1.5rem] border bg-surface px-4 py-3 text-base text-fg placeholder:text-fg-muted/80',
            'focus:outline-none focus-visible:outline-none focus:border-fg-muted',
            tooLong ? 'border-danger' : 'border-line',
          )}
        />
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
  )
}
