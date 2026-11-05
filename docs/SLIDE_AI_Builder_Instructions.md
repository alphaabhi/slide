# SLIDE --- AI Builder & Developer Instructions

**Document type:** Project constitution / persistent build instructions\
**Product:** SLIDE\
**Tagline:** Take the conversation somewhere else.\
**Initial platform:** Mobile-first web application (installable as a PWA
where practical)\
**Product stage:** MVP\
**Primary users:** Two adults in one private space\
**Core principle:** Build a beautiful, reliable, fast product---not
merely a convincing visual demo.

------------------------------------------------------------------------

## 1. How to use this document

Treat this file as the persistent source of truth for the SLIDE project.
Read it before making changes and keep following it throughout
development.

These instructions apply whether you are acting as the product designer,
frontend developer, backend developer, QA engineer, or technical lead.

### Non-negotiable working rules

1.  **Inspect before changing.** First inspect the existing repository,
    framework, dependencies, routes, database schema, environment
    variables (never reveal secret values), and current implementation.
    Do not replace working architecture without a clear reason.
2.  **Plan before substantial work.** Briefly state what you found, the
    implementation plan, risks, and files likely to change. Then
    execute; do not stop at a plan unless clarification is essential.
3.  **Build working functionality.** Do not substitute static mockups,
    fake buttons, hardcoded chat messages, simulated authentication, or
    local-only data for real product features.
4.  **Preserve project continuity.** Do not casually rename the product,
    change its core concept, remove working features, reset the
    database, or rewrite the application.
5.  **Make incremental, testable changes.** Keep changes focused. Run
    relevant checks after each meaningful change and fix regressions
    before continuing.
6.  **Do not invent completion.** Clearly distinguish implemented,
    tested, partially implemented, and not-yet-implemented
    functionality.
7.  **Ask only when blocked.** Make sensible, reversible product
    decisions independently. Ask before destructive changes, paid
    services, public launches, security trade-offs, or decisions that
    materially change the product.
8.  **Keep this document current.** If architecture, product scope,
    setup, or important decisions change, update the relevant
    documentation and explain the change.

------------------------------------------------------------------------

## 2. Product definition

SLIDE is a private, playful, interactive communication space for exactly
two people.

One person creates a space and shares a unique invitation link with
another person they have met through a dating app, social media, an
event, or real life. The invited person joins, and both participants can
communicate and enjoy optional shared activities.

SLIDE is **not** a dating marketplace, matching algorithm, public social
network, group-chat product, or WhatsApp clone.

### Product promise

Make moving a conversation beyond a dating app feel easy, personal,
playful, and memorable.

### Product personality

-   Playful, confident, warm, modern, and slightly cheeky.
-   Intimate without assuming that users are romantically involved.
-   Premium and thoughtfully designed, never childish or cluttered.
-   Friendly and expressive without excessive animation or visual noise.
-   Inclusive of different identities, relationship types, and
    communication styles.

### Core product principles

-   The conversation comes first.
-   Interactive experiences add delight; they must never obstruct
    messaging.
-   Both people have equal control and agency.
-   Joining must be effortless and understandable.
-   Privacy and safety are foundational, not optional polish.
-   Performance and reliability are product features.
-   The experience must feel excellent on a phone before desktop is
    considered.

------------------------------------------------------------------------

## 3. MVP scope: build this first

Do not expand scope until the following end-to-end journey works
reliably.

### 3.1 Landing page

-   Clearly explain SLIDE in a few seconds.
-   Strong, distinctive headline and concise product explanation.
-   One primary call to action to create or join a space.
-   Show a small preview of the experience without making the page busy.
-   Make the privacy proposition clear and truthful.
-   Include basic Terms, Privacy, and support/contact links before
    public launch.
-   Avoid fake testimonials, fake user counts, or unsupported security
    claims.

### 3.2 Account and identity

-   Secure account creation and sign-in.
-   Each person has a stable account identity and editable display name.
-   Do not rely on display names as authentication.
-   No unrestricted public registration into an existing private
    conversation.
-   Provide sign-out and appropriate session handling.
-   Provide a clear account recovery path appropriate to the chosen
    authentication provider.

### 3.3 Private two-person spaces

-   A user can create a private space.
-   Each space has a unique, hard-to-guess invitation token.
-   An invitation can be accepted by one other authorised account only.
-   Each space has exactly two active participant slots.
-   Once both slots are occupied, further joins must be rejected.
-   The creator cannot accidentally create duplicate participants by
    accepting their own invite.
-   Provide a safe way to revoke or rotate an unused invitation.
-   Do not expose private space IDs or conversation content through
    public pages.
-   A user can only access spaces in which they are an authorised
    participant.

### 3.4 Messaging

-   Real-time one-to-one text messaging.
-   Messages persist in the database and load after refresh or sign-in.
-   Display sender identity and sensible local timestamps.
-   Support emoji and normal Unicode text.
-   Enter sends; Shift+Enter inserts a line break on desktop.
-   On mobile, the send action must work naturally with the on-screen
    keyboard.
-   Show sending, sent, failed, and retry states where appropriate.
-   Prevent accidental duplicate sends when a user taps repeatedly or a
    network retries.
-   Keep the newest messages visible without disrupting someone reading
    older messages.
-   Support pagination or incremental history loading; do not load an
    unlimited conversation at once.
-   Provide an understandable empty state for a new conversation.
-   Do not silently discard a message when connectivity is interrupted.

### 3.5 Initial interactive activities

Include a simple activity area that does not interfere with the chat.
Start with:

1.  **Would You Rather** --- both participants answer the same prompt.
2.  **This or That** --- quick preference choices.
3.  **Question of the Day** --- one prompt and two responses.

Requirements: - Activities are optional. - Both participants can skip or
dismiss an activity. - Clearly show whose turn it is, if turns are
used. - Persist answers where the feature implies shared history. -
Avoid repetitive prompts in a short session. - Do not introduce complex
game engines in the MVP.

### 3.6 Basic personalisation

-   Display names.
-   A small, curated set of themes or accent colours if straightforward.
-   A custom space title if it does not complicate onboarding.
-   Sensible defaults; users should not need to customise anything to
    start chatting.

### 3.7 Future features --- do not build yet unless explicitly approved

Keep the architecture extensible, but do not let future scope delay the
MVP:

-   Image, video, and document sharing.
-   Voice notes and audio/video calls.
-   Push notifications.
-   Read receipts and typing indicators if not needed for the first
    release.
-   Digital gifts, secret messages, shared memories, and milestones.
-   Paid subscriptions, premium themes, and in-app purchases.
-   Native iOS and Android apps.
-   Group spaces or public discovery.

------------------------------------------------------------------------

## 4. Design direction and visual quality

The visual experience is a major part of SLIDE's differentiation. Do not
settle for a generic admin dashboard or an unmodified template.

### 4.1 Design goals

The product should look like a carefully art-directed consumer app:

-   Elegant typography with a clear hierarchy.
-   Spacious layouts and intentional negative space.
-   A restrained, memorable colour system.
-   Beautiful but readable chat bubbles.
-   Subtle depth, borders, and surfaces.
-   Thoughtful empty, loading, error, and success states.
-   Consistent iconography.
-   Small moments of delight in onboarding and activities.
-   Excellent contrast and legibility in both light and dark
    environments if both are supported.

Explore a distinctive visual identity rather than automatically
defaulting to a generic purple gradient. A dark, editorial, playful
direction may be explored, but usability and readability take priority.

### 4.2 Design system

Create reusable design tokens for:

-   Colours and semantic states.
-   Typography scale and font weights.
-   Spacing scale.
-   Border radii.
-   Shadows and elevation.
-   Component heights and touch targets.
-   Breakpoints.
-   Motion durations and easing.

Use a consistent component system for buttons, inputs, cards, dialogs,
toasts, navigation, message bubbles, and activity cards.

Avoid one-off styling where a shared component or token is appropriate.

### 4.3 Layout and responsive behaviour

Design mobile-first, then adapt to larger screens.

Test at minimum: - Small iPhone-sized viewport. - Typical modern
iPhone/Android viewport. - Tablet width. - Desktop width.

Requirements: - No horizontal overflow. - No clipped controls or text. -
Chat composer remains accessible when the mobile keyboard opens. -
Respect safe-area insets on mobile devices. - Use appropriately sized
touch targets (aim for 44 × 44 CSS pixels). - Avoid hover-only
interactions; all functionality must work with touch. - Keep important
actions reachable with one hand on common phone sizes. - Long names and
long messages must wrap gracefully.

### 4.4 Motion and interaction

Use animation to communicate state and add personality, not as
decoration everywhere.

-   Prefer short, subtle transitions.
-   Animate only properties that are efficient to render where possible
    (opacity and transform).
-   Avoid large layout-shifting animations.
-   Respect `prefers-reduced-motion`.
-   Do not delay navigation or sending a message for an animation.
-   Avoid autoplay audio, flashing effects, and intrusive pop-ups.
-   Pop-ups should be contextual, dismissible, and accessible.
-   Never show a promotional pop-up in the middle of composing a
    message.

### 4.5 Accessibility

-   Use semantic HTML.
-   Ensure keyboard navigation and visible focus states.
-   Label all inputs and buttons accessibly.
-   Provide accessible names for icon-only controls.
-   Maintain sufficient colour contrast.
-   Do not communicate status using colour alone.
-   Support screen readers for new messages and important state changes
    without announcing every minor UI update.
-   Respect reduced-motion preferences.

------------------------------------------------------------------------

## 5. Performance and smoothness requirements

The goal is a responsive experience with no avoidable lag. Do not
promise literally zero latency: network quality, device performance, and
hosting conditions are outside the application's complete control.

### 5.1 Performance principles

-   Keep the initial application bundle lean.
-   Load only what is needed for the current screen.
-   Lazy-load nonessential features and routes.
-   Avoid unnecessary dependencies and large UI libraries.
-   Avoid repeated database queries and unnecessary real-time
    subscriptions.
-   Subscribe only to the current authorised conversation.
-   Clean up subscriptions, listeners, and timers when components
    unmount.
-   Prevent avoidable re-renders; keep state local where possible.
-   Do not re-render the entire message history for every keystroke.
-   Use pagination or virtualisation if message volume warrants it.
-   Optimise fonts and images; do not load oversized assets.
-   Avoid blocking the main thread with expensive calculations.
-   Use optimistic UI updates only when failures can be reconciled
    safely.
-   Debounce search or expensive input-driven operations where
    appropriate, but never add artificial delay to message sending.
-   Cache only data that is safe and useful to cache.
-   Do not cache private conversation data in shared/public caches.

### 5.2 Suggested performance targets

Treat these as targets to measure, not guarantees:

-   Lighthouse mobile Performance score: aim for 90+ on representative
    production pages.
-   Lighthouse Accessibility score: aim for 95+.
-   Largest Contentful Paint: aim for 2.5 seconds or less under suitable
    test conditions.
-   Interaction to Next Paint: aim for 200 ms or less.
-   Cumulative Layout Shift: aim for 0.1 or less.
-   Initial route should avoid shipping unnecessary feature code.
-   Local UI feedback for sending should appear immediately.
-   Under a healthy connection, a sent message should appear for the
    other participant promptly; measure actual median and p95 delivery
    latency in testing.

Record test conditions and actual results. Do not claim targets were met
without measurement.

### 5.3 Network resilience

-   Show connection state when it materially affects messaging.
-   Handle reconnects without creating duplicate subscriptions or
    duplicate messages.
-   Preserve a message draft if sending fails.
-   Provide a clear retry action.
-   Reconcile optimistic messages with the server's authoritative
    response.
-   Handle slow responses gracefully.
-   Do not show a false "sent" state before the server confirms
    acceptance.
-   Avoid infinite retry loops.

------------------------------------------------------------------------

## 6. Technical architecture

Choose a simple, maintainable architecture. Do not add infrastructure
for hypothetical scale.

### Preferred MVP approach

A React-based frontend with a managed backend such as Supabase is
suitable, provided the current repository and builder environment
support it well.

Possible components: - Frontend: React with TypeScript. - Build tooling:
Vite or the existing framework if already established. - Styling: a
consistent design-token system and reusable components. -
Backend/database: Supabase Postgres. - Authentication: Supabase Auth or
a comparably secure managed provider. - Live updates: Supabase Realtime
or an equivalent managed real-time service. - Hosting: the selected
builder's deployment platform or a reliable static/web host. - Testing:
unit, integration, and browser-level end-to-end tests.

Do not migrate frameworks merely to match this preference. If the
existing stack is sound, retain it and document why.

### Architecture expectations

-   Keep UI, business logic, and data access separated.
-   Use TypeScript types for important entities and API boundaries.
-   Validate input on both client and server.
-   Keep secrets in environment variables or the hosting provider's
    secret manager.
-   Never put service-role keys, database passwords, or private API
    secrets in browser code.
-   Provide a documented database schema and migrations.
-   Use stable IDs and server-generated timestamps.
-   Add indexes for common access patterns.
-   Keep database queries scoped to the authorised space.
-   Use server-side checks and database policies; hiding UI is not
    security.
-   Keep dependencies maintained and avoid unnecessary packages.

### Suggested core data model

Adapt this to the chosen backend; do not blindly create duplicate or
redundant tables.

**users / profiles** - `id` - `display_name` - `created_at` -
`updated_at`

**spaces** - `id` - `title` - `created_by` - `created_at` - `status`

**space_members** - `space_id` - `user_id` - `joined_at` - Unique
constraint on `(space_id, user_id)`. - Enforce no more than two members
per space using a transaction-safe server-side mechanism.

**invitations** - `id` - `space_id` - `token_hash` or securely stored
token representation - `created_by` - `expires_at` - `revoked_at` -
`accepted_by` - `accepted_at`

**messages** - `id` - `space_id` - `sender_id` - `body` - `created_at` -
Optional `edited_at` / `deleted_at` only if those capabilities are
actually implemented.

**activity_sessions / activity_responses** - Add only what is required
for the initial activities. - Associate every activity with a space and
authorised participant. - Validate activity state transitions on the
server.

Use transactions or equivalent atomic operations for invitation
acceptance and two-person capacity enforcement to prevent race
conditions.

------------------------------------------------------------------------

## 7. Security, privacy, and trust

Security is a release requirement, not a later enhancement.

### Access control

-   Every space must have exactly two authorised participants.
-   A user must not read, send, edit, or delete data in a space they do
    not belong to.
-   Enforce authorisation in the backend and database, not only in
    frontend route guards.
-   Apply database row-level security (RLS) or equivalent policies to
    all private tables.
-   Test policies using both authorised and unauthorised accounts.
-   Never trust a `space_id`, `user_id`, sender ID, or role supplied by
    the browser without server-side verification.

### Invitation safety

-   Invitation tokens must be cryptographically random and unguessable.
-   Store token hashes where practical.
-   Support expiration and revocation.
-   Do not expose tokens in analytics, logs, error reports, or referrer
    data.
-   Ensure an invitation can only fill the second participant slot once.
-   Handle two people attempting to accept the same invitation at the
    same time safely.
-   Make it clear that anyone with a valid invitation link may be able
    to use it until it expires or is revoked; provide appropriate
    controls.

### Privacy

-   Collect the minimum personal information required.
-   Do not require contact lists, precise location, or social-media
    credentials.
-   Do not sell or expose conversation content.
-   Do not include message bodies or invitation tokens in analytics.
-   Define retention and deletion behaviour before public launch.
-   Provide a way to leave a space and explain what happens to its
    history.
-   Provide a clear process for account deletion and data deletion
    consistent with applicable law and provider capabilities.
-   Use reputable hosting and managed services with appropriate privacy
    terms.

### Honest security language

Do not call the product "end-to-end encrypted" unless genuine end-to-end
encryption has been designed, implemented, and independently tested.
HTTPS and database access controls are not the same as end-to-end
encryption.

Do not promise anonymity, absolute privacy, or immunity from data
breaches.

### Abuse prevention

Even a two-person product needs basic safety: - Ability to leave a
space. - Ability to revoke an unused invite. - Basic rate limits for
login, invitation attempts, and message sending. - Clear
reporting/support route before broader public launch. - No unsolicited
access to another person's space. - No feature that forces a participant
to answer a question or perform a dare.

------------------------------------------------------------------------

## 8. Error handling and reliability

Every important action must have a defined success, loading, empty, and
failure state.

Cover at least: - Failed login. - Expired or invalid invitation. -
Invitation already used. - Space already full. - Lost network
connection. - Failed message send. - Duplicate send attempt. - Database
unavailable. - Real-time connection dropped. - Session expired. - User
removed or space no longer available.

Errors should be written in plain language and offer a useful next step.
Never expose stack traces, SQL details, secret values, or internal
infrastructure information to end users.

Use structured server logs and error monitoring where appropriate. Avoid
logging private message contents or authentication secrets.

------------------------------------------------------------------------

## 9. Testing and release checklist

Do not mark the MVP complete until the following have been tested.

### Core journey tests

-   [ ] A user can create an account and sign in.
-   [ ] A user can create a space.
-   [ ] A unique invitation link is generated.
-   [ ] A second authorised account can join.
-   [ ] The space rejects a third participant.
-   [ ] The creator cannot occupy both participant slots.
-   [ ] Both users can exchange messages in real time.
-   [ ] Messages persist after refresh and sign-out/sign-in.
-   [ ] Both users see consistent sender identity and timestamps.
-   [ ] A failed send is visible and can be retried.
-   [ ] An expired or revoked invitation cannot be accepted.
-   [ ] A user outside the space cannot read or send messages.
-   [ ] Two different spaces cannot access each other's data.
-   [ ] Initial interactive activities work for both participants.
-   [ ] The application works on mobile and desktop.

### Browser and device checks

Test current stable versions of: - Safari on iPhone. - Chrome on
Android. - Chrome on desktop. - Safari or Firefox on desktop where
practical.

Test: - Slow network. - Temporary offline state. - Refresh during a
conversation. - Mobile keyboard open. - Long messages. - Emoji and
non-English characters. - Small screens. - Expired sessions.

### Automated quality checks

Use the tools appropriate to the repository: - Type checking. -
Linting. - Unit tests for business logic. - Integration tests for
database and access policies. - End-to-end tests for the full two-person
journey. - Production build. - Lighthouse or equivalent performance and
accessibility audits.

Fix critical and high-severity issues before launch. Report any
remaining known issues.

------------------------------------------------------------------------

## 10. Development workflow

For every development task, follow this sequence:

1.  Read this document and inspect the current code.
2.  Identify the intended user outcome.
3.  Check existing components and services before creating new ones.
4.  State a concise implementation plan.
5.  Make the smallest coherent change.
6.  Run relevant tests and checks.
7.  Test the actual user journey, not just whether the page renders.
8.  Fix errors and regressions.
9.  Update documentation if setup, schema, architecture, or behaviour
    changed.
10. Report what changed, what was tested, what remains incomplete, and
    any user action required.

### Before adding a dependency

Explain why it is necessary, check whether the existing stack already
provides the capability, and prefer the smallest maintained solution.

### Before changing the database

-   Inspect the current schema and data.
-   Use versioned migrations.
-   Avoid destructive changes.
-   Never reset or drop production data without explicit approval.
-   Explain any migration that could affect existing users.

### Before deployment

-   Confirm environment variables are configured securely.
-   Confirm production database and authentication settings.
-   Confirm RLS/access policies are enabled and tested.
-   Confirm no test credentials or secrets are present.
-   Run the production build and smoke tests.
-   Verify the deployed URL and full invitation-to-chat journey.

------------------------------------------------------------------------

## 11. Documentation to maintain

Keep these project documents updated:

-   `README.md` --- what the app is and how to run it.
-   `PROJECT_STATUS.md` --- completed, in-progress, blocked, and next
    tasks.
-   `ARCHITECTURE.md` --- system structure and key technical decisions.
-   `DATABASE.md` or schema/migration files --- tables, relationships,
    and access policies.
-   `.env.example` --- variable names and descriptions only; never real
    secrets.
-   `TESTING.md` --- how to run tests and what has been verified.
-   This instruction file --- persistent product and engineering
    principles.

Do not create documentation that contradicts the actual implementation.

------------------------------------------------------------------------

## 12. Definition of done

A feature is done only when:

1.  It solves the intended user problem.
2.  It works end-to-end with real data.
3.  It is responsive and visually consistent.
4.  It has loading, empty, success, and error states as applicable.
5.  It respects authentication and authorisation.
6.  It has been tested at the appropriate level.
7.  It does not introduce obvious performance regressions.
8.  It is documented where necessary.
9.  It has no fake controls or placeholder behaviour presented as
    complete.

The MVP is ready for a small private beta only when two separate people
can create/join a space, exchange persistent real-time messages, use the
initial activities, and be prevented from accessing anyone else's space.

------------------------------------------------------------------------

## 13. Product priorities when trade-offs arise

Use this order:

1.  **Security and privacy**
2.  **Correctness and reliability**
3.  **Core messaging usability**
4.  **Performance and responsiveness**
5.  **Visual quality and accessibility**
6.  **Interactive delight**
7.  **Additional features**

Never sacrifice access control or message integrity for visual polish or
speed of delivery.

Do not add features simply because they are technically interesting.
Every feature should improve the experience of two people connecting.

------------------------------------------------------------------------

## 14. Final instruction

Build SLIDE as a real consumer product with the care and quality of a
polished, modern application.

It should be beautiful enough that users enjoy sharing it, simple enough
that they understand it immediately, fast enough that the interface
feels effortless, and reliable enough that they trust it with their
conversations.

Think like a product designer, senior engineer, security reviewer, and
QA tester---not just a code generator.

**The goal is not to produce the most code. The goal is to create the
best possible first experience for two people who want to take their
conversation somewhere else.**
