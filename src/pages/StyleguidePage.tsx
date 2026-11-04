import { useState, type ReactNode } from 'react'
import {
  ActivityCard,
  Avatar,
  Button,
  Card,
  Dialog,
  DialogClose,
  Icon,
  Input,
  MessageBubble,
  Textarea,
  useToast,
} from '@/components/ui'
import { Wordmark } from '@/components/Wordmark'

/**
 * Living style guide: every token and component in one place, rendered with real
 * components (not screenshots). Available in dev and on previews only.
 */

const swatches = [
  { name: 'Black', token: '--color-base', hex: '#0A0A0B', role: 'Background' },
  { name: 'Surface', token: '--color-surface', hex: '#161618', role: 'Cards, composer' },
  {
    name: 'Surface high',
    token: '--color-surface-high',
    hex: '#222225',
    role: 'Their bubbles, hover',
  },
  { name: 'Line', token: '--color-line', hex: '#333338', role: 'Borders' },
  { name: 'White', token: '--color-fg', hex: '#FAFAF7', role: 'Text' },
  { name: 'Grey', token: '--color-fg-muted', hex: '#A6A6AD', role: 'Secondary text' },
  { name: 'Coral', token: '--color-you', hex: '#FF9B8A', role: 'You, primary actions' },
  { name: 'Blue', token: '--color-them', hex: '#A8CDFF', role: 'Them' },
  { name: 'Dark yellow', token: '--color-gold', hex: '#D9A21B', role: 'Highlights, focus' },
  { name: 'Danger', token: '--color-danger', hex: '#FF6B7D', role: 'Errors' },
  { name: 'Success', token: '--color-success', hex: '#9EE6C1', role: 'Confirmations' },
]

const typeScale = [
  { cls: 'text-4xl', label: '4xl / 64px', sample: 'Slide in.' },
  { cls: 'text-3xl', label: '3xl / 44px', sample: 'Your space is ready' },
  { cls: 'text-2xl', label: '2xl / 32px', sample: 'Would you rather' },
  { cls: 'text-xl', label: 'xl / 25px', sample: 'Invite someone' },
  { cls: 'text-lg', label: 'lg / 20px', sample: 'Question of the day' },
]

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-line py-10">
      <h2 className="mb-6 text-xl">{title}</h2>
      {children}
    </section>
  )
}

export default function StyleguidePage() {
  const toast = useToast()
  const [yourChoice, setYourChoice] = useState<string | undefined>()
  const [failed, setFailed] = useState(true)

  return (
    <main className="mx-auto max-w-5xl px-gutter pt-safe pb-20">
      <header className="py-10">
        <Wordmark className="text-3xl" />
        <h1 className="mt-4 text-3xl">Design system</h1>
        <p className="mt-2 max-w-[52ch] text-fg-muted">
          Black, with pastel coral for you and pastel blue for them. Dark yellow marks the fun
          moments.
        </p>
      </header>

      <Section title="Colour">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {swatches.map((s) => (
            <li key={s.token} className="overflow-hidden rounded-[1rem] border border-line">
              <div className="h-16" style={{ background: `var(${s.token})` }} />
              <div className="bg-surface p-3">
                <p className="font-display font-semibold">{s.name}</p>
                <p className="text-xs text-fg-muted">{s.role}</p>
                <p className="mt-1 text-xs text-fg-muted">{s.hex}</p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Type">
        <div className="space-y-4">
          {typeScale.map((t) => (
            <div key={t.cls} className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-6">
              <span className="w-24 shrink-0 text-xs text-fg-muted">{t.label}</span>
              <span className={`${t.cls} font-display font-[650] tracking-[-0.02em]`}>
                {t.sample}
              </span>
            </div>
          ))}
          <div className="flex flex-col gap-1 sm:flex-row sm:gap-6">
            <span className="w-24 shrink-0 text-xs text-fg-muted">body / 16px</span>
            <p className="max-w-[60ch]">
              Atkinson Hyperlegible carries every message. It was designed for low-vision readers,
              so similar letters like I, l and 1 never blur together in a fast conversation. नमस्ते
              and emoji 🫶 fall back to the system font cleanly.
            </p>
          </div>
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Create a space</Button>
          <Button variant="secondary">Copy invite link</Button>
          <Button variant="ghost">Not now</Button>
          <Button variant="danger">Leave space</Button>
          <Button loading>Sending code</Button>
          <Button disabled>Disabled</Button>
          <Button size="sm" variant="secondary">
            <Icon name="link" size={16} />
            Share
          </Button>
          <Button iconOnly aria-label="Send message">
            <Icon name="send" />
          </Button>
        </div>
      </Section>

      <Section title="Fields">
        <div className="grid max-w-md gap-5">
          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            hint="We’ll send you a 6-digit sign-in code."
          />
          <Input label="Display name" defaultValue="Abhi" error="Keep it under 40 characters." />
          <Textarea label="Space title" placeholder="Somewhere other than Hinge" />
        </div>
      </Section>

      <Section title="People">
        <div className="flex items-center gap-4">
          <Avatar name="Abhi" side="you" size="lg" />
          <Avatar name="Meera" side="them" size="lg" />
          <Avatar name="Ølsen" side="them" />
          <Avatar name="🌻 Sunny" side="you" size="sm" />
        </div>
      </Section>

      <Section title="Messages">
        <Card className="mx-auto max-w-md bg-base p-4">
          <MessageBubble
            side="them"
            body="ok this is way better than the hinge chat"
            time="9:38 pm"
            dateTime="2026-11-04T21:38:00+05:30"
            isLast={false}
          />
          <MessageBubble
            side="them"
            body="what’s the yellow thing"
            time="9:38 pm"
            dateTime="2026-11-04T21:38:00+05:30"
          />
          <MessageBubble
            side="you"
            body="that’s me. you’re blue. very official"
            time="9:40 pm"
            dateTime="2026-11-04T21:40:00+05:30"
            status="sent"
          />
          <MessageBubble
            side="you"
            body="A long message wraps without breaking the layout: https://example.com/a-very-long-link-that-would-otherwise-overflow-the-bubble-on-small-phones"
            time="9:41 pm"
            dateTime="2026-11-04T21:41:00+05:30"
            status="sending"
          />
          <MessageBubble
            side="you"
            body="also try the would you rather thing"
            time="9:41 pm"
            dateTime="2026-11-04T21:41:00+05:30"
            status={failed ? 'failed' : 'sent'}
            onRetry={() => {
              setFailed(false)
              toast.show({ title: 'Message sent', tone: 'success' })
            }}
          />
        </Card>
      </Section>

      <Section title="Activities">
        <div className="grid gap-5 md:grid-cols-2">
          <ActivityCard
            kind="would-you-rather"
            prompt="Would you rather only text in voice notes or only in GIFs?"
            options={[
              { id: 'a', label: 'Voice notes forever' },
              { id: 'b', label: 'GIFs forever' },
            ]}
            youName="Abhi"
            themName="Meera"
            yourChoice={yourChoice}
            theyAnswered
            theirChoice={yourChoice ? 'b' : undefined}
            onChoose={setYourChoice}
            onSkip={() => toast.show({ title: 'Skipped', description: 'Here’s a new one.' })}
          />
          <ActivityCard
            kind="this-or-that"
            prompt="Sunrise or 2am?"
            options={[
              { id: 'a', label: 'Sunrise' },
              { id: 'b', label: '2am' },
            ]}
            youName="Abhi"
            themName="Meera"
            yourChoice="b"
            theirChoice="b"
          />
        </div>
        {yourChoice ? (
          <Button
            variant="ghost"
            size="sm"
            className="mt-3"
            onClick={() => setYourChoice(undefined)}
          >
            Reset demo
          </Button>
        ) : null}
      </Section>

      <Section title="Dialogs and toasts">
        <div className="flex flex-wrap gap-3">
          <Dialog
            title="Invite someone"
            description="Anyone with this link can join until someone does, or until it expires in 7 days."
            trigger={<Button variant="secondary">Open dialog</Button>}
          >
            <div className="grid gap-3">
              <Input label="Invite link" hideLabel readOnly value="https://slide.app/j/••••••••" />
              <Button>
                <Icon name="copy" size={18} />
                Copy link
              </Button>
              <DialogClose asChild>
                <Button variant="ghost">Done</Button>
              </DialogClose>
            </div>
          </Dialog>
          <Button
            variant="secondary"
            onClick={() => toast.show({ title: 'Link copied', tone: 'success' })}
          >
            Success toast
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              toast.show({
                title: 'You’re offline',
                description: 'Messages will send when you reconnect.',
                tone: 'danger',
              })
            }
          >
            Error toast
          </Button>
        </div>
      </Section>
    </main>
  )
}
