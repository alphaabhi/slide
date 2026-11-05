import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Spinner } from './Spinner'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'md' | 'sm'

const base =
  'inline-flex select-none items-center justify-center gap-2 rounded-pill font-display font-semibold tracking-[-0.01em] ' +
  'transition-[background-color,color,transform,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-out)] ' +
  'active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100'

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-you text-you-ink shadow-[0_8px_24px_-10px_var(--color-you)] hover:brightness-110',
  secondary: 'bg-surface text-fg border border-line hover:bg-surface-high',
  ghost: 'bg-transparent text-fg hover:bg-surface-high',
  danger: 'bg-danger-surface text-danger border border-danger/40 hover:bg-danger-hover',
}

const sizes: Record<ButtonSize, string> = {
  md: 'h-[var(--control-height)] px-6 text-base',
  sm: 'h-[var(--touch-target)] px-4 text-sm',
}

const iconSizes: Record<ButtonSize, string> = {
  md: 'size-[var(--control-height)]',
  sm: 'size-[var(--touch-target)]',
}

type BaseProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Shows a spinner, disables the button and sets aria-busy. */
  loading?: boolean
}

/** Icon-only buttons must have an accessible name — enforced by the type. */
type ButtonProps =
  | (BaseProps & { iconOnly?: false; children: ReactNode })
  | (BaseProps & { iconOnly: true; 'aria-label': string; children: ReactNode })

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    iconOnly = false,
    disabled,
    className,
    children,
    type = 'button',
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(base, variants[variant], iconOnly ? iconSizes[size] : sizes[size], className)}
      {...rest}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  )
})
