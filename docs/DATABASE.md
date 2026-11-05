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

\* Stage 3 will allow reading the display name of the other member of a shared space.

Column-level grants: clients can write only `display_name`. `id`, `created_at` and `updated_at` are never client-writable.

## Planned

| Table                                     | Stage |
| ----------------------------------------- | ----- |
| `spaces`, `space_members`, `invitations`  | 3     |
| `messages`                                | 4     |
| `activity_sessions`, `activity_responses` | 6     |

## Policy principles

- RLS enabled on every table, default deny; `anon` gets nothing on private tables.
- Multi-step writes (accepting an invite) go through security-definer functions with row locks.
- Every policy is tested as owner, other user and anonymous (`supabase/tests/*.test.ts`).

## How the access tests work

`supabase/tests/harness.ts` starts an in-process Postgres (PGlite), adds the small part of Supabase our migrations rely on (`auth.users`, `auth.uid()`, `anon` / `authenticated` roles), runs all migrations, then switches roles to act as each kind of user. It runs with `npm test`, needs no network, and catches policy mistakes before anything reaches the real project.
