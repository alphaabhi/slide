import * as RadixToast from '@radix-ui/react-toast'
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Icon } from './Icon'

type Tone = 'neutral' | 'success' | 'danger'

interface ToastItem {
  id: number
  title: string
  description?: string
  tone: Tone
}

interface ToastApi {
  show: (t: { title: string; description?: string; tone?: Tone }) => void
}

const ToastContext = createContext<ToastApi | null>(null)

// eslint-disable-next-line react/only-export-components
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}

const toneIcon = { neutral: 'sparkle', success: 'check', danger: 'alert' } as const

/** Non-blocking notifications. Announced politely to screen readers by Radix. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const show = useCallback<ToastApi['show']>(({ title, description, tone = 'neutral' }) => {
    setItems((prev) => [
      ...prev.slice(-2),
      { id: Date.now() + Math.random(), title, description, tone },
    ])
  }, [])

  const api = useMemo(() => ({ show }), [show])

  return (
    <ToastContext.Provider value={api}>
      <RadixToast.Provider swipeDirection="down" duration={4000}>
        {children}
        {items.map((t) => (
          <RadixToast.Root
            key={t.id}
            type={t.tone === 'danger' ? 'foreground' : 'background'}
            onOpenChange={(open) => {
              if (!open) setItems((prev) => prev.filter((p) => p.id !== t.id))
            }}
            className={cn(
              'slide-toast flex items-start gap-3 rounded-card border bg-pine-raised p-4 shadow-[var(--shadow-overlay)]',
              t.tone === 'danger' ? 'border-danger/50' : 'border-line',
            )}
          >
            <span
              className={cn(
                'mt-0.5',
                t.tone === 'success' && 'text-success',
                t.tone === 'danger' && 'text-danger',
                t.tone === 'neutral' && 'text-you',
              )}
            >
              <Icon name={toneIcon[t.tone]} />
            </span>
            <div className="min-w-0 flex-1">
              <RadixToast.Title className="font-display font-semibold">{t.title}</RadixToast.Title>
              {t.description ? (
                <RadixToast.Description className="mt-0.5 text-sm text-moss">
                  {t.description}
                </RadixToast.Description>
              ) : null}
            </div>
            <RadixToast.Close
              aria-label="Dismiss"
              className="-m-2 inline-flex size-[var(--touch-target)] items-center justify-center rounded-full text-moss hover:text-mist"
            >
              <Icon name="close" size={18} />
            </RadixToast.Close>
          </RadixToast.Root>
        ))}
        <RadixToast.Viewport className="fixed inset-x-0 top-0 z-[60] mx-auto flex w-full max-w-md flex-col gap-2 px-gutter pt-safe outline-none [padding-top:max(env(safe-area-inset-top),0.75rem)]" />
      </RadixToast.Provider>
    </ToastContext.Provider>
  )
}
