import { PGlite, type PGliteInterface } from '@electric-sql/pglite'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * A throwaway Postgres (PGlite, in-process) with the small slice of Supabase our
 * migrations depend on: the auth schema, auth.users, auth.uid(), and the anon /
 * authenticated roles. Lets us test row-level security without a network.
 */
const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  grant usage on schema public to anon, authenticated;
`

const migrationsDir = join(import.meta.dirname, '..', 'migrations')

export async function createDb(): Promise<PGlite> {
  const db = new PGlite()
  await db.exec(SUPABASE_STUB)
  for (const file of readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    await db.exec(readFileSync(join(migrationsDir, file), 'utf8'))
  }
  return db
}

export async function createUser(db: PGliteInterface, id: string): Promise<void> {
  await db.exec('reset role')
  await db.query('insert into auth.users (id, email) values ($1, $2)', [id, `${id}@test.local`])
}

/** Run as a signed-in user (or anon when id is null), like a request through the Supabase API. */
export async function as(db: PGliteInterface, id: string | null): Promise<void> {
  await db.exec('reset role')
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [id ?? ''])
  await db.exec(id ? 'set role authenticated' : 'set role anon')
}

export async function asAdmin(db: PGliteInterface): Promise<void> {
  await db.exec('reset role')
  await db.query(`select set_config('request.jwt.claim.sub', '', false)`)
}
