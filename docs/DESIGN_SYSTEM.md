# Design system

Source: `src/design/tokens.css`. Live reference: `/styleguide`.

## Idea

SLIDE is for exactly two people. The base is black; each person owns a pastel: **coral is always _you_** (the viewer, and every primary action), **blue is always _them_**. **Dark yellow** marks the fun moments (activity labels, highlights) and is the keyboard focus ring. White carries the text.

## Colour

| Token                                        | Hex                         | Use                                                          |
| -------------------------------------------- | --------------------------- | ------------------------------------------------------------ |
| `base`                                       | #0A0A0B                     | Background (black)                                           |
| `surface`                                    | #161618                     | Cards, sheets, composer                                      |
| `surface-high`                               | #222225                     | Their bubbles, hover                                         |
| `line`                                       | #333338                     | Borders, dividers                                            |
| `fg`                                         | #FAFAF7                     | Primary text (white)                                         |
| `fg-muted`                                   | #A6A6AD                     | Secondary text                                               |
| `you` / `you-hover` / `you-ink`              | #FF9B8A / #FFAD9F / #3B0E06 | Pastel coral: the viewer, primary buttons                    |
| `them` / `them-ink`                          | #A8CDFF / #0B2244           | Pastel blue: the other person                                |
| `gold` / `gold-ink`                          | #D9A21B / #2B1F00           | Dark yellow: highlights, activities, focus ring              |
| `danger` / `danger-surface` / `danger-hover` | #FF6B7D / #2E1418 / #3D1A20 | Errors, failed messages (rose-red, kept distinct from coral) |
| `success` / `success-surface`                | #9EE6C1 / #142A20           | Confirmations (pastel mint)                                  |

Token names are theme-neutral (`base`, `surface`, `fg`) so the palette can change without renaming classes. All text pairs pass WCAG AA (axe in CI). Status is never shown by colour alone — failed messages always show an icon and "Not sent".

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

Signature moments: bubbles _slide_ in from their sender's side; the activity reveal fills a shared pick half coral, half blue. Nothing animates on its own unprompted.

## Components

`Button` (primary, secondary, ghost, danger; md/sm; loading; icon-only requires `aria-label` by type) · `Input`, `Textarea` (label, hint, error wired to `aria-describedby`) · `Card` · `Dialog` (bottom sheet on mobile, centred on md+) · `ToastProvider` / `useToast` · `Avatar` · `MessageBubble` (memoised; sending/sent/failed + retry) · `ActivityCard` · `Icon` · `Spinner` · `Wordmark`.

Rule: no raw colours, sizes or durations in feature code — use tokens or add one here.

## Copy voice

Plain, warm, slightly cheeky; sentence case; buttons say exactly what happens ("Copy invite link", not "Submit"). Errors say what happened and what to do next.
