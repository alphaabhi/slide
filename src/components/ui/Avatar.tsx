import { cn } from '@/lib/cn'
import { initialOf } from '@/lib/initials'

export type Side = 'you' | 'them'

export function Avatar({
  name,
  side,
  size = 'md',
  className,
}: {
  name: string
  side: Side
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-display font-bold',
        side === 'you' ? 'bg-you text-you-ink' : 'bg-them text-them-ink',
        size === 'sm' && 'size-7 text-xs',
        size === 'md' && 'size-10 text-base',
        size === 'lg' && 'size-14 text-xl',
        className,
      )}
    >
      {initialOf(name)}
    </span>
  )
}
