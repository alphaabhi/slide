# Testing

## How to run

```bash
npm run check      # typecheck + lint + unit tests + production build
npm run test:e2e   # Playwright at 4 viewports + axe accessibility
```

Viewports: iPhone SE (375×667), Pixel 7 (412×915), tablet 768×1024, desktop 1280×800.

## Layers

| Layer         | Tool                               | Covers                                                                                |
| ------------- | ---------------------------------- | ------------------------------------------------------------------------------------- |
| Unit          | Vitest + Testing Library           | Component behaviour, pure logic                                                       |
| Database      | Vitest + PGlite (`supabase/tests`) | Migrations, RLS policies and functions as owner / other user / anon                   |
| End-to-end    | Playwright                         | Real user journeys; two isolated browser contexts for two-person flows (from stage 3) |
| Accessibility | axe via Playwright                 | WCAG 2.1 AA; serious or critical violations fail the build                            |
| Performance   | Lighthouse (from stage 7)          | Mobile perf ≥ 90, a11y ≥ 95 targets                                                   |

## Verified — 2026-11-06 (stage 6: games, branch `activities`)

- `npm run check`: **144 tests**, incl. 18 new database tests for games (start rules, one open per game, Question of the Day once a day, validation; the first answer visible only to its author; the second reveals both to both; skip keeps an answer hidden; outsiders and signed-out users see and do nothing; no direct writes; closed spaces; deletion with the space; rounds published, answers not), prompt-list checks (unique keys, lengths, no repeats until a full cycle) and timeline placement of game cards.
- Playwright: **83 pass** (45 skipped by design). New journeys in `e2e/games.spec.ts`, two browsers each: This or That hidden → reveal for both → "Another one" with a different prompt → survives refresh; Question of the Day written answers unlock together and only once a day; skip seen by both; the "your turn" strip appears when the card scrolls away and jumps back to it; a reveal still arrives with the live connection down; no games after the other person leaves. Accessibility checked on the Play sheet and both card types.

## Verified — 2026-11-06 (avatars)

- `npm run check`: **118 tests**, incl. new database tests for avatars (only the 12 keys or null allowed; only your own row; the other member and the invite preview see it; outsiders don't).
- Playwright: **79 pass** (33 skipped by design). New journey `e2e/avatars.spec.ts`: pick an avatar at sign-up → shown on home → invite page and chat show it to the other person → the character name appears nowhere outside the picker → change it from Edit profile and the other person sees the new one → back to "My initial". Accessibility checked on the picker and the Edit profile sheet.

## Verified — 2026-11-06 (stage 4: chat)

- `npm run check`: **113 tests** — 14 new database tests for messages (members send/read in order; server time; trimming, empty, 4,000-char limit, control characters; retry with the same id returns the original; ids can't be hijacked; outsiders and signed-out users blocked; spaces isolated; no direct insert/edit/delete or impersonation; flood limit; leaving keeps history for the other person but stops sending; last leaver deletes; published for Realtime) and 6 for chat logic (merge/de-dupe/order, day separators and runs, Enter rules incl. IME).
- Playwright: **78 pass** (30 skipped by design: multi-person journeys run once). New chat journeys use two browsers and a test backend that speaks Supabase Realtime's protocol (`e2e/mock-supabase.ts`):
  - live both ways; starters fill the box; desktop Enter sends, Shift+Enter new line; Hindi + emoji; same order for both and after refresh; "Sent" only after confirmation; no serious accessibility issues
  - failed send → Not sent → Retry → delivered once
  - offline → banner → message waits → sends itself when back, once
  - live connection dropped → "Reconnecting…" → messages still arrive via fallback; nothing duplicated after reconnect
  - 120-message history opens at newest with 50 loaded; scrolling up loads the rest
  - reading older messages: new one shows a "New message" button instead of jumping
  - other person leaves → history readable, sending disabled
- Found and fixed by screenshots: chat title rendered black-on-black (D-027); offline notice truncated (moved to a full-width strip).
- **Not yet verified:** real Supabase Realtime, real iPhone keyboard behaviour, delivery latency (median/p95) — to measure on the live site.

## Verified — 2026-11-05 (code entry)

- 93 unit/database tests and 71 browser tests pass. New: six-box code field is one labelled input with `autocomplete="one-time-code"`; keeps digits only; signs in on the 6th digit; pasting "Code: 424 242" works (a test caught that a `maxlength` cap broke this — removed).

## Verified — 2026-11-05 (stage 3)

- `npm run check`: **90 tests** — 30 new database tests for spaces and invites: create; token only stored hashed; join; third person rejected (also when bypassing the functions); creator can't join own invite; double tap safe; expired / revoked / replaced links refused; members-only actions; outsiders and anonymous users see nothing; two spaces fully isolated; token hashes unreadable; no direct writes; rename; leave (close vs delete, invite cancelled).
- Playwright: **67 pass** (9 skipped by design: the multi-person journeys run once, at phone size). New, using separate browsers per person against a shared mock backend (`e2e/mock-supabase.ts`):
  - Abhi creates a space → Meera opens the link signed out (token removed from the address bar, sees "Abhi wants to…") → signs up → names herself → joins → Abhi's screen updates without refresh → a third person is turned away and can't open the space URL → Meera leaves → Abhi's space shows Closed.
  - Own link explains itself; refresh keeps the link; new link kills the old; cancelled and made-up links explained.
  - Deleting a space nobody joined kills its link.
  - No serious accessibility issues on invite, join and space screens.
- **Not yet verified:** the migration on the real Supabase project; real two-phone test.

## Performance — 2026-11-05

`npm run perf -- <url>` (headless Chrome, iPhone-sized, 4G throttle 150 ms RTT / 4 Mbps, 4× CPU slowdown, every Supabase call delayed 350 ms, cache disabled):

| Step                             | Before | After (D-021)                   |
| -------------------------------- | ------ | ------------------------------- |
| Landing: first content           | 1.17 s | 1.00 s (loader shows instantly) |
| Tap "Get started" → sign-in form | 1.05 s | 0.56 s                          |
| Submit code → home               | 1.43 s | 0.96 s                          |
| Reload /home while signed in     | 2.63 s | 1.62 s                          |

Also verified: when a code file is missing after a deploy, the page reloads itself once and loads; if it stays missing, a "Reload" message appears (no blank page, no reload loop).

Not yet measured: real devices on the live site; Lighthouse (stage 7–8).

## Verified — 2026-11-05 (stage 2)

- `npm run check`: pass — **58 tests**: 19 database access tests for `profiles`, 30 auth unit tests (email/code/name rules, open-redirect protection, error messages), 9 component tests.
- Playwright: **60/60 pass** at 4 viewports, including the sign-in journey against a mocked Supabase API (`e2e/mock-supabase.ts`):
  - new user: Get started → email → code → name → home → refresh keeps session → sign out → protected page redirects to sign-in
  - returning user skips the name step
  - wrong code → clear error → retry works
  - empty email and rate-limit errors explained
  - resend disabled during cooldown; "use a different email"
  - rename from home
  - `?next=//evil.example.com` ignored
  - no serious accessibility issues on sign-in, name and home screens
- **Not yet verified:** real Supabase sign-in, real email delivery, real devices.

## Verified so far — 2026-11-04 (stage 0–1)

Environment: Linux sandbox, Node 22, headless Chrome (system), production build served by `vite preview`.

- `npm run check`: pass (9 unit tests).
- Playwright: **32/32 pass** across 4 viewports (Graphite theme, 2026-11-05):
  - `/`, `/styleguide`, unknown route render with no console errors and no horizontal overflow.
  - No serious/critical axe violations (includes colour contrast) on all three pages.
  - Every button on the style guide is at least 44×44 px.
  - Dialog opens, closes on Escape, and returns focus to its trigger.
- Visual review of screenshots at 360, 390, 768 and 1280 px.

Not yet verified: real iPhone Safari / Android Chrome hardware, slow-network behaviour (no networked features yet), Lighthouse scores.
