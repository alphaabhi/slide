-- =============================================================================
-- Stage 2 · Profiles
-- One row per account holding the display name. Authentication itself lives in
-- Supabase's auth.users; this table never stores emails or anything sensitive.
-- =============================================================================

create table public.profiles (
  id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_display_name_length
    check (char_length(display_name) between 1 and 40),
  constraint profiles_display_name_trimmed
    check (display_name = btrim(display_name)),
  constraint profiles_display_name_no_control_chars
    check (display_name !~ '[[:cntrl:]]')
);

comment on table public.profiles is 'Public identity for each account: the display name shown to the other person in a space.';

-- Keep updated_at honest without trusting the client.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Access control
-- Default deny. Signed-in users may create, read and rename only their own row.
-- (Stage 3 adds read access to the other member of a shared space.)
-- Column-level grants mean id, created_at and updated_at can never be written
-- by a client; id always comes from the verified session via auth.uid().
-- -----------------------------------------------------------------------------

alter table public.profiles enable row level security;

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant insert (display_name) on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

create policy "profiles: read own"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

create policy "profiles: create own"
  on public.profiles for insert
  to authenticated
  with check (id = (select auth.uid()));

create policy "profiles: rename own"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- No delete policy: a profile is removed only when its account is deleted
-- (on delete cascade from auth.users).
