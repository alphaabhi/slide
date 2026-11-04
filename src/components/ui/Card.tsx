import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-card border border-line bg-pine-raised p-5 shadow-[var(--shadow-raised)]',
        className,
      )}
      {...rest}
    />
  )
}
