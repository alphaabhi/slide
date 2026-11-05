# Project status

_Last updated: 2026-11-05_

## Stage overview

| #   | Stage                                            | Status                                                                   |
| --- | ------------------------------------------------ | ------------------------------------------------------------------------ |
| 0   | Foundations                                      | **Done** (local). Waiting on GitHub/Supabase/Vercel accounts to connect. |
| 1   | Design system                                    | **Done**. Awaiting product-owner review of `/styleguide`.                |
| 2   | Auth & profiles (email OTP)                      | Next                                                                     |
| 3   | Spaces & invitations                             | Not started                                                              |
| 4   | Messaging core                                   | Not started                                                              |
| 5   | Network resilience                               | Not started                                                              |
| 6   | Activities                                       | Not started                                                              |
| 7   | Personalisation, landing, legal pages            | Not started                                                              |
| 8   | Hardening (security, a11y, performance, devices) | Not started                                                              |
| 9   | Private beta                                     | Not started                                                              |

## Done

- Vite + React 19 + TypeScript (strict, `noUncheckedIndexedAccess`) scaffold, `@/` alias.
- Tooling: oxlint, Prettier, Vitest + Testing Library, Playwright + axe, GitHub Actions CI (check + e2e).
- `vercel.json`: SPA rewrites, security headers (CSP, HSTS, frame-deny, referrer, permissions), immutable asset caching.
- `.env.example` (public values only), env module that never logs values, lazy Supabase client (PKCE).
- Design tokens (`src/design/tokens.css`) and components: Button, Input/Textarea, Card, Dialog (bottom sheet on mobile), Toast, Avatar, MessageBubble (sending / sent / failed + retry), ActivityCard (answers hidden until both choose), Icon set, Spinner, Wordmark.
- `/styleguide` route (lazy-loaded; dev and previews only).
- Honest holding page at `/` (no product or privacy claims) and a 404 page.

## Stage 2 — what exists

- Email-code sign-in (`/sign-in`): email step → code step, 60s resend cooldown, "use a different email", plain-language errors (wrong/expired code, rate limit, offline).
- First-time name step (`/welcome`), signed-in home (`/home`) with rename and sign-out.
- Route guards: signed-out users are sent to sign in and returned to where they were going; redirect targets are restricted to this app.
- Session expiry shows "You've been signed out"; all cached data cleared on sign-out.
- `profiles` table + RLS (`supabase/migrations/20261105000000_profiles.sql`).
- Supabase code only loads on sign-in/account pages (landing page JS 78 KB gzip).

## Not done / known gaps

- Stage 2 has been tested against a local Postgres and a mocked Supabase API, not yet against the real project. First real check: sign in on the Vercel preview.
- Supabase's built-in email sender only reaches members of the Supabase organisation. A real email service (SMTP, e.g. Resend) is required before anyone else can sign in.
- "Your spaces" on the home screen is an honest placeholder until stage 3.
- Question of the Day uses free-text answers; its card variant is designed in stage 6, not yet built.
- Landing-page JS is ~78 KB gzip. Re-measure at stage 7 with Lighthouse.
- Hindi and other non-Latin scripts render in the system font (intentional; see DECISIONS).
- Not yet tested on real iPhone / Android hardware (stage 4, 6, 8).

## Waiting on the product owner

1. Link GitHub to Claude (claude.ai → Settings → Connectors) with access to `alphaabhi/slide`, so the code can be pushed.
2. Supabase: run the profiles migration and update the email templates (`docs/SUPABASE_SETUP.md`).
3. Vercel: import the repo and add the two environment variables (after the push).

## Platform

Web app first (mobile-first, PWA later); native iOS/Android only if the web version works out (D-014).

## Next

Stage 3: spaces and invitations — `spaces`, `space_members`, `invitations` tables, `accept_invitation` function with the two-person limit, create-space and invite-link screens, join page, revoke/rotate, leave space.
