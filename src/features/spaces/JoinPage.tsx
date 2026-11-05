import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { BrandLoader } from '@/components/BrandLoader'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/features/auth/AuthProvider'
import { AuthScreen } from '@/features/auth/AuthScreen'
import { useMyProfile } from '@/features/profile/api'
import { acceptInvitation, getInvitation, spaceErrorMessage, type InvitePreview } from './api'
import { clearPendingInvite, readPendingInvite, savePendingInvite } from './pendingInvite'

/** /i/:token — stash the token, then continue on /join with a clean address bar. */
export function InviteLinkRedirect() {
  const { token = '' } = useParams()
  savePendingInvite(token)
  return <Navigate to="/join" replace />
}

const closedReasons: Record<string, { title: string; body: string }> = {
  not_found: {
    title: 'This invite link doesn’t work',
    body: 'Check you copied the whole link, or ask the person who sent it for a new one.',
  },
  expired: {
    title: 'This invite has expired',
    body: 'Invite links last 7 days. Ask the person who sent it for a new one.',
  },
  revoked: {
    title: 'This invite was cancelled',
    body: 'The person who sent it cancelled the link. Ask them for a new one.',
  },
  used: {
    title: 'Someone already joined',
    body: 'Each space is for exactly two people, and this one is taken. If it was meant for you, ask for a new space.',
  },
  full: {
    title: 'This space is full',
    body: 'Each space is for exactly two people. Ask the person who sent it for a new space.',
  },
  closed: { title: 'This space is closed', body: 'It can’t be joined any more.' },
}

export default function JoinPage() {
  const [token] = useState(() => readPendingInvite())
  const { state } = useAuth()
  const signedIn = state.status === 'signed-in'
  const userId = signedIn ? state.session.user.id : null

  const preview = useQuery({
    queryKey: ['invite-preview', token, userId],
    queryFn: () => getInvitation(token!),
    enabled: !!token && state.status !== 'loading',
    retry: 1,
  })

  if (!token) {
    return (
      <AuthScreen
        title="We couldn’t read that invite"
        description="Open the invite link again from the message you were sent."
      >
        <HomeLink />
      </AuthScreen>
    )
  }
  if (state.status === 'loading' || preview.isPending) return <BrandLoader />
  if (preview.isError) {
    return (
      <AuthScreen title="Couldn’t check this invite" description={spaceErrorMessage(preview.error)}>
        <Button loading={preview.isFetching} onClick={() => void preview.refetch()}>
          Try again
        </Button>
      </AuthScreen>
    )
  }

  const p = preview.data
  if (p.status === 'member') {
    clearPendingInvite()
    return <Navigate to={`/s/${p.space_id}`} replace />
  }
  if (p.status === 'own') {
    return (
      <AuthScreen
        title="This is your own invite"
        description="Send it to the person you want in your space. When they open it, they can join."
      >
        <Link
          to={`/s/${p.space_id}`}
          onClick={clearPendingInvite}
          className="inline-flex h-[var(--control-height)] w-full items-center justify-center rounded-pill bg-you px-6 font-display font-semibold text-you-ink"
        >
          Open your space
        </Link>
      </AuthScreen>
    )
  }
  if (p.status !== 'valid') {
    const reason = closedReasons[p.status] ?? closedReasons.not_found!
    return (
      <AuthScreen title={reason.title} description={reason.body}>
        <HomeLink />
      </AuthScreen>
    )
  }

  return <ValidInvite token={token} preview={p} userId={userId} />
}

function ValidInvite({
  token,
  preview,
  userId,
}: {
  token: string
  preview: Extract<InvitePreview, { status: 'valid' }>
  userId: string | null
}) {
  const inviter = preview.inviter_name ?? 'Someone'
  return (
    <AuthScreen
      title={
        <>
          <span className="text-spark">{inviter}</span> wants to take the conversation somewhere
          else
        </>
      }
      description="SLIDE is a private space for exactly two people: just the two of you, with chat and a few games to play together."
    >
      <div className="slide-pop mb-6 flex items-center gap-3 rounded-card border border-line surface-panel px-4 py-3">
        <Avatar name={inviter} side="them" />
        <div className="min-w-0">
          <p className="truncate font-display font-semibold">
            {preview.space_title ?? `${inviter}’s space`}
          </p>
          <p className="text-sm text-fg-muted">Private · 2 people</p>
        </div>
      </div>
      {userId ? <JoinButton token={token} userId={userId} inviter={inviter} /> : <SignInToJoin />}
    </AuthScreen>
  )
}

function SignInToJoin() {
  return (
    <>
      <Link
        to="/sign-in?next=%2Fjoin"
        className="inline-flex h-[var(--control-height)] w-full items-center justify-center rounded-pill bg-you px-6 font-display font-semibold text-you-ink"
      >
        Sign in to join
      </Link>
      <p className="mt-3 text-sm text-fg-muted">
        New to SLIDE? Signing in creates your account. It takes a minute.
      </p>
    </>
  )
}

function JoinButton({
  token,
  userId,
  inviter,
}: {
  token: string
  userId: string
  inviter: string
}) {
  const profile = useMyProfile(userId)
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  // Signed in but no name yet: choose one first, then come straight back here.
  const needsName = profile.isSuccess && !profile.data
  useEffect(() => {
    if (needsName) navigate('/welcome?next=%2Fjoin', { replace: true })
  }, [needsName, navigate])

  async function join() {
    setBusy(true)
    setError(undefined)
    try {
      const res = await acceptInvitation(token)
      clearPendingInvite()
      navigate(`/s/${res.space_id}`, { replace: true, state: { justJoined: true } })
    } catch (err) {
      setError(spaceErrorMessage(err))
      setBusy(false)
    }
  }

  return (
    <>
      <Button className="w-full" loading={busy || profile.isPending} onClick={() => void join()}>
        {busy ? 'Joining' : `Join ${inviter}`}
      </Button>
      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
    </>
  )
}

function HomeLink() {
  return (
    <Link
      to="/"
      className="inline-flex h-[var(--control-height)] w-full items-center justify-center rounded-pill border border-line surface-panel px-6 font-display font-semibold"
    >
      Go to SLIDE
    </Link>
  )
}
