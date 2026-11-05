# Design system

Source: `src/design/tokens.css`. Live reference: `/styleguide`.

## Idea

SLIDE is for exactly two people: each person owns a colour and everything else stays quiet so the conversation leads. The look is **Graphite**, from the product owner's reference: near-black, hairline borders, small colour accents, monospace meta text. (A purple "Violet" theme was explored and set aside — see DECISIONS D-012/D-013.)

## Colour

| Token                                        | Hex                         | Use                                               |
| -------------------------------------------- | --------------------------- | ------------------------------------------------- |
| `base`                                       | #0C0C0D                     | Background (with a faint top light, `--app-bg`)   |
| `surface`                                    | #151516                     | Cards, sheets, composer (`surface-panel` utility) |
| `surface-high`                               | #202022                     | Their bubbles, hover                              |
| `line`                                       | #29292C                     | Hairline borders, dividers                        |
| `fg`                                         | #EDEDEE                     | Primary text                                      |
| `fg-muted`                                   | #929298                     | Secondary text                                    |
| `you` / `you-ink`                            | #F1F1F2 / #111112           | The viewer: bubbles, avatar, primary buttons      |
| `them` / `them-ink`                          | #7FB0FF / #08193A           | The other person                                  |
| `gold` / `gold-ink`                          | #F5C542 / #2B1F00           | Activity labels, badges, focus ring               |
| `glow`                                       | #F472B6                     | The one bright moment: a shared activity pick     |
| `danger` / `danger-surface` / `danger-hover` | #FF7B8A / #2A1417 / #36191D | Errors, failed messages                           |
| `success` / `success-surface`                | #5FDC9A / #12261B           | Confirmations                                     |

Token names are theme-neutral, so accent themes (stage 7 personalisation) can be added by overriding variables. All text pairs pass WCAG AA (axe in CI). Status is never shown by colour alone — failed messages always show an icon and "Not sent".

## Type

- **Plus Jakarta Sans** (variable): headings and buttons. Headings weight 550, tracking −0.02em.
- **System monospace**: small labels (`label-meta`) and timestamps (`font-meta`), sentence case.
- **Atkinson Hyperlegible**: messages and body. Never below 16px in inputs (prevents iOS zoom).
- Scale (~1.25): 13 / 15 / 16 / 20 / 25 / 32 / 44 / 64 px.

## Space, shape, depth

- 4px spacing base. Side gutter 16px (or the safe-area inset if larger).
- Radii vary by role: chips 8, inputs 14, bubbles 20 (6 on the tail corner), cards 28, buttons pill.
- Elevation: a 1px inner highlight plus a deep soft shadow; borders do most of the separating.
- Touch targets ≥ 44px; controls 48px tall.

## Motion

Durations 120 / 200 / 360 ms, ease-out `cubic-bezier(0.22,1,0.36,1)`. Only transform and opacity are animated. Durations collapse to 0 under `prefers-reduced-motion`.

Signature moments: bubbles _slide_ in from their sender's side; a shared activity pick lights up with the theme's glow. Nothing animates on its own unprompted.

## Components

`Button` (primary, secondary, ghost, danger; md/sm; loading; icon-only requires `aria-label` by type) · `Input`, `Textarea` (label, hint, error wired to `aria-describedby`) · `Card` · `Dialog` (bottom sheet on mobile, centred on md+) · `ToastProvider` / `useToast` · `Avatar` · `MessageBubble` (memoised; sending/sent/failed + retry) · `ActivityCard` · `Icon` · `Spinner` · `Wordmark`.

Rule: no raw colours, sizes or durations in feature code — use tokens or add one here.

## Copy voice

Plain, warm, slightly cheeky; sentence case; buttons say exactly what happens ("Copy invite link", not "Submit"). Errors say what happened and what to do next.
