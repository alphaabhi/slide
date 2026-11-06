import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Field'
import { Icon } from '@/components/ui/Icon'
import { useToast } from '@/components/ui/Toast'
import { Wordmark } from '@/components/Wordmark'
import { useAuth, useSession } from '@/features/auth/AuthProvider'
import { authErrorMessage, profileErrorMessage } from '@/features/auth/errors'
import { RequireAuth, RequireProfile } from '@/features/auth/guards'
import { displayNameSchema, firstError } from '@/features/auth/validation'
import { useMyProfile, useSaveProfile, type Profile } from '@/features/profile/api'
import { AvatarPicker } from '@/features/profile/AvatarPicker'
import { isAvatarKey, preloadAvatars, type AvatarKey } from '@/features/profile/avatars'
import { initialOf } from '@/lib/initials'
import { CreateSpaceDialog } from '@/features/spaces/CreateSpaceDialog'
import { SpacesList } from '@/features/spaces/SpacesList'

export default function HomeRoute() {
  return (
    <RequireAuth>
      <RequireProfile>
        <HomePage />
      </RequireProfile>
    </RequireAuth>
  )
}

/** Signed-in home. Spaces are listed here from stage 3. */
function HomePage() {
  const session = useSession()
  const { signOut } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const profile = useMyProfile(session.user.id).data as Profile // guaranteed by <RequireProfile>
  const [signingOut, setSigningOut] = useState(false)
  // So the Edit profile picker opens with its pictures ready.
  useEffect(preloadAvatars, [])

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
        <Avatar
          name={profile.display_name}
          avatar={profile.avatar}
          side="you"
          className="ring-spark"
        />
      </header>

      <h1 className="mt-4 text-3xl [overflow-wrap:anywhere]">
        Hi, <span className="text-spark">{profile.display_name}</span>{' '}
        <span className="wave" aria-hidden="true">
          👋
        </span>
      </h1>

      <section aria-labelledby="spaces-heading" className="mt-8">
        <div className="flex items-center justify-between gap-3">
          <h2 id="spaces-heading" className="text-xl">
            Your spaces
          </h2>
          <CreateSpaceDialog
            userId={session.user.id}
            trigger={
              <Button size="sm">
                <Icon name="sparkle" size={16} />
                New space
              </Button>
            }
          />
        </div>
        <SpacesList userId={session.user.id} />
      </section>

      <section aria-labelledby="account-heading" className="mt-10">
        <h2 id="account-heading" className="text-xl">
          Account
        </h2>
        <Card className="mt-3 grid gap-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar name={profile.display_name} avatar={profile.avatar} side="you" />
              <div className="min-w-0">
                <p className="text-sm text-fg-muted">Display name</p>
                <p className="truncate font-semibold text-them">{profile.display_name}</p>
              </div>
            </div>
            <EditProfileDialog userId={session.user.id} current={profile} />
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

function EditProfileDialog({ userId, current }: { userId: string; current: Profile }) {
  const currentAvatar = isAvatarKey(current.avatar) ? current.avatar : null
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(current.display_name)
  const [avatar, setAvatar] = useState<AvatarKey | null>(currentAvatar)
  const [error, setError] = useState<string>()
  const save = useSaveProfile(userId, true)
  const toast = useToast()

  async function submit(e: FormEvent) {
    e.preventDefault()
    const parsed = displayNameSchema.safeParse(value)
    if (!parsed.success) return setError(firstError(parsed))
    try {
      await save.mutateAsync({ display_name: parsed.data, avatar })
      setOpen(false)
      toast.show({ title: 'Profile updated', tone: 'success' })
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
          setValue(current.display_name)
          setAvatar(currentAvatar)
          setError(undefined)
        }
      }}
      title="Edit profile"
      description="The other person in each of your spaces sees your name and picture."
      trigger={
        <Button variant="secondary" size="sm">
          Edit
        </Button>
      }
    >
      <form onSubmit={submit} noValidate className="grid gap-5">
        <Input
          label="Display name"
          autoComplete="nickname"
          maxLength={60}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          error={error}
        />
        <AvatarPicker value={avatar} onChange={setAvatar} initial={initialOf(value.trim())} />
        <Button type="submit" loading={save.isPending}>
          {save.isPending ? 'Saving' : 'Save'}
        </Button>
      </form>
    </Dialog>
  )
}
