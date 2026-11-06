import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'
import { useEffect } from 'react'
import { AVATAR_CREDIT, AVATARS, avatarSrc, preloadAvatars, type AvatarKey } from './avatars'

/**
 * Choose an avatar (optional). The character names appear only here, as
 * labels; the app always shows people by their own display name.
 */
export function AvatarPicker({
  value,
  onChange,
  initial,
}: {
  value: AvatarKey | null
  onChange: (key: AvatarKey | null) => void
  /** Shown on the "no avatar" option. */
  initial: string
}) {
  useEffect(preloadAvatars, [])
  return (
    <fieldset className="grid gap-3">
      <legend className="mb-2 text-sm font-semibold text-fg">
        Pick an avatar <span className="font-normal text-fg-muted">(optional)</span>
      </legend>
      <div
        role="radiogroup"
        aria-label="Avatar"
        className="grid grid-cols-4 gap-x-2 gap-y-3 sm:grid-cols-6"
      >
        <Option
          selected={value === null}
          label="Just my initial"
          shortLabel="My initial"
          onSelect={() => onChange(null)}
        >
          <span className="flex size-full items-center justify-center bg-you font-display text-2xl font-bold text-you-ink">
            {initial || '?'}
          </span>
        </Option>
        {AVATARS.map((a) => (
          <Option
            key={a.key}
            selected={value === a.key}
            label={a.name}
            onSelect={() => onChange(a.key)}
          >
            <img
              src={avatarSrc(a.key)}
              alt=""
              width={64}
              height={64}
              decoding="async"
              className="size-full"
            />
          </Option>
        ))}
      </div>
      <p className="text-xs text-fg-muted">
        <a
          href={AVATAR_CREDIT.href}
          target="_blank"
          rel="noreferrer noopener"
          className="underline underline-offset-2 hover:text-fg"
        >
          {AVATAR_CREDIT.text}
        </a>
      </p>
    </fieldset>
  )
}

function Option({
  selected,
  label,
  shortLabel,
  onSelect,
  children,
}: {
  selected: boolean
  label: string
  /** Visible text when the full label is too long; must be part of the label. */
  shortLabel?: string
  onSelect: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      onClick={onSelect}
      className="group relative flex flex-col items-center gap-1 rounded-card p-1 text-center"
    >
      <span
        className={cn(
          'relative block size-14 overflow-hidden rounded-full bg-surface-high transition-[transform,box-shadow] duration-[var(--duration-fast)] group-active:scale-95',
          selected
            ? 'shadow-[0_0_0_3px_var(--color-canvas),0_0_0_5px_var(--color-gold)]'
            : 'group-hover:shadow-[0_0_0_2px_var(--color-line)]',
        )}
      >
        {children}
      </span>
      {selected ? (
        <span
          aria-hidden="true"
          className="absolute top-0 right-1 rounded-full bg-gold p-0.5 text-gold-ink"
        >
          <Icon name="check" size={12} />
        </span>
      ) : null}
      <span
        className={cn(
          'w-full truncate text-xs',
          selected ? 'font-semibold text-fg' : 'text-fg-muted',
        )}
      >
        {shortLabel ?? label}
      </span>
    </button>
  )
}
