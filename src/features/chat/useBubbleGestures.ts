import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'

/** How far a finger must drag right (px) to trigger a reply. */
export const SWIPE_TRIGGER = 56
const SWIPE_MAX = 80
const LONG_PRESS_MS = 450
const DOUBLE_TAP_MS = 350
const MOVE_SLOP = 10

/**
 * Touch gestures on a message bubble, like WhatsApp/Instagram:
 * - double-tap → onDoubleTap (like)
 * - press and hold → onLongPress (reaction menu)
 * - drag right → onSwipe (reply); the bubble follows the finger and springs back
 *
 * Vertical scrolling is left to the browser (the bubble uses touch-action: pan-y),
 * so these never fight with scrolling. A mouse gets double-click and right-click;
 * dragging with a mouse selects text as usual.
 */
export function useBubbleGestures({
  onDoubleTap,
  onLongPress,
  onSwipe,
  enabled = true,
}: {
  onDoubleTap?: () => void
  onLongPress?: (el: HTMLElement) => void
  onSwipe?: () => void
  enabled?: boolean
}) {
  const [offset, setOffset] = useState(0)
  const g = useRef({
    id: -1,
    x: 0,
    y: 0,
    moved: false,
    swiping: false,
    longPressed: false,
    timer: 0,
    lastTapAt: 0,
    lastTapX: 0,
    lastTapY: 0,
    armed: false,
  })
  const cbs = useRef({ onDoubleTap, onLongPress, onSwipe })
  useEffect(() => {
    cbs.current = { onDoubleTap, onLongPress, onSwipe }
  }, [onDoubleTap, onLongPress, onSwipe])

  useEffect(() => () => window.clearTimeout(g.current.timer), [])

  const reset = useCallback(() => {
    window.clearTimeout(g.current.timer)
    g.current.id = -1
    g.current.swiping = false
    setOffset(0)
  }, [])

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      if (!enabled || (e.pointerType === 'mouse' && e.button !== 0)) return
      const s = g.current
      s.id = e.pointerId
      s.x = e.clientX
      s.y = e.clientY
      s.moved = false
      s.swiping = false
      s.longPressed = false
      s.armed = false
      window.clearTimeout(s.timer)
      if (e.pointerType !== 'mouse' && cbs.current.onLongPress) {
        const el = e.currentTarget
        s.timer = window.setTimeout(() => {
          s.longPressed = true
          navigator.vibrate?.(12)
          cbs.current.onLongPress?.(el)
        }, LONG_PRESS_MS)
      }
    },
    [enabled],
  )

  const onPointerMove = useCallback((e: PointerEvent<HTMLElement>) => {
    const s = g.current
    if (e.pointerId !== s.id) return
    const dx = e.clientX - s.x
    const dy = e.clientY - s.y
    if (!s.moved && Math.hypot(dx, dy) > MOVE_SLOP) {
      s.moved = true
      window.clearTimeout(s.timer)
    }
    if (e.pointerType === 'mouse' || !cbs.current.onSwipe || s.longPressed) return
    if (!s.swiping && dx > MOVE_SLOP && dx > Math.abs(dy) * 1.5) s.swiping = true
    if (s.swiping) {
      // Follows the finger, then resists past the trigger point.
      const d = Math.max(0, dx)
      const next = d < SWIPE_TRIGGER ? d : SWIPE_TRIGGER + (d - SWIPE_TRIGGER) * 0.25
      const clamped = Math.min(next, SWIPE_MAX)
      if (clamped >= SWIPE_TRIGGER && !s.armed) {
        s.armed = true
        navigator.vibrate?.(8)
      } else if (clamped < SWIPE_TRIGGER) s.armed = false
      setOffset(clamped)
    }
  }, [])

  const onPointerUp = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      const s = g.current
      if (e.pointerId !== s.id) return
      window.clearTimeout(s.timer)
      if (s.swiping) {
        if (s.armed) cbs.current.onSwipe?.()
        reset()
        return
      }
      if (s.moved || s.longPressed) return reset()
      // A tap: was it the second of a double-tap?
      const now = e.timeStamp
      if (
        now - s.lastTapAt < DOUBLE_TAP_MS &&
        Math.hypot(e.clientX - s.lastTapX, e.clientY - s.lastTapY) < 30
      ) {
        s.lastTapAt = 0
        cbs.current.onDoubleTap?.()
      } else {
        s.lastTapAt = now
        s.lastTapX = e.clientX
        s.lastTapY = e.clientY
      }
      s.id = -1
    },
    [reset],
  )

  const onContextMenu = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (!enabled || !cbs.current.onLongPress) return
      // Android fires this on long-press (we've already opened the menu); a mouse
      // right-click opens it too, with Copy inside.
      e.preventDefault()
      if (!g.current.longPressed) cbs.current.onLongPress(e.currentTarget)
    },
    [enabled],
  )

  return {
    offset,
    handlers: enabled
      ? { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: reset, onContextMenu }
      : {},
  }
}
