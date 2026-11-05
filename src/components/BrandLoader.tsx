import { cn } from '@/lib/cn'

/**
 * Full-screen loading state: the SLIDE "I" — two pills sliding past each other.
 * index.html renders the same markup before any JavaScript arrives, so the
 * first paint is never a blank screen. Respects reduced motion.
 */
export function BrandLoader({
  label = 'Loading',
  className,
}: {
  label?: string
  className?: string
}) {
  return (
    <div role="status" aria-label={label} className={cn('slide-loader', className)}>
      <span className="slide-loader-mark" aria-hidden="true">
        <span />
        <span />
      </span>
    </div>
  )
}
