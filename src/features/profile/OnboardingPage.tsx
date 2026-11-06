import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { AuthScreen } from '@/features/auth/AuthScreen'
import { useSession } from '@/features/auth/AuthProvider'
import { profileErrorMessage } from '@/features/auth/errors'
import { BrandLoader } from '@/components/BrandLoader'
import { RequireAuth } from '@/features/auth/guards'
import { displayNameSchema, firstError, safeNext } from '@/features/auth/validation'
import { useMyProfile, useSaveProfile } from './api'
import { Avatar } from '@/components/ui/Avatar'
import { AvatarPicker } from './AvatarPicker'
import type { AvatarKey } from './avatars'
import { initialOf } from '@/lib/initials'

/** First sign-in: choose the name the other person will see. */
export default function OnboardingRoute() {
  return (
    <RequireAuth>
      <OnboardingPage />
    </RequireAuth>
  )
}

function OnboardingPage() {
  const session = useSession()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const navigate = useNavigate()
  const profile = useMyProfile(session.user.id)
  const save = useSaveProfile(session.user.id, false)
  const [value, setValue] = useState('')
  const [avatar, setAvatar] = useState<AvatarKey | null>(null)
  const [error, setError] = useState<string>()

  if (profile.isPending) return <BrandLoader />
  if (profile.data) return <Navigate to={next} replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    const parsed = displayNameSchema.safeParse(value)
    if (!parsed.success) return setError(firstError(parsed))
    setError(undefined)
    try {
      await save.mutateAsync({ display_name: parsed.data, avatar })
      navigate(next, { replace: true })
    } catch (err) {
      setError(profileErrorMessage(err))
    }
  }

  return (
    <AuthScreen
      title={
        <>
          What should we call <span className="text-spark">you</span>?
        </>
      }
      description="This is what the other person sees in your space. You can change it later."
    >
      <form onSubmit={submit} noValidate className="grid gap-5">
        <Input
          label="Display name"
          autoComplete="nickname"
          autoCapitalize="words"
          autoFocus
          maxLength={60}
          placeholder="Your first name works"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          error={error}
          hint="Up to 40 characters. Emoji welcome."
        />
        <AvatarPicker value={avatar} onChange={setAvatar} initial={initialOf(value.trim())} />
        <NamePreview raw={value} avatar={avatar} />
        <Button type="submit" loading={save.isPending} className="w-full">
          {save.isPending ? 'Saving' : 'Continue'}
        </Button>
      </form>
    </AuthScreen>
  )
}

/** Shows the name the way the other person will see it, as you type. */
function NamePreview({ raw, avatar }: { raw: string; avatar: AvatarKey | null }) {
  const parsed = displayNameSchema.safeParse(raw)
  const name = parsed.success ? parsed.data : ''
  return (
    <div
      aria-hidden="true"
      className="flex items-center gap-3 rounded-card border border-line px-4 py-3"
    >
      <Avatar name={name || '?'} avatar={avatar} side="you" size="md" />
      <p className="min-w-0 truncate text-sm text-fg-muted">
        They’ll see{' '}
        <span className="font-display text-base font-semibold text-spark">
          {name || 'your name'}
        </span>
      </p>
    </div>
  )
}
