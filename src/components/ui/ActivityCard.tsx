import { cn } from '@/lib/cn'
import { Button } from './Button'
import { Icon } from './Icon'

export type ActivityKind = 'would-you-rather' | 'this-or-that' | 'question-of-the-day'

const kindLabel: Record<ActivityKind, string> = {
  'would-you-rather': 'Would you rather',
  'this-or-that': 'This or that',
  'question-of-the-day': 'Question of the day',
}

export interface ActivityOption {
  id: string
  label: string
}

export interface ActivityCardProps {
  kind: ActivityKind
  prompt: string
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
  onChoose?: (optionId: string) => void
  onSkip?: () => void
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
  onChoose,
  onSkip,
}: ActivityCardProps) {
  const revealed = yourChoice !== undefined && theirChoice !== undefined
  const matched = revealed && yourChoice === theirChoice

  let statusText: string
  if (revealed) statusText = matched ? 'Same pick. Interesting.' : 'Different picks. Discuss.'
  else if (yourChoice) statusText = `Waiting for ${themName} to choose`
  else if (theyAnswered) statusText = `${themName} has chosen. Your turn.`
  else statusText = 'Pick one. Answers show when you both have.'

  return (
    <section
      aria-label={kindLabel[kind]}
      className="relative overflow-hidden rounded-card border border-line surface-panel p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="label-meta inline-flex items-center gap-1.5 text-gold">
          <Icon name="sparkle" size={14} />
          {kindLabel[kind]}
        </p>
        {onSkip && !revealed ? (
          <Button variant="ghost" size="sm" onClick={onSkip} className="-mr-3 text-fg-muted">
            <Icon name="skip" size={16} />
            Skip
          </Button>
        ) : null}
      </div>

      <h3 className="mt-3 text-2xl">{prompt}</h3>

      <div className="mt-5 grid gap-3" role="group" aria-label="Choices">
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
                'transition-[background-color,border-color,transform] duration-[var(--duration-base)] ease-[var(--ease-out)]',
                'enabled:active:scale-[0.98] disabled:cursor-default',
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

      <p className="mt-4 text-sm text-fg-muted" aria-live="polite">
        {statusText}
      </p>
    </section>
  )
}
