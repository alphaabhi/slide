# Database

No schema exists yet. Tables arrive with the stage that needs them, each as a versioned migration in `supabase/migrations/` with pgTAP tests in `supabase/tests/`.

## Planned (from the instructions, §6)

| Table                                     | Stage | Notes                                                                                                            |
| ----------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------- |
| `profiles`                                | 2     | `id` = `auth.users.id`, `display_name` (1–40 chars), timestamps. Readable by self and by people sharing a space. |
| `spaces`                                  | 3     | `title`, `created_by`, `status`.                                                                                 |
| `space_members`                           | 3     | PK `(space_id, user_id)`; max 2 per space enforced inside `accept_invitation` under a row lock.                  |
| `invitations`                             | 3     | `token_hash` (SHA-256), `expires_at` (7 days), `revoked_at`, `accepted_by/at`.                                   |
| `messages`                                | 4     | `client_id` unique per space; `sender_id` defaults to `auth.uid()`; index `(space_id, created_at desc)`.         |
| `activity_sessions`, `activity_responses` | 6     | Partner's response is not readable until both responses exist.                                                   |

## Policy principles

- RLS enabled on every table, default deny.
- Membership check through one `is_member(space_id)` security-definer function to keep policies consistent.
- Every policy tested as owner, partner, outsider and anonymous.
