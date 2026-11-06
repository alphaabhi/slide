# Decisions log

Newest first. Each entry: what, why, and what it rules out. Reversible decisions can be revisited; record the change here when they are.

## 2026-11-06

**D-031 · How games work (stage 6).**

- _Rounds in the chat._ Each play is a round (`activity_rounds`) shown as a card in the chat timeline at the time it started, so games and messages read as one shared history. Started from the ✦ Play button beside the message box (or "break the ice" in an empty chat).
- _Hidden until both answer (D-006), enforced by the database._ Answers (`activity_responses`) are readable by their author, and by the other member only once the round is `revealed`. The second answer flips the round to revealed in the same locked transaction. Rounds stream live (Realtime); answers never do: the app refetches after a round changes, through the read policy.
- _Rules (server-side):_ members of a space with two people only; one open round per game per space (starting again returns the open one); Question of the Day once per space per ~day (20 h); either person can skip an open round (a given answer stays hidden); a closed space keeps its history but takes no new rounds or answers; 60 rounds/hour flood limit; answering twice is a safe no-op.
- _Prompts_ live in the app (`src/features/activities/prompts.ts`, 25 per game, owner's tone) with permanent keys; rounds store the key and the text shown. The next prompt is one the space hasn't played; after a full cycle it still avoids the most recent half.
- _Your turn._ A gold strip above the message box appears when a game is waiting on you and its card isn't on screen; tapping it scrolls to the card. Reveals flip in; a shared pick glows once (both off under reduced motion).
- Same resilience as chat: game updates ride the chat's live connection, and the reconnect catch-up and 5-second fallback also refresh games.

**D-030 · Copy: "No small talk zone"; 18 conversation starters, three per space.** Owner found "Not the Hinge chat" and the original starters flat. Space-name placeholder is now "No small talk zone" (owner's choice). Empty chats show three starters from a pool of 18 (`src/features/chat/starters.ts`) in the owner's tone: playful, curious, a little cheeky, never explicit. The three are chosen from the space id, so both people see the same ones and they don't reshuffle on refresh; different spaces get different sets.

**D-029 · Avatars beside messages; picker pictures load eagerly.** Owner asked (real-phone test, 2026-11-06) for each message to show its sender's small avatar, both sides. It sits beside the last bubble of each run (like iMessage/Messenger), so a burst of messages shows one picture, not one per bubble; people without an avatar show their initial. The picker's images were `loading="lazy"`, which iOS Safari can leave blank inside the animating, scrolling sheet until reopened; they now load eagerly, are preloaded in the background on home and the name step (~40 KB, once), are SVGO-optimised, and are cached for 7 days.

**D-028 · Avatars: DiceBear "Adventurer" style, original names in the picker only.** Owner picked style A (Adventurer, Lisa Wischofsky, CC BY 4.0 — credit to be shown on the Privacy/About page). 8–12 hand-picked characters. Names are original anime-style names (e.g. Kai, Rin, Haru, Sora, Mika, Yuna, Jin, Aiko) rather than franchise character names (owner's first idea; switched to avoid trademark issues). Names appear **only** as labels in the picker; everywhere else the person's own display name is shown.

**D-027 · Colour token `base` renamed `canvas`.** Tailwind generated `text-base` as both a font size and a colour, so anything sized `text-base` could render in the background colour (the chat title was invisible). Renamed to `--color-canvas`.

**D-026 · How chat works (stage 4).**

- _Sending_ goes through `send_message` with a device-generated `client_id`; unconfirmed messages live in a per-tab outbox (sessionStorage) and are re-sent with the same id after a failure, going back online, or a refresh — the server returns the existing message, so no duplicates. "Sent" appears only after the server confirms. Permanent errors (space closed, too long) show a reason instead of a retry loop.
- _Live updates_ use Supabase Realtime `postgres_changes` on `messages`, filtered to the open space only, cleaned up on leave. After any reconnect the newest page is re-fetched and merged (de-duplicated by `client_id`). If the live connection can't be made within 4 s or drops, the app checks every 5 s until it's back.
- _History_ loads 50 at a time, newest first; older pages load on scroll to the top without moving the view. New messages scroll into view only if you're at the bottom or sent it; otherwise a "New message" button appears.
- _Keyboard_: desktop Enter sends, Shift+Enter new line; touch screens: return makes a new line, the button sends and the keyboard stays open; never sends mid-composition (IME). On iOS the chat follows `visualViewport` so the box stays above the keyboard.
- _Draft_ kept per space for the tab. _Screen readers_ hear new incoming messages only, not the whole history.
- No typing indicators, read receipts or reactions yet (instructions §3.7: later).

## 2026-11-05

**D-025 · Sign-in code: 6 digits in six boxes, auto sign-in.** Owner asked for a 4-character letters-and-numbers code. Supabase only issues numeric codes of 6–10 digits, and building a custom code system would mean writing our own generation, checking, expiry and lockouts (a security trade-off) for a weaker code. Agreed instead: Supabase "Email OTP Length" set to 6 (was 8), and a six-box entry (`CodeInput`) — one real field under the boxes, so phone autofill ("From Mail"), password managers and pasting a whole message all work; signs in as soon as the 6th digit arrives. `CODE_LENGTH` in `validation.ts` must match the Supabase setting.

**D-024 · How spaces and invites work (stage 3).**

- _Token shown once._ Only a SHA-256 hash is stored, so the server can't show a link again. The creator's tab remembers the latest link (sessionStorage, per space) so it can be copied again in that tab; otherwise "Make a new link" replaces it and kills the old one.
- _Token never stays in the address bar._ `/i/<token>` immediately stores the token in sessionStorage and moves to `/join`, so it isn't left in history or shared screenshots; it survives the sign-in and name steps in the same tab.
- _Signed-out preview._ The join page shows who invited you and the space title before you sign in (only while the invite is usable), because "Abhi wants to take the conversation somewhere else" is what makes someone sign up.
- _Leaving._ The leaver loses access at once; if the other person remains the space closes (they keep read access to history, nobody can send or join); when nobody is left it's deleted. Stated in the confirmation dialog.
- _Limits._ Invites last 7 days; 20 new spaces/day per person and 20 new links/day per space.
- _Arrival detection._ The waiting screen checks every 6 s until the other person joins; replaced by live updates in stage 4.
- _Default name._ Untitled spaces show as "You & Meera".

**D-023 · Domain: `slidedm.space`.** Bought by the owner at Hostinger. Sign-in emails send from the subdomain `mail.slidedm.space` via Resend (keeps the root domain's email reputation separate). The root domain is SLIDE's web address on Vercel (connected 2026-11-05: `slidedm.space` serves production, `www` 308-redirects to it, so invite links read `slidedm.space/i/…`).

**D-022 · Wordmark "I" rebuilt; landing line rewritten.** Owner noted the "I" touched the L and sat high. It's now two equal halves with a small gap, exactly cap height, bottom on the baseline, with measured equal spacing to the L and D (15/16 px at 4×, matching the other letter gaps). Favicon updated to match. Landing subline, from the owner's draft: "Anyone can slide into DMs. On SLIDE, you get to **stay**." ("stay" in gold).

**D-021 · Never a blank screen; signed-in code loads in parallel.** Owner reported slow loads and a black screen needing several refreshes. Causes found: (1) after a new deploy, an open page's old code files no longer exist and the lazy import failed silently, leaving a blank page; (2) three code files downloaded one after another before sign-in/home could render. Fixes: an error boundary + `vite:preloadError` handler reload once on missing files (guarded against loops), otherwise a plain "Reload" screen; a branded loader inlined in `index.html` for the first paint; all signed-in pages are fetched together (`src/app/routes.ts`) and preloaded in the background on the landing page; the profile is prefetched as soon as the session is known; faster query retries. Measured with `npm run perf` (see TESTING.md).

**D-020 · "Spark" highlight for keywords.** Owner wants keywords (names, key phrases) to stand out instead of uniform white text. One gradient — gold → pink → blue — as slowly shimmering text (`text-spark`), used about once per screen (the name in the greeting, "you" in onboarding, the landing tagline). Supporting accents: gold for highlighted details (email address, sparkle icons), blue for your saved name. A gradient ring marks your avatar. Static under reduced motion.

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
