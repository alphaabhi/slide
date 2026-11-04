import { forwardRef, useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

const control =
  'w-full rounded-md border bg-surface px-4 text-base text-fg placeholder:text-fg-muted/80 ' +
  'transition-[border-color,box-shadow] duration-[var(--duration-fast)] ' +
  'focus:outline-none focus-visible:outline-none focus:border-you focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-you)_30%,transparent)] ' +
  'disabled:opacity-50'

interface FieldShellProps {
  id: string
  label: string
  hideLabel?: boolean
  hint?: string
  error?: string
  children: React.ReactNode
}

function FieldShell({ id, label, hideLabel, hint, error, children }: FieldShellProps) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className={cn('text-sm font-semibold text-fg', hideLabel && 'sr-only')}>
        {label}
      </label>
      {children}
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

function describedBy(id: string, hint?: string, error?: string) {
  if (error) return `${id}-error`
  if (hint) return `${id}-hint`
  return undefined
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  hideLabel?: boolean
  hint?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hideLabel, hint, error, id: idProp, className, ...rest },
  ref,
) {
  const autoId = useId()
  const id = idProp ?? autoId
  return (
    <FieldShell id={id} label={label} hideLabel={hideLabel} hint={hint} error={error}>
      <input
        ref={ref}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cn(
          control,
          'h-[var(--control-height)]',
          error ? 'border-danger' : 'border-line',
          className,
        )}
        {...rest}
      />
    </FieldShell>
  )
})

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string
  hideLabel?: boolean
  hint?: string
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hideLabel, hint, error, id: idProp, className, ...rest },
  ref,
) {
  const autoId = useId()
  const id = idProp ?? autoId
  return (
    <FieldShell id={id} label={label} hideLabel={hideLabel} hint={hint} error={error}>
      <textarea
        ref={ref}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cn(control, 'min-h-24 py-3', error ? 'border-danger' : 'border-line', className)}
        {...rest}
      />
    </FieldShell>
  )
})
