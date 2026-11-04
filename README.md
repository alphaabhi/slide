# SLIDE

_Take the conversation somewhere else._

A private, playful space for exactly two people: one person creates a space, shares an invite link, and the other joins. Real-time chat plus optional shared activities (Would You Rather, This or That, Question of the Day).

**Status:** stage 1 of 9 complete (foundations + design system). See [`docs/PROJECT_STATUS.md`](docs/PROJECT_STATUS.md).

## Stack

React 19 + TypeScript + Vite · Tailwind CSS v4 on design tokens · Radix primitives (dialog, toast) · TanStack Query · React Router · Supabase (Postgres, Auth with email OTP, Realtime; Mumbai region) · Vercel hosting · Vitest + Playwright + axe.

## Run locally

Requires Node 22+.

```bash
npm install
cp .env.example .env.local   # fill in Supabase URL + anon key once the project exists
npm run dev                  # http://localhost:5173
```

The living style guide is at `/styleguide` in dev and on previews.

## Scripts

| Command            | What it does                                                               |
| ------------------ | -------------------------------------------------------------------------- |
| `npm run dev`      | Dev server                                                                 |
| `npm run check`    | Typecheck, lint, unit tests and production build (run before every commit) |
| `npm run test`     | Unit tests (Vitest)                                                        |
| `npm run test:e2e` | Browser tests at 4 viewports, including accessibility (Playwright + axe)   |
| `npm run format`   | Format with Prettier                                                       |

If Playwright's bundled browser isn't installed, point it at a system Chrome: `PW_CHROME_PATH=/usr/bin/google-chrome npm run test:e2e`.

## Docs

- [`docs/SLIDE_AI_Builder_Instructions.md`](docs/SLIDE_AI_Builder_Instructions.md) — product and engineering constitution (source of truth)
- [`docs/PROJECT_STATUS.md`](docs/PROJECT_STATUS.md) — done, in progress, next
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — every significant decision, dated, with reasons
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — structure and technical decisions
- [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) — tokens, components, usage rules
- [`docs/DATABASE.md`](docs/DATABASE.md) — schema and access policies
- [`docs/TESTING.md`](docs/TESTING.md) — how to test and what has been verified

**Starting a new session?** Read the instructions doc, then PROJECT_STATUS and DECISIONS, before changing anything.
