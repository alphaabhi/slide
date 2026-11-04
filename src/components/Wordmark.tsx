import { cn } from '@/lib/cn'

/**
 * The SLIDE wordmark: the two duo colours slide past each other in the "I".
 * Rendered as text (selectable, accessible) with a decorative mark.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-baseline font-display font-extrabold tracking-[-0.04em]',
        className,
      )}
      aria-label="SLIDE"
      role="img"
    >
      <span aria-hidden="true">SL</span>
      <span
        aria-hidden="true"
        className="relative mx-[0.04em] inline-block h-[0.72em] w-[0.22em] self-center"
      >
        <span className="absolute top-0 left-0 h-[55%] w-full rounded-[0.08em] bg-you-fill" />
        <span className="absolute bottom-0 left-0 h-[55%] w-full translate-y-[8%] rounded-[0.08em] bg-them" />
      </span>
      <span aria-hidden="true">DE</span>
    </span>
  )
}
