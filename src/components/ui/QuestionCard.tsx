import { useId, useState, type FormEvent } from 'react'
import { cn } from '@/lib/cn'
import { activityLabel } from './activityLabels'
import { Button } from './Button'
import { Icon } from './Icon'

export interface QuestionCardProps {
  prompt: string
  youName: string
  themName: string
  /** The viewer's answer, once given. */
  yourAnswer?: string
  /** The other person's answer — only passed after both have answered. */
  theirAnswer?: string
  theyAnswered?: boolean
  busy?: boolean
  error?: string
  meta?: string
  onAnswer?: (text: string) => void
  onSkip?: () => void
}

export const MAX_ANSWER_LENGTH = 500

/** Question of the Day: a free-text answer each, unlocked together. */
export function QuestionCard({
  prompt,
  youName,
  themName,
  yourAnswer,
  theirAnswer,
  theyAnswered = false,
  busy = false,
  error,
  meta,
  onAnswer,
  onSkip,
}: QuestionCardProps) {
  const id = useId()
  const [draft, setDraft] = useState('')
  const revealed = yourAnswer !== undefined && theirAnswer !== undefined
  const tooLong = draft.length > MAX_ANSWER_LENGTH
  const label = activityLabel['question-of-the-day']

  function submit(e: FormEvent) {
    e.preventDefault()
    const text = draft.trim()
    if (!text || tooLong || busy) return
    onAnswer?.(text)
  }

  let statusText: string
  if (revealed) statusText = 'Both answers are in.'
  else if (yourAnswer !== undefined) statusText = `Waiting for ${themName} to answer`
  else if (theyAnswered) statusText = `${themName} has answered. Your turn.`
  else statusText = 'Answers unlock when you’ve both replied.'

  return (
    <section
      aria-label={label}
      className="relative overflow-hidden rounded-card border border-line surface-panel p-5"
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

      <p className="mt-3 font-display text-xl font-semibold">{prompt}</p>

      {yourAnswer === undefined ? (
        <form onSubmit={submit} className="mt-4 grid gap-3" noValidate>
          <label htmlFor={`${id}-answer`} className="sr-only">
            Your answer
          </label>
          <textarea
            id={`${id}-answer`}
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Only ${themName} will see this, once they answer too`}
            aria-invalid={tooLong || !!error}
            aria-describedby={error || tooLong ? `${id}-error` : undefined}
            className={cn(
              'block w-full resize-none rounded-[1.125rem] border bg-surface-high/40 px-4 py-3 text-base text-fg placeholder:text-fg-muted/80',
              'focus:border-fg-muted focus:outline-none focus-visible:outline-none',
              tooLong || error ? 'border-danger' : 'border-line',
            )}
          />
          {error || tooLong ? (
            <p id={`${id}-error`} className="text-sm text-danger">
              {tooLong ? `Keep it under ${MAX_ANSWER_LENGTH} characters.` : error}
            </p>
          ) : null}
          <Button type="submit" loading={busy} disabled={!draft.trim() || tooLong}>
            {busy ? 'Sending' : 'Answer'}
          </Button>
        </form>
      ) : (
        <div className="mt-4 grid gap-3">
          <Answer who={youName} side="you" text={yourAnswer} reveal={revealed} />
          {revealed ? (
            <Answer who={themName} side="them" text={theirAnswer} reveal />
          ) : (
            <div className="flex min-h-16 items-center justify-center rounded-[1.125rem] border border-dashed border-line px-4 text-sm text-fg-muted">
              {theyAnswered ? 'Unlocking…' : `${themName}’s answer appears here`}
            </div>
          )}
        </div>
      )}

      <p className="mt-4 text-sm text-fg-muted" aria-live="polite">
        {statusText}
      </p>
    </section>
  )
}

function Answer({
  who,
  side,
  text,
  reveal,
}: {
  who: string
  side: 'you' | 'them'
  text: string
  reveal: boolean
}) {
  return (
    <figure
      className={cn(
        'rounded-[1.125rem] border-2 px-4 py-3',
        side === 'you' ? 'border-you/70' : 'border-them/70',
        reveal && 'slide-reveal',
      )}
    >
      <figcaption className={cn('label-meta', side === 'you' ? 'text-fg' : 'text-them')}>
        {who}
      </figcaption>
      <p className="mt-1 whitespace-pre-wrap [overflow-wrap:anywhere]">{text}</p>
    </figure>
  )
}
