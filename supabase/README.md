# Supabase

- `migrations/` — versioned SQL migrations (timestamp-prefixed). Never edit a migration that has run in production; add a new one.
- `tests/` — pgTAP tests for row-level security and RPCs. Each policy is tested as owner, partner, outsider and anonymous.

Schema work starts in stage 2 (profiles) and stage 3 (spaces, invitations). See `docs/DATABASE.md`.
