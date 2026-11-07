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

### Messages (stage 4) — `20261107000000_messages.sql`

| Column                        | Notes                                                                                     |
| ----------------------------- | ----------------------------------------------------------------------------------------- |
| `id`, `space_id`, `sender_id` | Sender always from the session; cascade-deleted with the space                            |
| `client_id`                   | Chosen by the sending device; unique per space, so retries can't duplicate                |
| `body`                        | 1–4,000 characters, trimmed, not blank, no control characters (newlines and tabs allowed) |
| `created_at`                  | Server clock                                                                              |

Index `(space_id, created_at desc, id desc)` for history pages; `(sender_id, created_at desc)` for the rate limit.

**`send_message(space, client_id, body)`** — the only way to write. Returns the saved message; if the same `client_id` was already saved (a retry after a dropped connection) it returns that one instead of creating a copy. Refuses: not a member, space closed, empty, too long, more than 20 messages in 10 seconds.

**Access:** members read their space's messages; nobody can insert, edit or delete directly. When someone leaves they lose access to the history; when the last person leaves, the messages are deleted with the space.

**Live updates:** the table is in the `supabase_realtime` publication. Supabase Realtime applies the read policy to each subscriber, so only the two members receive new messages.

### Avatars — `20261108000000_avatars.sql`

`profiles.avatar`: optional text, one of the 12 picker keys (`kai`, `rin`, `haru`, `sora`, `mika`, `jin`, `yuna`, `ren`, `aiko`, `taro`, `nori`, `emi`) or null for "just my initial", enforced by a check constraint. Users can set it only on their own row (column grants + existing RLS). The other member of a space sees it with the name; `get_invitation` also returns `inviter_avatar` so the invite page can show it. The pictures themselves are static files in `public/avatars/` (no storage bucket, nothing uploaded by users).

### Activities (stage 6) — `20261109000000_activities.sql`

`activity_rounds`: `space_id`, `kind` (`would_you_rather` / `this_or_that` / `question_of_the_day`), `prompt_key`, `prompt`, `option_a`/`option_b` (choice games only), `started_by`, `status` (`open` → `revealed` or `skipped`), `answered_by` (who, never what), `skipped_by`, timestamps. One open round per game per space (partial unique index).

`activity_responses`: `round_id`, `user_id`, `choice` (`a`/`b`) or `answer` (1–500 characters, no control characters); one per person per round.

| Function                                      | Who                   | Does                                                                                                       |
| --------------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------- |
| `start_round(space, kind, key, prompt, a, b)` | members, both present | New round; returns the open one if that game is already open, or today's Question of the Day. 60/hour.     |
| `answer_round(round, choice, answer)`         | members               | Saves your answer; the second answer reveals the round atomically. Retrying is a no-op. Refused if closed. |
| `skip_round(round)`                           | members               | Marks an open round skipped; any answer already given stays hidden.                                        |

**Access:** members read their space's rounds; answers are readable by their author, and by the other member only after the reveal. No direct writes. Rounds are in the `supabase_realtime` publication; answers are not.

### Reactions and replies (Release A) — `20261110000000_reactions_replies.sql`

`messages.reply_to` → the quoted message (same space, checked by `send_message`; `on delete set null`).

`message_reactions`: `message_id`, `user_id`, `space_id` (copied for access checks/live filtering), `emoji` (null = removed), `updated_at`; one row per person per message. Written only by `react_to_message(message, emoji)` (members; active space; null removes). Members read their space's reactions. In the `supabase_realtime` publication.

`send_message(space, client_id, body, reply_to default null)` replaces the 3-argument version (calls with three named arguments still resolve).

## Planned

| Table | Stage |
| ----- | ----- |

## Policy principles

- RLS enabled on every table, default deny; `anon` gets nothing on private tables.
- Multi-step writes (accepting an invite) go through security-definer functions with row locks.
- Every policy is tested as owner, other user and anonymous (`supabase/tests/*.test.ts`).

## How the access tests work

`supabase/tests/harness.ts` starts an in-process Postgres (PGlite), adds the small part of Supabase our migrations rely on (`auth.users`, `auth.uid()`, `anon` / `authenticated` roles), runs all migrations, then switches roles to act as each kind of user. It runs with `npm test`, needs no network, and catches policy mistakes before anything reaches the real project.
