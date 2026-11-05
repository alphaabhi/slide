# Architecture

## Platform

A mobile-first **web app** (React SPA), installable to the home screen as a PWA from stage 8. Native iOS/Android apps are deferred until the web version proves itself (DECISIONS D-014). The Supabase backend, schema, RLS policies and feature logic are platform-independent and would be reused by a Capacitor wrapper or a React Native app.

## Overview

```
Browser (React SPA, PWA later)
  │  HTTPS — anon key only; every row protected by Postgres RLS
  ▼
Supabase (Mumbai, ap-south-1)
  ├─ Auth        email OTP, PKCE, sessions
  ├─ Postgres    profiles, spaces, space_members, invitations, messages, activities
  │              RLS on every private table; security-definer RPCs for multi-step writes
  └─ Realtime    one channel per open space, scoped by RLS
Vercel         static hosting, security headers (vercel.json), preview deploys per PR
```

There is no custom server. Logic that must be atomic or trusted (accepting an invitation, revealing activity answers) lives in Postgres functions, never in the browser.

## Source layout

```
src/
  app/          App shell: providers, router
  components/
    ui/         Design-system components (no data fetching)
  design/       tokens.css — the only place raw visual values live
  features/     One folder per feature from stage 2: auth/, spaces/, chat/, activities/
                Each owns its components, hooks, data access (api.ts) and types
  lib/          Small shared utilities (env, supabase client, cn, initials)
  pages/        Route components; thin, compose features
  test/         Test setup
e2e/            Playwright tests
supabase/
  migrations/   Versioned SQL
  tests/        pgTAP RLS tests
docs/           Project documentation
```

Rules: UI components never call Supabase directly; features expose hooks backed by TanStack Query. Pages compose features.

## Key technical decisions

See `DECISIONS.md` for the dated log. Summary:

- **Routing:** React Router; every route except the landing/auth path is lazy-loaded.
- **Server state:** TanStack Query (caching, retries, optimistic updates reconciled with server responses). Mutations never auto-retry; message retry is explicit and idempotent.
- **Messages (stage 4):** client-generated `client_id` UUID with a unique constraint on `(space_id, client_id)` — retries and double taps cannot duplicate. `sender_id` defaults to `auth.uid()` and is never accepted from the client.
- **Invitations (stage 3):** 32-byte random token shown once in the link; only its SHA-256 hash is stored. `accept_invitation(token)` RPC locks the space row and checks expiry, revocation, the two-seat cap and self-join in one transaction. Tokens are kept out of logs, analytics and referrers (the join page strips the token from the URL after reading it; `Referrer-Policy` is strict).
- **Realtime:** subscribe only to the open space's channel; unsubscribe on unmount; de-duplicate by message id on reconnect.
- **Security headers:** CSP allows scripts only from self, connections only to self and `*.supabase.co`. `'unsafe-inline'` is allowed for styles only (Radix injects scroll-lock styles).

## Performance baseline (2026-11-04, production build)

| Chunk              | gzip    |
| ------------------ | ------- |
| Initial JS         | 102 KB  |
| Initial CSS        | 6.6 KB  |
| Style guide (lazy) | 13.5 KB |

Fonts: ~76 KB woff2 across 4 files, loaded on demand by unicode range.
