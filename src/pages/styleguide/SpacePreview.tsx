import { ActivityCard, Avatar, Button, Icon, MessageBubble } from '@/components/ui'

/**
 * Style-guide-only composition showing how the components sit together in a space.
 * Sample content; not a product screen.
 */
export function SpacePreview() {
  return (
    <div className="mx-auto w-full max-w-[24rem] overflow-hidden rounded-[2rem] border border-line surface-panel">
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <div className="flex -space-x-2">
          <Avatar name="Abhi" side="you" size="sm" className="ring-2 ring-[var(--color-canvas)]" />
          <Avatar
            name="Meera"
            side="them"
            size="sm"
            className="ring-2 ring-[var(--color-canvas)]"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display font-bold">All banter welcome</p>
          <p className="font-meta text-xs text-fg-muted">You and Meera</p>
        </div>
        <span className="label-meta rounded-pill bg-gold px-2 py-1 text-[0.6875rem] text-gold-ink">
          New
        </span>
      </div>

      <div className="px-4 pt-4">
        <MessageBubble
          side="them"
          body="ok this is way better than the hinge chat"
          time="9:38 pm"
          dateTime="2026-11-04T21:38:00+05:30"
        />
        <MessageBubble
          side="you"
          body="told you. now answer the question below"
          time="9:40 pm"
          dateTime="2026-11-04T21:40:00+05:30"
          status="sent"
        />
      </div>

      <div className="px-3 pb-3">
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

      <div className="flex items-center gap-2 border-t border-line p-3">
        <div className="flex h-[var(--control-height)] flex-1 items-center rounded-pill border border-line bg-surface-high/50 px-4 text-fg-muted">
          Message Meera
        </div>
        <Button iconOnly aria-label="Send message">
          <Icon name="send" />
        </Button>
      </div>
    </div>
  )
}
