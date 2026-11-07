import { EmojiPicker } from 'frimousse'
import { useState } from 'react'
import { cn } from '@/lib/cn'

const RECENT_KEY = 'slide.recentEmoji'
const RECENT_MAX = 16

function loadRecent(): string[] {
  try {
    const v = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? '[]') as unknown
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

/**
 * Searchable emoji grid with a "recently used" row. Loaded only when opened
 * (it's a separate chunk), and the emoji list itself is served from our own
 * site (/emojibase), not a third-party CDN.
 */
export default function EmojiPickerPanel({
  onPick,
  className,
}: {
  onPick: (emoji: string) => void
  className?: string
}) {
  const [recent, setRecent] = useState(loadRecent)

  function pick(emoji: string) {
    const next = [emoji, ...recent.filter((e) => e !== emoji)].slice(0, RECENT_MAX)
    setRecent(next)
    try {
      window.localStorage.setItem(RECENT_KEY, JSON.stringify(next))
    } catch {
      // Best effort.
    }
    onPick(emoji)
  }

  return (
    <EmojiPicker.Root
      onEmojiSelect={({ emoji }) => pick(emoji)}
      emojibaseUrl="/emojibase"
      columns={8}
      className={cn('flex h-[21rem] w-full flex-col', className)}
    >
      <EmojiPicker.Search
        aria-label="Search emoji"
        placeholder="Search emoji"
        className="mx-1 mb-2 h-10 shrink-0 rounded-pill border border-line bg-surface-high/50 px-4 text-base text-fg placeholder:text-fg-muted/80 focus:border-fg-muted focus:outline-none"
      />
      {recent.length ? (
        <div className="mb-1 shrink-0 px-1">
          <p className="label-meta px-1 pb-1 text-fg-muted">Recent</p>
          <div className="flex flex-wrap">
            {recent.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => pick(e)}
                aria-label={e}
                className="flex size-10 items-center justify-center rounded-lg text-2xl hover:bg-surface-high"
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <EmojiPicker.Viewport className="relative min-h-0 flex-1 outline-none">
        <EmojiPicker.Loading className="absolute inset-0 flex items-center justify-center text-sm text-fg-muted">
          Loading…
        </EmojiPicker.Loading>
        <EmojiPicker.Empty className="absolute inset-0 flex items-center justify-center text-sm text-fg-muted">
          No emoji found
        </EmojiPicker.Empty>
        <EmojiPicker.List
          className="select-none pb-2"
          components={{
            CategoryHeader: ({ category, ...props }) => (
              <div {...props} className="label-meta bg-surface px-2 pt-3 pb-1 text-fg-muted">
                {category.label}
              </div>
            ),
            Row: ({ children, ...props }) => (
              <div {...props} className="scroll-my-1 px-1">
                {children}
              </div>
            ),
            Emoji: ({ emoji, ...props }) => (
              <button
                {...props}
                className="flex size-10 flex-1 items-center justify-center rounded-lg text-2xl data-[active]:bg-surface-high"
              >
                {emoji.emoji}
              </button>
            ),
          }}
        />
      </EmojiPicker.Viewport>
    </EmojiPicker.Root>
  )
}
