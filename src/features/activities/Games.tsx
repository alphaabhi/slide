import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ActivityCard, type ActivityKind } from '@/components/ui/ActivityCard'
import { Dialog } from '@/components/ui/Dialog'
import { Icon } from '@/components/ui/Icon'
import { QuestionCard } from '@/components/ui/QuestionCard'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/cn'
import { activityErrorMessage, useAnswerRound, useSkipRound, viewRound, type Round } from './api'
import { GAMES, type GameKind } from './prompts'
import { scrollToRound } from './useStartGame'

const cardKind: Record<GameKind, ActivityKind> = {
  would_you_rather: 'would-you-rather',
  this_or_that: 'this-or-that',
  question_of_the_day: 'question-of-the-day',
}

/* ------------------------------------------------------------------ card */

export function RoundCard({
  round,
  spaceId,
  myId,
  myName,
  partnerName,
  closed,
  onNext,
  nextBusy,
}: {
  round: Round
  spaceId: string
  myId: string
  myName: string
  partnerName: string
  closed: boolean
  onNext?: (kind: GameKind) => void
  nextBusy?: boolean
}) {
  const v = viewRound(round, myId)
  const answer = useAnswerRound(spaceId)
  const skip = useSkipRound(spaceId)
  const toast = useToast()
  const [error, setError] = useState<string>()
  const startedByMe = round.started_by === myId
  const meta = startedByMe ? 'You started this' : `${partnerName} started this`

  if (round.status === 'skipped') {
    const who = round.skipped_by === myId ? 'You' : partnerName
    return (
      <p className="flex justify-center">
        <span className="inline-flex items-center gap-1.5 rounded-pill border border-line px-3 py-1 text-xs text-fg-muted">
          <Icon name="skip" size={12} />
          {who} skipped {GAMES[round.kind].title.toLowerCase()}: “{round.prompt}”
        </span>
      </p>
    )
  }

  const canAct = !closed && round.status === 'open'
  const onSkip = canAct
    ? () =>
        skip.mutate(round.id, {
          onError: (err) =>
            toast.show({
              title: 'Couldn’t skip',
              description: activityErrorMessage(err),
              tone: 'danger',
            }),
        })
    : undefined

  if (round.kind === 'question_of_the_day') {
    return (
      <QuestionCard
        prompt={round.prompt}
        youName={myName}
        themName={partnerName}
        yourAnswer={v.mine?.answer ?? (v.iAnswered ? '…' : undefined)}
        theirAnswer={v.theirs?.answer ?? undefined}
        theyAnswered={v.theyAnswered}
        busy={answer.isPending}
        error={error}
        meta={meta}
        onAnswer={
          canAct
            ? (text) => {
                setError(undefined)
                answer.mutate(
                  { roundId: round.id, answer: text },
                  { onError: (err) => setError(activityErrorMessage(err)) },
                )
              }
            : undefined
        }
        onSkip={onSkip}
      />
    )
  }

  // Show the tapped option straight away while it saves.
  const pending = answer.isPending ? answer.variables?.choice : undefined
  const yourChoice = v.mine?.choice ?? pending ?? undefined
  return (
    <ActivityCard
      kind={cardKind[round.kind]}
      options={[
        { id: 'a', label: round.option_a ?? '' },
        { id: 'b', label: round.option_b ?? '' },
      ]}
      youName={myName}
      themName={partnerName}
      yourChoice={yourChoice}
      theirChoice={v.theirs?.choice ?? undefined}
      theyAnswered={v.theyAnswered}
      busy={answer.isPending || !canAct}
      meta={meta}
      onChoose={
        canAct
          ? (choice) =>
              answer.mutate(
                { roundId: round.id, choice: choice as 'a' | 'b' },
                {
                  onError: (err) =>
                    toast.show({
                      title: 'Couldn’t save your pick',
                      description: activityErrorMessage(err),
                      tone: 'danger',
                    }),
                },
              )
          : undefined
      }
      onSkip={onSkip}
      onNext={!closed && onNext ? () => onNext(round.kind) : undefined}
      nextBusy={nextBusy}
    />
  )
}

/* ------------------------------------------------------------ play sheet */

/** "Play" button beside the message box, opening the list of games. */
export function PlaySheet({
  disabledReason,
  rounds,
  myId,
  starting,
  onPlay,
}: {
  /** Why games can't start right now (e.g. waiting for the other person), if so. */
  disabledReason?: string
  rounds: Round[]
  myId: string
  starting: GameKind | null
  onPlay: (kind: GameKind) => Promise<boolean>
}) {
  const [open, setOpen] = useState(false)
  // When the sheet was last opened (for "today's question" below).
  const [openedAt, setOpenedAt] = useState(0)
  const openByKind = useMemo(() => {
    const m = new Map<GameKind, Round>()
    for (const r of rounds) if (r.status === 'open' && !m.has(r.kind)) m.set(r.kind, r)
    return m
  }, [rounds])
  const qotdToday = rounds.find(
    (r) =>
      r.kind === 'question_of_the_day' &&
      openedAt - new Date(r.created_at).getTime() < 20 * 3600_000,
  )

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) setOpenedAt(Date.now())
        setOpen(o)
      }}
      title="Play something"
      description="Answers stay hidden until you’ve both picked."
      trigger={
        <button
          type="button"
          aria-label="Play a game"
          className="mb-0.5 inline-flex size-[var(--control-height)] shrink-0 items-center justify-center rounded-full border border-line text-gold transition-[transform,background-color] duration-[var(--duration-fast)] hover:bg-surface-high active:scale-90"
        >
          <Icon name="sparkle" size={20} />
        </button>
      }
    >
      {disabledReason ? (
        <p className="rounded-card border border-line px-4 py-3 text-sm text-fg-muted">
          {disabledReason}
        </p>
      ) : (
        <ul className="grid gap-3">
          {(Object.keys(GAMES) as GameKind[]).map((kind) => {
            const g = GAMES[kind]
            const open = openByKind.get(kind)
            const waitingOnMe = open && !open.answered_by.includes(myId)
            let note: ReactNode = g.blurb
            if (open) note = waitingOnMe ? 'One’s waiting for you' : 'Waiting for their answer'
            else if (kind === 'question_of_the_day' && qotdToday) note = 'Today’s is in the chat'
            return (
              <li key={kind}>
                <button
                  type="button"
                  disabled={starting !== null}
                  onClick={async () => {
                    if (await onPlay(kind)) setOpen(false)
                  }}
                  className={cn(
                    'flex w-full items-center gap-4 rounded-card border border-line p-4 text-left',
                    'transition-colors duration-[var(--duration-fast)] hover:bg-surface-high disabled:opacity-60',
                  )}
                >
                  <span aria-hidden="true" className="text-3xl">
                    {g.emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-lg font-semibold">{g.title}</span>
                    <span
                      className={cn(
                        'block text-sm',
                        waitingOnMe ? 'font-semibold text-gold' : 'text-fg-muted',
                      )}
                    >
                      {note}
                    </span>
                  </span>
                  {starting === kind ? (
                    <span className="text-xs text-fg-muted">Starting…</span>
                  ) : (
                    <Icon name="send" size={18} className="text-fg-muted" />
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Dialog>
  )
}

/* ----------------------------------------------------------- your turn */

/**
 * A slim strip above the message box when a game is waiting on you and its
 * card isn't on screen. Tapping it scrolls to the card.
 */
export function YourTurn({
  rounds,
  myId,
  partnerName,
}: {
  rounds: Round[]
  myId: string
  partnerName: string
}) {
  const waiting = rounds.find((r) => r.status === 'open' && !r.answered_by.includes(myId))
  // Which card is on screen, so the strip hides while you can already see it.
  const [onScreen, setOnScreen] = useState<string | null>(null)
  const visible = !!waiting && onScreen === waiting.id

  useEffect(() => {
    if (!waiting) return
    const el = document.getElementById(`round-${waiting.id}`)
    if (!el || typeof IntersectionObserver === 'undefined') return
    const id = waiting.id
    // "On screen" means at least half the card, not just an edge peeking in.
    const io = new IntersectionObserver(
      (entries) =>
        setOnScreen((cur) =>
          entries.some((e) => e.intersectionRatio >= 0.5) ? id : cur === id ? null : cur,
        ),
      { threshold: [0, 0.5, 1] },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [waiting])

  if (!waiting || visible) return null
  return (
    <div className="flex justify-center px-gutter pb-2">
      <button
        type="button"
        onClick={() => scrollToRound(waiting.id)}
        className="slide-pop inline-flex max-w-full items-center gap-2 rounded-pill bg-gold px-4 py-2 text-sm font-semibold text-gold-ink shadow-[var(--shadow-raised)]"
      >
        <Icon name="sparkle" size={14} />
        <span className="truncate">
          {waiting.started_by === myId
            ? `${GAMES[waiting.kind].title} · your turn`
            : `${partnerName} started ${GAMES[waiting.kind].title.toLowerCase()} · your turn`}
        </span>
      </button>
    </div>
  )
}
