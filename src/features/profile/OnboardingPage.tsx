import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { AuthScreen } from '@/features/auth/AuthScreen'
import { useSession } from '@/features/auth/AuthProvider'
import { profileErrorMessage } from '@/features/auth/errors'
import { FullPageSpinner } from '@/features/auth/guards'
import { displayNameSchema, firstError, safeNext } from '@/features/auth/validation'
import { useMyProfile, useSaveDisplayName } from './api'

/** First sign-in: choose the name the other person will see. */
export default function OnboardingPage() {
  const session = useSession()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const navigate = useNavigate()
  const profile = useMyProfile(session.user.id)
  const save = useSaveDisplayName(session.user.id, false)
  const [value, setValue] = useState('')
  const [error, setError] = useState<string>()

  if (profile.isPending) return <FullPageSpinner />
  if (profile.data) return <Navigate to={next} replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    const parsed = displayNameSchema.safeParse(value)
    if (!parsed.success) return setError(firstError(parsed))
    setError(undefined)
    try {
      await save.mutateAsync(parsed.data)
      navigate(next, { replace: true })
    } catch (err) {
      setError(profileErrorMessage(err))
    }
  }

  return (
    <AuthScreen
      title="What should we call you?"
      description="This is the name the other person sees in your space. You can change it later."
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
        <Button type="submit" loading={save.isPending} className="w-full">
          {save.isPending ? 'Saving' : 'Continue'}
        </Button>
      </form>
    </AuthScreen>
  )
}
