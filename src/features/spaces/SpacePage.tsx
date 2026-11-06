import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { BrandLoader } from '@/components/BrandLoader'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { useToast } from '@/components/ui/Toast'
import { useSession } from '@/features/auth/AuthProvider'
import { RequireAuth, RequireProfile } from '@/features/auth/guards'
import { useMyProfile } from '@/features/profile/api'
import { ChatScreen } from '@/features/chat/ChatScreen'
import { spaceErrorMessage, spaceLabel, useSpace, type Space } from './api'
import { LeaveSpace } from './LeaveSpace'
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
  const me = useMyProfile(session.user.id).data
  const myName = me?.display_name ?? 'You'
  const myAvatar = me?.avatar ?? null
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
  if (s.phase !== 'waiting') {
    return <ChatScreen space={s} userId={session.user.id} justJoined={flags.justJoined} />
  }
  return (
    <Shell space={s} myName={myName} myAvatar={myAvatar}>
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

      <LeaveSpace space={s} userId={session.user.id} />
    </Shell>
  )
}

function Shell({
  space,
  myName,
  myAvatar,
  children,
}: {
  space?: Space
  myName?: string
  myAvatar?: string | null
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
                avatar={myAvatar}
                side="you"
                size="sm"
                className="ring-2 ring-[var(--color-canvas)]"
              />
              {space.partner ? (
                <Avatar
                  name={space.partner.name}
                  avatar={space.partner.avatar}
                  side="them"
                  size="sm"
                  className="ring-2 ring-[var(--color-canvas)]"
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
