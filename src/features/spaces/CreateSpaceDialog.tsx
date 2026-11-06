import { useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Field'
import { spaceErrorMessage, useCreateSpace } from './api'

export function CreateSpaceDialog({ userId, trigger }: { userId: string; trigger: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string>()
  const create = useCreateSpace(userId)
  const navigate = useNavigate()

  async function submit(e: FormEvent) {
    e.preventDefault()
    const clean = title.replace(/\s+/g, ' ').trim()
    if (clean.length > 60) return setError('Keep it to 60 characters or fewer.')
    setError(undefined)
    try {
      const res = await create.mutateAsync(clean)
      setOpen(false)
      setTitle('')
      // The token is shown once, on the next screen. It is held only in this tab's history state.
      navigate(`/s/${res.space_id}`, {
        state: { inviteToken: res.invite_token, justCreated: true },
      })
    } catch (err) {
      setError(spaceErrorMessage(err))
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) setError(undefined)
      }}
      title="Create a space"
      description="A private place for you and one other person. You’ll get a link to send them."
      trigger={trigger}
    >
      <form onSubmit={submit} noValidate className="grid gap-4">
        <Input
          label="Name your space (optional)"
          placeholder="No small talk zone"
          maxLength={80}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          error={error}
          hint="Both of you will see this. Leave it blank and we’ll use your names."
        />
        <Button type="submit" loading={create.isPending}>
          {create.isPending ? 'Creating' : 'Create space'}
        </Button>
      </form>
    </Dialog>
  )
}
