import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Wordmark } from '@/components/Wordmark'

/** Shared frame for sign-in and onboarding: logo, heading, one focused task. */
export function AuthScreen({
  title,
  description,
  children,
}: {
  title: ReactNode
  description?: ReactNode
  children: ReactNode
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[26rem] flex-col px-gutter pt-safe pb-safe">
      <header className="py-6">
        <Link to="/" aria-label="SLIDE home" className="inline-block rounded-sm">
          <Wordmark className="text-2xl" />
        </Link>
      </header>
      <div className="flex flex-1 flex-col pt-[8dvh]">
        <h1 className="text-3xl">{title}</h1>
        {description ? <p className="mt-3 text-fg-muted">{description}</p> : null}
        <div className="mt-8">{children}</div>
      </div>
    </main>
  )
}
