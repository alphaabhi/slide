import { useEffect, useRef } from 'react'

/**
 * Keeps a full-screen element exactly the size of the visible area, so the
 * message box sits right above the on-screen keyboard.
 *
 * Android Chrome resizes the page for the keyboard (see interactive-widget in
 * index.html). iOS Safari doesn't: it overlays the keyboard and may scroll the
 * page. There we follow window.visualViewport (the part actually visible) and
 * pin the element to it.
 */
export function useViewportFit<T extends HTMLElement>() {
  const ref = useRef<T>(null)

  useEffect(() => {
    const el = ref.current
    const vv = window.visualViewport
    if (!el || !vv) return

    const fit = () => {
      el.style.height = `${vv.height}px`
      el.style.transform = `translateY(${vv.offsetTop}px)`
    }
    fit()
    vv.addEventListener('resize', fit)
    vv.addEventListener('scroll', fit)

    // The chat scrolls inside itself; stop the page behind it from scrolling.
    const html = document.documentElement
    const prev = html.style.overflow
    html.style.overflow = 'hidden'

    return () => {
      vv.removeEventListener('resize', fit)
      vv.removeEventListener('scroll', fit)
      html.style.overflow = prev
    }
  }, [])

  return ref
}
