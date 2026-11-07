import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '@/components/ui/Icon'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/cn'
import { QUICK_REACTIONS } from './model'

const EmojiPickerPanel = lazy(() => import('./EmojiPickerPanel'))

const MENU_W = 320
const MARGIN = 12

/**
 * The menu for one message (long-press on a phone, right-click or the hover
 * button on a computer): six quick reactions, "+" for any emoji, Reply, Copy.
 * It floats next to the message; the rest of the screen dims.
 */
export function MessageMenu({
  anchor,
  mine,
  text,
  myReaction,
  canReact,
  canReply,
  onReact,
  onReply,
  onClose,
}: {
  anchor: HTMLElement
  mine: boolean
  text: string
  /** Your current reaction on this message, if any (tapping it again removes it). */
  myReaction?: string
  canReact: boolean
  canReply: boolean
  onReact: (emoji: string | null) => void
  onReply: () => void
  onClose: () => void
}) {
  const toast = useToast()
  const [picker, setPicker] = useState(false)
  // Measured once when it opens (it closes on resize).
  const [pos] = useState(() => placeMenu(anchor, mine))
  const firstRef = useRef<HTMLButtonElement>(null)
  const returnFocus = useRef<Element | null>(null)
  // Lifting the finger after a long-press lands on the backdrop: ignore that first click.
  const [openedAt] = useState(() => performance.now())
  const closeRef = useRef(onClose)
  useLayoutEffect(() => {
    closeRef.current = onClose
  }, [onClose])

  // Keep the message itself bright above the dimmed screen, like WhatsApp: a
  // copy of it is drawn on top, exactly where it is (the list clips the original).
  const liftRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const host = liftRef.current
    if (!host) return
    const r = anchor.getBoundingClientRect()
    const copy = anchor.cloneNode(true) as HTMLElement
    copy.removeAttribute('id')
    copy.setAttribute('aria-hidden', 'true')
    copy.style.animation = 'none'
    copy.style.transform = 'none'
    copy.style.margin = '0'
    Object.assign(host.style, {
      top: `${r.top}px`,
      left: `${r.left}px`,
      width: `${r.width}px`,
    })
    host.replaceChildren(copy)
  }, [anchor])

  useEffect(() => {
    returnFocus.current = document.activeElement
    firstRef.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current()
    }
    const onScroll = () => closeRef.current()
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onScroll)
      if (returnFocus.current instanceof HTMLElement) {
        returnFocus.current.focus({ preventScroll: true })
      }
    }
  }, [])

  function react(emoji: string) {
    onReact(emoji === myReaction ? null : emoji)
    onClose()
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      toast.show({ title: 'Copied', tone: 'success' })
    } catch {
      toast.show({ title: 'Couldn’t copy', tone: 'danger' })
    }
    onClose()
  }

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div
        aria-hidden="true"
        className="slide-overlay absolute inset-0 bg-black/50"
        data-state="open"
        onClick={() => {
          if (performance.now() - openedAt > 500) onClose()
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          onClose()
        }}
      />
      {picker ? null : (
        <div ref={liftRef} aria-hidden="true" className="pointer-events-none absolute" />
      )}
      {picker ? (
        <div
          role="dialog"
          aria-label="Pick a reaction"
          className="slide-sheet absolute inset-x-0 bottom-0 mx-auto max-w-md rounded-t-card border border-line surface-panel p-3 pb-safe"
          data-state="open"
        >
          <Suspense
            fallback={
              <div className="flex h-[21rem] items-center justify-center text-sm text-fg-muted">
                Loading…
              </div>
            }
          >
            <EmojiPickerPanel onPick={react} />
          </Suspense>
        </div>
      ) : pos ? (
        <div
          role="menu"
          aria-label="Message options"
          className={cn(
            'slide-pop absolute flex flex-col gap-1',
            pos.below ? '' : '-translate-y-full',
          )}
          style={{
            top: pos.top,
            left: pos.left,
            width: Math.min(MENU_W, window.innerWidth - MARGIN * 2),
          }}
        >
          {canReact ? (
            <div className="flex items-center justify-between rounded-pill border border-line surface-panel p-1">
              {QUICK_REACTIONS.map((e, i) => (
                <button
                  key={e}
                  ref={i === 0 ? firstRef : undefined}
                  type="button"
                  role="menuitem"
                  aria-label={`React ${e}${e === myReaction ? ' (remove)' : ''}`}
                  onClick={() => react(e)}
                  className={cn(
                    'flex size-10 items-center justify-center rounded-full text-2xl transition-transform active:scale-90',
                    e === myReaction ? 'bg-surface-high' : 'hover:bg-surface-high',
                  )}
                >
                  {e}
                </button>
              ))}
              <button
                type="button"
                role="menuitem"
                aria-label="More reactions"
                onClick={() => setPicker(true)}
                className="flex size-10 items-center justify-center rounded-full bg-surface-high text-fg-muted hover:text-fg"
              >
                <Icon name="plus" size={20} />
              </button>
            </div>
          ) : null}
          <div className="flex flex-col overflow-hidden rounded-card border border-line surface-panel">
            {canReply ? (
              <button
                type="button"
                role="menuitem"
                ref={canReact ? undefined : firstRef}
                onClick={() => {
                  onReply()
                  onClose()
                }}
                className="flex h-12 items-center gap-3 px-4 text-left hover:bg-surface-high"
              >
                <Icon name="reply" size={18} />
                Reply
              </button>
            ) : null}
            <button
              type="button"
              role="menuitem"
              onClick={() => void copy()}
              className="flex h-12 items-center gap-3 border-t border-line px-4 text-left first:border-t-0 hover:bg-surface-high"
            >
              <Icon name="copy" size={18} />
              Copy text
            </button>
          </div>
        </div>
      ) : null}
    </div>,
    document.body,
  )
}

function placeMenu(anchor: HTMLElement, mine: boolean) {
  const r = anchor.getBoundingClientRect()
  const vw = window.innerWidth
  const w = Math.min(MENU_W, vw - MARGIN * 2)
  const left = Math.min(Math.max(MARGIN, mine ? r.right - w : r.left), vw - w - MARGIN)
  // Above the message, unless it's near the top of the screen.
  const below = r.top < 200
  return { top: below ? r.bottom + 8 : r.top - 8, left, below }
}
