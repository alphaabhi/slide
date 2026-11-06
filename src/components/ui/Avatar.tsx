import { avatarSrc, isAvatarKey } from '@/features/profile/avatars'
import { cn } from '@/lib/cn'
import { initialOf } from '@/lib/initials'

export type Side = 'you' | 'them'

/**
 * A person's picture: their chosen illustrated avatar, or their initial on
 * their colour if they haven't picked one. Decorative: the name next to it is
 * what screen readers hear.
 */
export function Avatar({
  name,
  side,
  avatar,
  size = 'md',
  className,
}: {
  name: string
  side: Side
  avatar?: string | null
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}) {
  const sizeCls = cn(
    size === 'sm' && 'size-7 text-xs',
    size === 'md' && 'size-10 text-base',
    size === 'lg' && 'size-14 text-xl',
    size === 'xl' && 'size-20 text-3xl',
  )
  if (isAvatarKey(avatar)) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          'inline-flex shrink-0 overflow-hidden rounded-full bg-surface-high',
          sizeCls,
          className,
        )}
      >
        <img
          src={avatarSrc(avatar)}
          alt=""
          width={80}
          height={80}
          decoding="async"
          className="size-full"
        />
      </span>
    )
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-display font-bold',
        side === 'you' ? 'bg-you text-you-ink' : 'bg-them text-them-ink',
        sizeCls,
        className,
      )}
    >
      {initialOf(name)}
    </span>
  )
}
