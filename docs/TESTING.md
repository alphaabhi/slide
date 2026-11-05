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
