# Decisions log

Newest first. Each entry: what, why, and what it rules out. Reversible decisions can be revisited; record the change here when they are.

## 2026-11-05

**D-019 · Custom SMTP via Resend, set up now rather than before beta.** Supabase only allows editing email templates once custom SMTP is configured, and the default templates send a link rather than the code SLIDE uses (D-015). Resend's free tier is the sender; `onboarding@resend.dev` works for the owner's own testing, and a verified domain is required before anyone else can sign in. Kept the code-only design rather than adding link support.

**D-018 · Database access tests use PGlite instead of pgTAP.** This workspace can't reach Supabase or run Docker, so migrations are tested in an in-process Postgres (PGlite) with a stub of `auth.uid()` and the Supabase roles. Same SQL, same RLS engine; tests run in `npm test` and CI. Real-project checks still happen on the deployed preview.

**D-017 · Sign-out is per device (`scope: 'local'`).** Signing out on one phone doesn't sign you out everywhere. On sign-out or session expiry all cached data is cleared from memory.

**D-016 · Profile id comes from the session, never the client.** `profiles.id` defaults to `auth.uid()` and clients have column-level insert/update rights on `display_name` only. A profile is created on first sign-in at the "What should we call you?" step; no profile = onboarding.

**D-015 · Sign-in by 6-digit email code only (no clickable magic link).** Codes work when the email is opened on a different device or in an in-app browser (common for people arriving from Instagram/Hinge), and avoid redirect-URL configuration. Requires the Supabase email templates to include `{{ .Token }}` (see `SUPABASE_SETUP.md`). Resend has a 60-second cooldown matching Supabase's limit.

**D-014 · Web first; native iOS/Android only if the web version works out.** Decided by the product owner. SLIDE ships as a mobile-first web app (installable to the home screen as a PWA in stage 8). Invite links open straight in the browser with nothing to install, which suits a product that grows through links. If native apps are justified later, two routes reuse this work: (a) wrap this same app with Capacitor for the App Store / Play Store (fastest; must add real native value such as push notifications to pass Apple review), or (b) rebuild the screens in React Native / Expo against the same Supabase backend. The backend, database, security policies and business logic carry over either way. To keep both routes open: business logic stays out of components (features/*/api.ts and hooks), and nothing depends on browser-only APIs without a fallback.

**D-013 · Graphite chosen as the only theme; Violet removed (resolves D-012).** Decided by the product owner. Graphite values are now the token defaults; the theme switcher, `data-theme` overrides and Violet-only utilities (`bg-you-fill`, backdrop blur) were deleted to keep the CSS small. Violet remains in git history (commit 445ec53) if it's ever wanted as an optional theme. `surface-glass` renamed to `surface-panel`.

## 2026-11-04

**D-012 · Two themes from the product owner's reference: Violet and Graphite (supersedes D-011's palette; resolved by D-013).** The owner shared a dashboard reference with a purple-glass version and a near-black version and wants to choose between them. Both are built as `data-theme` token sets on the same components (`src/design/tokens.css`, `src/design/theme.ts`); `?theme=graphite` previews, and the choice is saved per browser. Violet: purple gradient backdrop, frosted cards (backdrop blur), indigo-violet gradient for you, lilac for them, gold labels, pink-lilac glow on reveals, uppercase tracked labels. Graphite: near-black, hairline borders, white for you, blue for them, gold/pink accents, monospace meta text. Display font changed from Bricolage Grotesque to Plus Jakarta Sans to match the reference. Pending: owner picks one (or keeps both as a user-facing theme choice — the MVP allows a small curated set of themes, §3.6).

**D-011 · Palette changed to black + pastels (supersedes D-007's colours; itself superseded by D-012).** Product owner rejected the pine/marigold/lagoon palette. New direction, decided by the product owner: black base; pastel coral `#FF9B8A` = you and primary actions; pastel blue `#A8CDFF` = them; dark yellow `#D9A21B` for highlights and the focus ring; white text. The "duo" idea (each person owns a colour) is kept. Danger moved to rose-red `#FF6B7D` so errors aren't confused with your coral bubbles. Colour tokens renamed to theme-neutral names (`base`, `surface`, `surface-high`, `fg`, `fg-muted`, `gold`).

**D-010 · Dark theme only for the MVP.** One well-tuned theme beats two half-tuned ones; the instructions require excellent contrast in both if both exist. `color-scheme: dark` is declared. Revisit in stage 7 with accent themes.

**D-009 · Self-hosted fonts via Fontsource.** No request to Google Fonts (privacy, no third-party in the CSP, fewer connections on first load). Latin subsets of Atkinson Hyperlegible 400/700 and Bricolage Grotesque variable (weight axis only).

**D-008 · Typefaces: Bricolage Grotesque (display/UI) + Atkinson Hyperlegible (chat and body).** _(Display face replaced by Plus Jakarta Sans in D-012.)_ Bricolage gives the playful, slightly cheeky voice; Atkinson was built for legibility, which matters most in message text. Non-Latin scripts fall back to system fonts.

**D-007 · Duo colour system.** _(Colours superseded by D-011; the duo concept stands.)_ Each participant owns a colour — Marigold `#FFC24B` for the viewer, Lagoon `#8FD3FF` for the other person — on a Pine `#102A26` base. Rejected: a near-black + coral accent proposal (generic), and purple gradients (instructions §4.1). Colour never carries meaning alone: names, labels and icons accompany it.

**D-006 · Activity answers are hidden until both people answer.** Prevents copying and makes the reveal the fun moment. Must be enforced by the server in stage 6 (the partner's answer is not sent to the client until both exist), not just hidden in the UI.

**D-005 · Styling: Tailwind CSS v4 on CSS-variable tokens, Radix primitives only where accessibility is hard (dialog, toast).** No component kit, to keep the bundle lean and the look our own.

**D-004 · Linting with oxlint (from the Vite template) instead of ESLint.** Much faster, already configured with React-hooks rules; no reason to replace it.

**D-003 · Tooling stays lean:** zod is not used on the always-loaded path (env checks are plain code) — it saved ~30 KB gzip. Zod remains available for form and API validation in lazy routes.

**D-002 · Hosting: Vercel (frontend) + Supabase in Mumbai (`ap-south-1`).** Free tiers cover the MVP; upgrade later if needed. Decided by product owner.

**D-001 · Authentication: email OTP / magic link via Supabase Auth (PKCE).** No passwords to store or leak; recovery = access to the email. Decided by product owner.

**D-000 · Greenfield repo.** No existing code was found, so no architecture needed preserving.
