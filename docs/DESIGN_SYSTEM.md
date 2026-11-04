# Design system

Source: `src/design/tokens.css`. Live reference: `/styleguide`.

## Idea

SLIDE is for exactly two people, so the identity is a **duo**: each person owns a colour, and the space is where they meet. Marigold is always _you_ (the viewer); Lagoon is always _them_. Everything else is quiet pine green so the conversation leads.

## Colour

| Token                         | Hex               | Use                                          |
| ----------------------------- | ----------------- | -------------------------------------------- |
| `pine`                        | #102A26           | Background                                   |
| `pine-raised`                 | #173832           | Cards, sheets, composer                      |
| `pine-high`                   | #1F463F           | Their bubbles, hover                         |
| `line`                        | #2C554D           | Borders, dividers                            |
| `mist`                        | #E8EFEA           | Primary text                                 |
| `moss`                        | #9DB3AB           | Secondary text                               |
| `you` / `you-ink`             | #FFC24B / #2A1D00 | The viewer: bubbles, avatar, primary buttons |
| `them` / `them-ink`           | #8FD3FF / #04263A | The other person                             |
| `danger` / `danger-surface`   | #FF8A7A / #3A2622 | Errors, failed messages                      |
| `success` / `success-surface` | #8BE0B4 / #1B3B2F | Confirmations                                |

All text pairs pass WCAG AA (checked by axe in CI). Status is never shown by colour alone.

## Type

- **Bricolage Grotesque** (variable): headings, buttons, labels. Weight 650 for headings, tracking −0.02em.
- **Atkinson Hyperlegible**: messages and body. Never below 16px in inputs (prevents iOS zoom).
- Scale (~1.25): 13 / 15 / 16 / 20 / 25 / 32 / 44 / 64 px.

## Space, shape, depth

- 4px spacing base. Side gutter 16px (or the safe-area inset if larger).
- Radii vary by role: chips 8, inputs 14, bubbles 20 (6 on the tail corner), cards 28, buttons pill.
- Elevation: a 1px inner highlight plus a deep soft shadow; borders do most of the separating.
- Touch targets ≥ 44px; controls 48px tall.

## Motion

Durations 120 / 200 / 360 ms, ease-out `cubic-bezier(0.22,1,0.36,1)`. Only transform and opacity are animated. Durations collapse to 0 under `prefers-reduced-motion`.

Signature moments: bubbles _slide_ in from their sender's side; the activity reveal fills a shared pick half Marigold, half Lagoon. Nothing animates on its own unprompted.

## Components

`Button` (primary, secondary, ghost, danger; md/sm; loading; icon-only requires `aria-label` by type) · `Input`, `Textarea` (label, hint, error wired to `aria-describedby`) · `Card` · `Dialog` (bottom sheet on mobile, centred on md+) · `ToastProvider` / `useToast` · `Avatar` · `MessageBubble` (memoised; sending/sent/failed + retry) · `ActivityCard` · `Icon` · `Spinner` · `Wordmark`.

Rule: no raw colours, sizes or durations in feature code — use tokens or add one here.

## Copy voice

Plain, warm, slightly cheeky; sentence case; buttons say exactly what happens ("Copy invite link", not "Submit"). Errors say what happened and what to do next.
