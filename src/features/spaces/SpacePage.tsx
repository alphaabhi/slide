import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { BrandLoader } from '@/components/BrandLoader'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Dialog, DialogClose } from '@/components/ui/Dialog'
import { Icon } from '@/components/ui/Icon'
import { useToast } from '@/components/ui/Toast'
import { useSession } from '@/features/auth/AuthProvider'
import { RequireAuth, RequireProfile } from '@/features/auth/guards'
import { useMyProfile } from '@/features/profile/api'
import { spaceErrorMessage, spaceLabel, useLeaveSpace, useSpace, type Space } from './api'
import { InviteCard } from './InviteCard'
import { recallInviteToken, rememberInviteToken } from './pendingInvite'

export default function SpaceRoute() {
  return (
    <RequireAuth>
      <RequireProfile>
        <SpacePage />
      </RequireProfile>
    </RequireAuth>
  )
}

interface NavState {
  inviteToken?: string
  justCreated?: boolean
  justJoined?: boolean
}

function SpacePage() {
  const { spaceId = '' } = useParams()
  const session = useSession()
  const myName = useMyProfile(session.user.id).data?.display_name ?? 'You'
  const location = useLocation()
  const navigate = useNavigate()
  const toast = useToast()
  const nav = (location.state ?? {}) as NavState
  const [token, setToken] = useState<string | null>(
    () => nav.inviteToken ?? recallInviteToken(spaceId),
  )
  // Remember the one-off welcome flags for this visit only.
  const [flags] = useState(() => ({ justCreated: !!nav.justCreated, justJoined: !!nav.justJoined }))
  const space = useSpace(spaceId, session.user.id)

  // Tell the creator the moment the other person arrives.
  const lastPhase = useRef(space.data?.phase)
  useEffect(() => {
    const phase = space.data?.phase
    if (lastPhase.current === 'waiting' && phase === 'together' && space.data?.partner) {
      toast.show({
        title: `${space.data.partner.name} slid in 🎉`,
        description: 'You’re both here now.',
        tone: 'success',
      })
      setToken(null)
    }
    lastPhase.current = phase
  }, [space.data, toast])

  // Remember the link for this tab (so it can be copied again later), and clear
  // the one-off navigation state so the welcome moment doesn't replay on refresh.
  useEffect(() => {
    rememberInviteToken(spaceId, token)
  }, [spaceId, token])
  const { pathname } = location
  const hadState = location.state != null
  useEffect(() => {
    if (hadState) navigate(pathname, { replace: true, state: null })
  }, [hadState, pathname, navigate])

  if (space.isPending) return <BrandLoader />
  if (space.isError) {
    return (
      <Shell>
        <h1 className="text-2xl">Couldn’t load this space</h1>
        <p className="mt-3 text-fg-muted">{spaceErrorMessage(space.error)}</p>
        <Button
          className="mt-6 w-fit"
          loading={space.isFetching}
          onClick={() => void space.refetch()}
        >
          Try again
        </Button>
      </Shell>
    )
  }
  if (!space.data) {
    return (
      <Shell>
        <h1 className="text-2xl">This space isn’t available</h1>
        <p className="mt-3 text-fg-muted">
          It may have been closed, or you’re signed in with a different account.
        </p>
        <Link
          to="/home"
          className="mt-6 inline-flex h-[var(--control-height)] w-fit items-center rounded-pill bg-you px-6 font-display font-semibold text-you-ink"
        >
          Go to your spaces
        </Link>
      </Shell>
    )
  }

  const s = space.data
  return (
    <Shell space={s} myName={myName}>
      {flags.justJoined ? (
        <WelcomeBanner text={`You’re in. Say hi to ${s.partner?.name ?? 'them'} 👋`} />
      ) : null}

      {s.phase === 'waiting' ? (
        <>
          <h1 className="text-3xl">
            Waiting for someone to <span className="text-spark">slide in</span>
          </h1>
          <p className="mt-3 text-fg-muted">
            {flags.justCreated ? 'Your space is ready. ' : ''}Send your invite to one person. When
            they join, this space opens for both of you.
          </p>
          <div className="mt-6">
            <InviteCard
              spaceId={s.id}
              token={token}
              expiresAt={s.openInvite?.expiresAt ?? null}
              onToken={setToken}
            />
          </div>
        </>
      ) : null}

      {s.phase === 'together' ? (
        <>
          <h1 className="text-3xl [overflow-wrap:anywhere]">
            You & <span className="text-spark">{s.partner?.name}</span>
          </h1>
          <Card className="mt-6">
            <p className="flex items-center gap-2 font-display font-semibold">
              <Icon name="sparkle" size={16} className="text-gold" />
              Chat arrives in the next update
            </p>
            <p className="mt-1 text-sm text-fg-muted">
              You’re both in this space. Messages and games will appear right here.
            </p>
          </Card>
        </>
      ) : null}

      {s.phase === 'closed' ? (
        <>
          <h1 className="text-3xl">This space is closed</h1>
          <p className="mt-3 text-fg-muted">
            The other person left. You can still look back at this space, but no one can send
            messages or join it.
          </p>
        </>
      ) : null}

      <LeaveSpace space={s} userId={session.user.id} />
    </Shell>
  )
}

function Shell({
  space,
  myName,
  children,
}: {
  space?: Space
  myName?: string
  children: React.ReactNode
}) {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-[var(--content-max)] px-gutter pt-safe pb-safe">
      <header className="flex items-center gap-3 py-5">
        <Link
          to="/home"
          aria-label="Back to your spaces"
          className="-ml-2 inline-flex size-[var(--touch-target)] items-center justify-center rounded-full text-fg-muted hover:bg-surface-high hover:text-fg"
        >
          <Icon name="back" size={20} />
        </Link>
        {space ? (
          <>
            <div className="flex -space-x-2" aria-hidden="true">
              <Avatar
                name={myName ?? 'You'}
                side="you"
                size="sm"
                className="ring-2 ring-[var(--color-base)]"
              />
              {space.partner ? (
                <Avatar
                  name={space.partner.name}
                  side="them"
                  size="sm"
                  className="ring-2 ring-[var(--color-base)]"
                />
              ) : null}
            </div>
            <p className="min-w-0 truncate font-display font-semibold">{spaceLabel(space)}</p>
          </>
        ) : null}
      </header>
      <div className="pt-4">{children}</div>
    </main>
  )
}

function WelcomeBanner({ text }: { text: string }) {
  return (
    <div className="slide-pop mb-6 rounded-card border border-line surface-panel px-4 py-3 font-display font-semibold">
      {text}
    </div>
  )
}

function LeaveSpace({ space, userId }: { space: Space; userId: string }) {
  const leave = useLeaveSpace(space.id, userId)
  const navigate = useNavigate()
  const toast = useToast()
  const [error, setError] = useState<string>()

  const explanation =
    space.phase === 'together'
      ? `You’ll lose access straight away. ${space.partner?.name ?? 'The other person'} keeps what’s already here, but the space closes: no new messages, and no one can join.`
      : space.phase === 'waiting'
        ? 'Nobody else has joined, so the space and its invite link will be deleted.'
        : 'You’re the last person here, so the space and everything in it will be deleted.'

  async function confirm() {
    try {
      await leave.mutateAsync()
      toast.show({ title: 'You left the space' })
      navigate('/home', { replace: true })
    } catch (err) {
      setError(spaceErrorMessage(err))
    }
  }

  return (
    <div className="mt-12 border-t border-line pt-6">
      <Dialog
        title={space.phase === 'together' ? 'Leave this space?' : 'Delete this space?'}
        description={explanation}
        trigger={
          <Button variant="danger" size="sm">
            {space.phase === 'together' ? 'Leave space' : 'Delete space'}
          </Button>
        }
      >
        <div className="grid gap-3">
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button variant="danger" loading={leave.isPending} onClick={() => void confirm()}>
            {space.phase === 'together' ? 'Leave space' : 'Delete space'}
          </Button>
          <DialogClose asChild>
            <Button variant="ghost">Keep it</Button>
          </DialogClose>
        </div>
      </Dialog>
    </div>
  )
}
