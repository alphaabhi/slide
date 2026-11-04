# Design system

Source: `src/design/tokens.css`. Live reference: `/styleguide`.

## Idea

SLIDE is for exactly two people: each person owns a colour (you / them) and everything else stays quiet so the conversation leads. The look follows the product owner's reference and ships as **two themes** on identical components. One will be chosen (or both offered as a user setting).

|                   | Violet (default)                                                      | Graphite                                           |
| ----------------- | --------------------------------------------------------------------- | -------------------------------------------------- |
| Backdrop          | Purple gradient with a soft top glow                                  | Near-black `#0C0C0D`                               |
| Surfaces          | Frosted glass: translucent `rgb(24 13 72 / .62)` + 18px backdrop blur | Solid `#151516`, hairline `#29292C` borders        |
| You               | Indigo→violet gradient `#5262F2→#6E4CF5`, white text                  | White `#F1F1F2`, near-black text                   |
| Them              | Lilac `#E4DBFF` (avatars, picks); bubbles are translucent white       | Blue `#7FB0FF` (avatars, picks); bubbles `#202022` |
| Accents           | Gold `#FFCF5C` labels, pink-lilac `#E9A8FF` glow on reveals           | Gold `#F5C542` labels, pink `#F472B6` glow         |
| Labels            | Uppercase, tracked                                                    | Monospace, sentence case                           |
| Meta (timestamps) | Body font                                                             | Monospace                                          |
| Heading weight    | 750                                                                   | 550                                                |

Switching: `src/design/theme.ts` sets `data-theme` on `<html>` before first render. `?theme=graphite` previews a theme; the choice is saved per browser. Theme tokens live in `src/design/tokens.css` (`@theme` = Violet defaults, `:root[data-theme='graphite']` = overrides). Utilities: `surface-glass`, `bg-you-fill`, `label-meta`, `font-meta`.

Contrast: every text pair is ≥ 4.5:1, including Violet's translucent surfaces computed against the brightest part of the backdrop (muted text on the top glow: 4.9:1; white on the you-gradient: 5.1:1). axe checks run on both themes in CI.

## Type

- **Plus Jakarta Sans** (variable): headings, buttons, labels. Heading weight is set per theme; tracking −0.02em.
- **System monospace**: labels and timestamps in Graphite.
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
