# Supabase

- `migrations/` — versioned SQL migrations (timestamp-prefixed). Never edit a migration that has run in production; add a new one.
- `tests/` — access tests run in an in-process Postgres (PGlite) via `npm test`. Each policy is tested as owner, other user and anonymous.

How to apply migrations: `docs/SUPABASE_SETUP.md`. Schema: `docs/DATABASE.md`.
