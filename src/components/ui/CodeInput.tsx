import { useId, useRef, useState } from 'react'
import { cn } from '@/lib/cn'

/**
 * One-time code entry shown as separate boxes.
 *
 * It's a single real <input> laid over the boxes, not one input per box, so:
 * the phone's "From Mail" suggestion, password managers and pasting all fill
 * every digit at once; screen readers hear one labelled field; backspace and
 * cursor keys behave normally.
 */
export function CodeInput({
  label,
  length,
  value,
  onChange,
  onComplete,
  error,
  hint,
  disabled,
  autoFocus,
}: {
  label: string
  length: number
  value: string
  onChange: (value: string) => void
  /** Called once the last digit is entered (typed, pasted or autofilled). */
  onComplete?: (value: string) => void
  error?: string
  hint?: string
  disabled?: boolean
  autoFocus?: boolean
}) {
  const id = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [focused, setFocused] = useState(false)
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  const active = Math.min(value.length, length - 1)

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-semibold text-fg">
        {label}
      </label>
      <div className="relative" onClick={() => inputRef.current?.focus()}>
        <div
          aria-hidden="true"
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))` }}
        >
          {Array.from({ length }, (_, i) => {
            const char = value[i]
            const isActive = focused && i === active
            return (
              <div
                key={i}
                className={cn(
                  'flex h-14 items-center justify-center rounded-md border bg-surface font-meta text-2xl text-fg',
                  'transition-[border-color,box-shadow] duration-[var(--duration-fast)]',
                  error
                    ? 'border-danger'
                    : isActive
                      ? 'border-you shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-you)_25%,transparent)]'
                      : char
                        ? 'border-fg-muted'
                        : 'border-line',
                )}
              >
                {char ??
                  (isActive ? (
                    <span className="h-6 w-0.5 animate-pulse bg-fg motion-reduce:animate-none" />
                  ) : null)}
              </div>
            )
          })}
        </div>
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          // No maxLength: the browser would cut a pasted "Code: 123 456" before we can pick out the digits.
          autoFocus={autoFocus}
          disabled={disabled}
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          value={value}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => {
            // Keep digits only; a pasted "123 456" or "Code: 123456" still works.
            const next = e.target.value.replace(/\D/g, '').slice(0, length)
            onChange(next)
            if (next.length === length) onComplete?.(next)
          }}
          // Invisible but still the real, focusable field (covers the boxes so taps land on it).
          className="absolute inset-0 h-full w-full cursor-text bg-transparent text-transparent caret-transparent outline-none selection:bg-transparent"
          style={{ fontSize: 16 }}
        />
      </div>
      {error ? (
        <p id={`${id}-error`} className="flex items-center gap-1.5 text-sm text-danger">
          <span aria-hidden="true">!</span>
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-fg-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
