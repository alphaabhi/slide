import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogClose } from '@/components/ui/Dialog'
import { useToast } from '@/components/ui/Toast'
import { spaceErrorMessage, useLeaveSpace, type Space } from './api'

export function LeaveSpace({ space, userId }: { space: Space; userId: string }) {
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
