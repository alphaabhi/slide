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
      {/*
        The "I": two equal halves, exactly cap height, bottom on the baseline,
        with the same visual gap to the L and the D as between other letters.
        (Uneven margins compensate for the font's tracking and the D's side bearing.)
      */}
      <span
        aria-hidden="true"
        className="relative mr-[0.005em] ml-[0.085em] inline-block h-[0.757em] w-[0.2em]"
      >
        <span className="absolute top-0 left-0 h-[calc(50%-0.02em)] w-full rounded-[0.07em] bg-you" />
        <span className="absolute bottom-0 left-0 h-[calc(50%-0.02em)] w-full rounded-[0.07em] bg-them" />
      </span>
      <span aria-hidden="true">DE</span>
    </span>
  )
}
