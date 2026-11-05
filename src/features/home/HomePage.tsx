import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { Wordmark } from '@/components/Wordmark'
import { useAuth, useSession } from '@/features/auth/AuthProvider'
import { authErrorMessage, profileErrorMessage } from '@/features/auth/errors'
import { displayNameSchema, firstError } from '@/features/auth/validation'
import { useMyProfile, useSaveDisplayName, type Profile } from '@/features/profile/api'

/** Signed-in home. Spaces are listed here from stage 3. */
export default function HomePage() {
  const session = useSession()
  const { signOut } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const profile = useMyProfile(session.user.id).data as Profile // guaranteed by <RequireProfile>
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await signOut()
      toast.show({ title: 'Signed out' })
      navigate('/', { replace: true })
    } catch (err) {
      toast.show({ title: 'Couldn’t sign out', description: authErrorMessage(err), tone: 'danger' })
      setSigningOut(false)
    }
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[var(--content-max)] px-gutter pt-safe pb-safe">
      <header className="flex items-center justify-between py-6">
        <Wordmark className="text-2xl" />
        <Avatar name={profile.display_name} side="you" />
      </header>

      <h1 className="mt-4 text-3xl [overflow-wrap:anywhere]">Hi, {profile.display_name}</h1>

      <section aria-labelledby="spaces-heading" className="mt-8">
        <h2 id="spaces-heading" className="text-xl">
          Your spaces
        </h2>
        <Card className="mt-3">
          <p className="font-display font-semibold">Spaces arrive in the next update</p>
          <p className="mt-1 text-sm text-fg-muted">
            Soon you’ll create a private space here and send one person an invite link.
          </p>
        </Card>
      </section>

      <section aria-labelledby="account-heading" className="mt-10">
        <h2 id="account-heading" className="text-xl">
          Account
        </h2>
        <Card className="mt-3 grid gap-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm text-fg-muted">Display name</p>
              <p className="truncate font-semibold">{profile.display_name}</p>
            </div>
            <EditNameDialog userId={session.user.id} current={profile.display_name} />
          </div>
          <div className="min-w-0 border-t border-line pt-4">
            <p className="text-sm text-fg-muted">Signed in as</p>
            <p className="font-meta truncate text-sm">{session.user.email}</p>
          </div>
        </Card>
        <Button
          variant="secondary"
          className="mt-4 w-full sm:w-auto"
          loading={signingOut}
          onClick={() => void handleSignOut()}
        >
          Sign out
        </Button>
      </section>
    </main>
  )
}

function EditNameDialog({ userId, current }: { userId: string; current: string }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(current)
  const [error, setError] = useState<string>()
  const save = useSaveDisplayName(userId, true)
  const toast = useToast()

  async function submit(e: FormEvent) {
    e.preventDefault()
    const parsed = displayNameSchema.safeParse(value)
    if (!parsed.success) return setError(firstError(parsed))
    try {
      await save.mutateAsync(parsed.data)
      setOpen(false)
      toast.show({ title: 'Name updated', tone: 'success' })
    } catch (err) {
      setError(profileErrorMessage(err))
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) {
          setValue(current)
          setError(undefined)
        }
      }}
      title="Change your name"
      description="The other person in each of your spaces will see this."
      trigger={
        <Button variant="secondary" size="sm">
          Edit
        </Button>
      }
    >
      <form onSubmit={submit} noValidate className="grid gap-4">
        <Input
          label="Display name"
          autoComplete="nickname"
          maxLength={60}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          error={error}
        />
        <Button type="submit" loading={save.isPending}>
          {save.isPending ? 'Saving' : 'Save name'}
        </Button>
      </form>
    </Dialog>
  )
}
