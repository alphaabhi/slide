import { Link } from 'react-router'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'
import { spaceErrorMessage, spaceLabel, useMySpaces, type Space } from './api'
import { CreateSpaceDialog } from './CreateSpaceDialog'

const phaseText: Record<Space['phase'], string> = {
  waiting: 'Waiting for someone to join',
  together: 'Open',
  closed: 'Closed',
}

export function SpacesList({ userId }: { userId: string }) {
  const spaces = useMySpaces(userId)

  if (spaces.isPending) {
    return (
      <div className="mt-3 grid gap-3" aria-busy="true" aria-label="Loading your spaces">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-card border border-line surface-panel motion-reduce:animate-none"
          />
        ))}
      </div>
    )
  }

  if (spaces.isError) {
    return (
      <Card className="mt-3">
        <p className="font-semibold">Couldn’t load your spaces</p>
        <p className="mt-1 text-sm text-fg-muted">{spaceErrorMessage(spaces.error)}</p>
        <Button
          variant="secondary"
          size="sm"
          className="mt-3"
          loading={spaces.isFetching}
          onClick={() => void spaces.refetch()}
        >
          Try again
        </Button>
      </Card>
    )
  }

  if (spaces.data.length === 0) {
    return (
      <Card className="mt-3">
        <p className="flex items-center gap-2 font-display font-semibold">
          <span aria-hidden="true">✨</span>
          No spaces yet
        </p>
        <p className="mt-1 text-sm text-fg-muted">
          Create one and send the link to someone you’d like to keep talking to.
        </p>
        <CreateSpaceDialog
          userId={userId}
          trigger={<Button className="mt-4 w-full sm:w-auto">Create your first space</Button>}
        />
      </Card>
    )
  }

  return (
    <ul className="mt-3 grid gap-3">
      {spaces.data.map((s) => (
        <li key={s.id}>
          <Link
            to={`/s/${s.id}`}
            className="flex items-center gap-3 rounded-card border border-line surface-panel p-4 transition-colors duration-[var(--duration-fast)] hover:bg-surface-high"
          >
            {s.partner ? (
              <Avatar name={s.partner.name} side="them" />
            ) : (
              <span
                aria-hidden="true"
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-dashed border-fg-muted text-fg-muted"
              >
                <Icon name="link" size={18} />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate font-display font-semibold">{spaceLabel(s)}</span>
              <span
                className={cn(
                  'mt-0.5 flex items-center gap-1.5 text-sm',
                  s.phase === 'waiting' ? 'text-gold' : 'text-fg-muted',
                )}
              >
                {s.phase === 'together' && s.partner
                  ? `With ${s.partner.name}`
                  : phaseText[s.phase]}
              </span>
            </span>
            <Icon name="back" size={18} className="rotate-180 text-fg-muted" />
          </Link>
        </li>
      ))}
    </ul>
  )
}
