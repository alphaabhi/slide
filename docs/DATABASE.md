# Database

Postgres on Supabase. Every change is a versioned migration in `supabase/migrations/` (run order = filename order) with access tests in `supabase/tests/`. How to apply them: `SUPABASE_SETUP.md`.

## Tables

### `profiles` (stage 2) — `20261105000000_profiles.sql`

| Column         | Type        | Notes                                                              |
| -------------- | ----------- | ------------------------------------------------------------------ |
| `id`           | uuid PK     | Defaults to `auth.uid()`; FK → `auth.users.id`, cascade delete     |
| `display_name` | text        | 1–40 characters, no leading/trailing spaces, no control characters |
| `created_at`   | timestamptz | Server time                                                        |
| `updated_at`   | timestamptz | Set by trigger on every update; client values ignored              |

No email or other personal data is stored here; email lives only in Supabase Auth.

**Access (RLS on, default deny):**

| Who                           | Read | Create     | Rename | Delete                         |
| ----------------------------- | ---- | ---------- | ------ | ------------------------------ |
| Anonymous                     | No   | No         | No     | No                             |
| Signed-in, own row            | Yes  | Yes (once) | Yes    | No (only via account deletion) |
| Signed-in, someone else's row | No*  | No         | No     | No                             |

\* Except the other member of a space you share (stage 3).

Column-level grants: clients can write only `display_name`. `id`, `created_at` and `updated_at` are never client-writable.

### Spaces and invitations (stage 3) — `20261106000000_spaces_and_invitations.sql`

| Table           | Key columns                                                                                    | Notes                                                             |
| --------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `spaces`        | `id`, `title` (optional, 1–60 chars), `created_by`, `status` (`active` / `closed`), timestamps | One space = exactly two people                                    |
| `space_members` | PK `(space_id, user_id)`, `joined_at`                                                          | FK to `profiles`; trigger refuses a third member under a row lock |
| `invitations`   | `token_hash` (SHA-256, unique), `expires_at` (7 days), `revoked_at`, `accepted_by/at`          | At most one open invite per space (partial unique index)          |

**Functions** (the only way to change these tables; identity always from `auth.uid()`):

| Function                   | Who                      | What it does / refuses                                                                                                                                      |
| -------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `create_space(title)`      | signed in, with a name   | Creates space + membership + invite; returns the token once. Max 20/day.                                                                                    |
| `get_invitation(token)`    | anyone, incl. signed out | Join-page preview: `valid` (with inviter name + title), `own`, `member`, or `not_found` / `expired` / `revoked` / `used` / `full` / `closed` (no details)   |
| `accept_invitation(token)` | signed in, with a name   | Locks invite + space; refuses own invite, revoked, used, expired, closed, full. Double tap returns the space.                                               |
| `rotate_invitation(space)` | members                  | New link; old one revoked. Refused if full or closed. Max 20/day per space.                                                                                 |
| `revoke_invitation(space)` | members                  | Cancels the open link                                                                                                                                       |
| `leave_space(space)`       | members                  | You lose access; open invite cancelled; other person still there → space `closed` (they keep read access); nobody left → space and everything in it deleted |

Errors are raised with a stable code as the message (`invite_expired`, `space_full`, …) which the app maps to plain language.

**Access (RLS):** members can read their spaces, both member rows, invite status (never `token_hash`) and the other member's profile; members may rename a space. Outsiders and anonymous users see nothing. Internal helpers live in the non-exposed `private` schema.

## Planned

| Table                                     | Stage |
| ----------------------------------------- | ----- |
| `messages`                                | 4     |
| `activity_sessions`, `activity_responses` | 6     |

## Policy principles

- RLS enabled on every table, default deny; `anon` gets nothing on private tables.
- Multi-step writes (accepting an invite) go through security-definer functions with row locks.
- Every policy is tested as owner, other user and anonymous (`supabase/tests/*.test.ts`).

## How the access tests work

`supabase/tests/harness.ts` starts an in-process Postgres (PGlite), adds the small part of Supabase our migrations rely on (`auth.users`, `auth.uid()`, `anon` / `authenticated` roles), runs all migrations, then switches roles to act as each kind of user. It runs with `npm test`, needs no network, and catches policy mistakes before anything reaches the real project.
