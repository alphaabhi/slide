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

## Not done / known gaps

- Nothing is connected to Supabase yet. No auth, data, or real-time code exists — the style guide uses sample data and is not a product feature.
- Question of the Day uses free-text answers; its card variant is designed in stage 6, not yet built.
- The instructions doc must be committed at `docs/SLIDE_AI_Builder_Instructions.md` (product owner to add the file when creating the repo).
- Initial JS is ~102 KB gzip (React, router, query client). Re-measure at stage 7 on the real landing page with Lighthouse.
- Hindi and other non-Latin scripts render in the system font (intentional; see DECISIONS).
- Not yet tested on real iPhone / Android hardware (stage 4, 6, 8).

## Waiting on the product owner

1. Create the GitHub repo, Supabase project (Mumbai, `ap-south-1`) and Vercel project — step-by-step guide to follow.

## Platform

Web app first (mobile-first, PWA later); native iOS/Android only if the web version works out (D-014).

## Next

Stage 2: Supabase project wiring, `profiles` table + RLS, email OTP sign-in screens, display-name onboarding, sign-out, session expiry.
