import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { sendSignInCode, verifySignInCode } from './api'
import { AuthScreen } from './AuthScreen'
import { useAuth } from './AuthProvider'
import { authErrorMessage } from './errors'
import { FullPageSpinner } from './guards'
import { codeSchema, emailSchema, firstError, safeNext } from './validation'

const RESEND_SECONDS = 60

export default function SignInPage() {
  const { state } = useAuth()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const [email, setEmail] = useState<string | null>(null)

  if (state.status === 'loading') return <FullPageSpinner />
  if (state.status === 'signed-in') return <Navigate to={next} replace />

  return email === null ? (
    <EmailStep onSent={setEmail} />
  ) : (
    <CodeStep email={email} next={next} onChangeEmail={() => setEmail(null)} />
  )
}

function EmailStep({ onSent }: { onSent: (email: string) => void }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const parsed = emailSchema.safeParse(value)
    if (!parsed.success) return setError(firstError(parsed))
    setError(undefined)
    setBusy(true)
    try {
      await sendSignInCode(parsed.data)
      onSent(parsed.data)
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthScreen
      title="Sign in to SLIDE"
      description="We’ll email you a code. No password needed. New here? This creates your account."
    >
      <form onSubmit={submit} noValidate className="grid gap-5">
        <Input
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus
          placeholder="you@example.com"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          error={error}
        />
        <Button type="submit" loading={busy} className="w-full">
          {busy ? 'Sending code' : 'Email me a code'}
        </Button>
      </form>
    </AuthScreen>
  )
}

function CodeStep({
  email,
  next,
  onChangeEmail,
}: {
  email: string
  next: string
  onChangeEmail: () => void
}) {
  const navigate = useNavigate()
  const [value, setValue] = useState('')
  const [error, setError] = useState<string>()
  const [notice, setNotice] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [resending, setResending] = useState(false)
  const [cooldown, setCooldown] = useState(RESEND_SECONDS)
  const submitted = useRef(false)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => window.clearTimeout(t)
  }, [cooldown])

  async function verify(raw: string) {
    const parsed = codeSchema.safeParse(raw)
    if (!parsed.success) return setError(firstError(parsed))
    if (submitted.current) return // ignore double submits (autofill + tap)
    submitted.current = true
    setError(undefined)
    setBusy(true)
    try {
      await verifySignInCode(email, parsed.data)
      navigate(next, { replace: true })
    } catch (err) {
      setError(authErrorMessage(err))
      submitted.current = false
      setBusy(false)
    }
  }

  async function resend() {
    setResending(true)
    setError(undefined)
    setNotice(undefined)
    try {
      await sendSignInCode(email)
      setNotice('New code sent. Use the latest email.')
      setValue('')
      setCooldown(RESEND_SECONDS)
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setResending(false)
    }
  }

  return (
    <AuthScreen
      title="Check your email"
      description={
        <>
          We sent a sign-in code to{' '}
          <span className="font-semibold text-fg [overflow-wrap:anywhere]">{email}</span>.
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void verify(value)
        }}
        noValidate
        className="grid gap-5"
      >
        <Input
          label="Sign-in code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={12}
          autoFocus
          placeholder="123456"
          className="font-meta text-xl tracking-[0.3em]"
          value={value}
          onChange={(e) => {
            const v = e.target.value.replace(/[^\d]/g, '')
            setValue(v)
          }}
          error={error}
          hint={notice}
        />
        <Button type="submit" loading={busy} className="w-full">
          {busy ? 'Signing in' : 'Sign in'}
        </Button>
      </form>

      <div className="mt-6 flex flex-col items-start gap-1 text-sm">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-4"
          disabled={cooldown > 0 || busy}
          loading={resending}
          onClick={() => void resend()}
        >
          {cooldown > 0 ? `Send a new code in ${cooldown}s` : 'Send a new code'}
        </Button>
        <Button variant="ghost" size="sm" className="-ml-4" disabled={busy} onClick={onChangeEmail}>
          Use a different email
        </Button>
      </div>
      <p className="mt-4 text-sm text-fg-muted">
        Can’t find it? Check your spam or promotions folder.
      </p>
    </AuthScreen>
  )
}
