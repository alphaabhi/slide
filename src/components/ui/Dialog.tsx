import * as RadixDialog from '@radix-ui/react-dialog'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Button } from './Button'
import { Icon } from './Icon'

/**
 * Accessible dialog (focus trap, Esc to close, scroll lock — via Radix).
 * Mobile: a bottom sheet within thumb reach. Desktop (md+): a centred panel.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  trigger,
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  trigger?: ReactNode
}) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <RadixDialog.Trigger asChild>{trigger}</RadixDialog.Trigger> : null}
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="slide-overlay fixed inset-0 z-40 bg-black/60" />
        <RadixDialog.Content
          className={cn(
            'slide-sheet fixed z-50 border border-line surface-panel focus:outline-none',
            'inset-x-0 bottom-0 max-h-[90dvh] overflow-y-auto rounded-t-card px-gutter pt-3 pb-safe',
            'md:inset-x-auto md:top-1/2 md:bottom-auto md:left-1/2 md:w-[28rem] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-card md:p-6',
          )}
        >
          <div
            aria-hidden="true"
            className="mx-auto mb-3 h-1 w-10 rounded-full bg-line md:hidden"
          />
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <RadixDialog.Title className="text-xl">{title}</RadixDialog.Title>
              {description ? (
                <RadixDialog.Description className="mt-1 text-sm text-fg-muted">
                  {description}
                </RadixDialog.Description>
              ) : null}
            </div>
            <RadixDialog.Close asChild>
              <Button variant="ghost" size="sm" iconOnly aria-label="Close" className="-mr-2 -mt-1">
                <Icon name="close" />
              </Button>
            </RadixDialog.Close>
          </div>
          {children}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}

export const DialogClose = RadixDialog.Close
