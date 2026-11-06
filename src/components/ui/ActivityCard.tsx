import { cn } from '@/lib/cn'
import { Button } from './Button'
import { activityLabel, type ActivityKind } from './activityLabels'
import { Icon } from './Icon'

export type { ActivityKind }

export interface ActivityOption {
  id: string
  label: string
}

export interface ActivityCardProps {
  kind: ActivityKind
  /** A question above the options. Omit when the options say it all. */
  prompt?: string
  options: ActivityOption[]
  youName: string
  themName: string
  /** Option the viewer picked, if any. */
  yourChoice?: string
  /** Partner's pick — only passed once BOTH have answered (server reveals it then). */
  theirChoice?: string
  /** True when the partner has answered but the answer is still hidden. */
  theyAnswered?: boolean
  busy?: boolean
  /** Small line under the title, e.g. who started it. */
  meta?: string
  onChoose?: (optionId: string) => void
  onSkip?: () => void
  /** After the reveal: play another round of the same game. */
  onNext?: () => void
  nextBusy?: boolean
}

/**
 * Choice-based activities (Would You Rather, This or That).
 * Answers stay hidden until both people have chosen, so neither can copy the other.
 */
export function ActivityCard({
  kind,
  prompt,
  options,
  youName,
  themName,
  yourChoice,
  theirChoice,
  theyAnswered = false,
  busy = false,
  meta,
  onChoose,
  onSkip,
  onNext,
  nextBusy = false,
}: ActivityCardProps) {
  const revealed = yourChoice !== undefined && theirChoice !== undefined
  const matched = revealed && yourChoice === theirChoice
  const label = activityLabel[kind]

  let statusText: string
  if (revealed) statusText = matched ? 'Same pick. Interesting… ✨' : 'Different picks. Discuss.'
  else if (yourChoice) statusText = `Waiting for ${themName} to choose`
  else if (theyAnswered) statusText = `${themName} has chosen. Your turn.`
  else statusText = 'Pick one. Answers show when you both have.'

  return (
    <section
      aria-label={label}
      className={cn(
        'relative overflow-hidden rounded-card border surface-panel p-5',
        matched ? 'border-glow/60 slide-match' : 'border-line',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="label-meta inline-flex items-center gap-1.5 text-gold">
            <Icon name="sparkle" size={14} />
            {label}
          </h3>
          {meta ? <p className="mt-0.5 truncate text-xs text-fg-muted">{meta}</p> : null}
        </div>
        {onSkip && !revealed ? (
          <Button variant="ghost" size="sm" onClick={onSkip} className="-mr-3 text-fg-muted">
            <Icon name="skip" size={16} />
            Skip
          </Button>
        ) : null}
      </div>

      {prompt ? <p className="mt-3 font-display text-2xl font-semibold">{prompt}</p> : null}

      <div className={cn('grid gap-3', prompt ? 'mt-5' : 'mt-4')} role="group" aria-label="Choices">
        {options.map((opt) => {
          const youPicked = yourChoice === opt.id
          const theyPicked = revealed && theirChoice === opt.id
          return (
            <button
              key={opt.id}
              type="button"
              disabled={busy || yourChoice !== undefined}
              aria-pressed={youPicked}
              onClick={() => onChoose?.(opt.id)}
              className={cn(
                'group relative flex min-h-14 w-full items-center justify-between gap-3 rounded-[1.125rem] border-2 px-4 py-3 text-left font-display text-lg font-semibold',
                'transition-[background-color,border-color,transform,opacity] duration-[var(--duration-base)] ease-[var(--ease-out)]',
                'enabled:active:scale-[0.98] disabled:cursor-default',
                revealed && 'slide-reveal',
                youPicked &&
                  theyPicked &&
                  'border-glow bg-you text-you-ink shadow-[0_0_28px_-6px_var(--color-glow)]',
                youPicked && !theyPicked && 'border-you bg-you text-you-ink',
                !youPicked && theyPicked && 'border-them bg-them text-them-ink',
                !youPicked &&
                  !theyPicked &&
                  'border-line bg-surface-high/40 text-fg enabled:hover:border-fg-muted',
                yourChoice && !youPicked && !theyPicked && 'opacity-55',
              )}
            >
              <span className="min-w-0 [overflow-wrap:anywhere]">{opt.label}</span>
              <span className="flex shrink-0 gap-1">
                {youPicked ? (
                  <span className="rounded-pill bg-you-ink/15 px-2 py-0.5 text-xs font-bold">
                    {youName}
                  </span>
                ) : null}
                {theyPicked ? (
                  <span
                    className={cn(
                      'rounded-pill px-2 py-0.5 text-xs font-bold',
                      youPicked ? 'bg-them text-them-ink' : 'bg-them-ink/15',
                    )}
                  >
                    {themName}
                  </span>
                ) : null}
              </span>
            </button>
          )
        })}
      </div>

      <div className="mt-4 flex min-h-8 items-center justify-between gap-3">
        <p className="text-sm text-fg-muted" aria-live="polite">
          {statusText}
        </p>
        {revealed && onNext ? (
          <Button variant="secondary" size="sm" loading={nextBusy} onClick={onNext}>
            Another one
          </Button>
        ) : null}
      </div>
    </section>
  )
}
