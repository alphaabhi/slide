import { useState } from 'react'
import { applyTheme, readTheme, THEMES, type Theme } from '@/design/theme'
import { cn } from '@/lib/cn'

const labels: Record<Theme, string> = { violet: 'Violet', graphite: 'Graphite' }

/** Segmented control for choosing the app theme. */
export function ThemeSwitch({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>(() => readTheme())

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={cn('inline-flex rounded-pill border border-line surface-glass p-1', className)}
    >
      {THEMES.map((t) => (
        <button
          key={t}
          type="button"
          role="radio"
          aria-checked={theme === t}
          onClick={() => {
            setTheme(t)
            applyTheme(t, true)
          }}
          className={cn(
            'h-[var(--touch-target)] min-w-24 rounded-pill px-4 font-display text-sm font-semibold transition-colors duration-[var(--duration-fast)]',
            theme === t ? 'bg-you-fill text-you-ink' : 'text-fg-muted hover:text-fg',
          )}
        >
          {labels[t]}
        </button>
      ))}
    </div>
  )
}
