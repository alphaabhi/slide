-- =============================================================================
-- Stage 3 · Spaces and invitations
--
-- A space holds exactly two people. One person creates it and gets a private
-- invite link; one other signed-in person can use that link to join.
--
-- Security model
--   * Clients can READ spaces, members and invite status through row-level
--     security (members only). They can never write these tables directly.
--   * Every change goes through the functions below (security definer), which
--     take the caller's identity from the verified session (auth.uid()), lock
--     the rows they change, and enforce the rules in one transaction.
--   * Invite tokens are 256-bit random strings shown once. Only a SHA-256 hash
--     is stored, so a database leak does not reveal working invite links.
-- =============================================================================

-- Internal helpers live in a schema the Supabase API does not expose.
create schema if not exists private;
revoke all on schema private from public;

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

create table public.spaces (
  id uuid primary key default gen_random_uuid(),
  title text,
  created_by uuid not null references auth.users (id) on delete cascade,
  -- active: open for chat (and for the second person to join)
  -- closed: someone left; the remaining member keeps read access to history
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint spaces_status_valid check (status in ('active', 'closed')),
  constraint spaces_title_length check (title is null or char_length(title) between 1 and 60),
  constraint spaces_title_trimmed check (title is null or title = btrim(title)),
  constraint spaces_title_no_control_chars check (title is null or title !~ '[[:cntrl:]]')
);

create index spaces_created_by_idx on public.spaces (created_by, created_at desc);

create trigger spaces_set_updated_at
  before update on public.spaces
  for each row execute function public.set_updated_at();

create table public.space_members (
  space_id uuid not null references public.spaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (space_id, user_id)
);

create index space_members_user_idx on public.space_members (user_id, joined_at desc);

-- Members always have a profile (create/accept require one). This link also lets
-- the app load a space and both display names in a single request.
alter table public.space_members
  add constraint space_members_user_profile_fk
  foreign key (user_id) references public.profiles (id) on delete cascade;

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  token_hash bytea not null unique,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  revoked_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz
);

-- At most one usable (not revoked, not accepted) invite per space.
create unique index invitations_one_open_per_space
  on public.invitations (space_id)
  where revoked_at is null and accepted_at is null;

-- -----------------------------------------------------------------------------
-- Hard limit: never more than two members, whatever path inserts them.
-- (The functions below already check under a row lock; this is the backstop.)
-- -----------------------------------------------------------------------------

create or replace function private.enforce_two_members()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform 1 from public.spaces where id = new.space_id for update;
  if (select count(*) from public.space_members where space_id = new.space_id) >= 2 then
    raise exception 'space_full' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger space_members_max_two
  before insert on public.space_members
  for each row execute function private.enforce_two_members();

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

create or replace function private.hash_token(p_token text)
returns bytea
language sql
immutable
set search_path = ''
as $$
  select sha256(convert_to(coalesce(p_token, ''), 'UTF8'))
$$;

-- 256 bits from the cryptographically secure generator behind gen_random_uuid()
-- (two v4 UUIDs = 244 random bits), encoded as URL-safe base64 (43 characters).
create or replace function private.new_invite_token(out token text, out token_hash bytea)
language plpgsql
volatile
set search_path = ''
as $$
declare
  raw bytea;
begin
  raw := decode(
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
    'hex'
  );
  token := rtrim(translate(encode(raw, 'base64'), '+/', '-_'), '=');
  token_hash := private.hash_token(token);
end;
$$;

create or replace function private.fail(p_code text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  -- The message is a stable machine-readable code; the app maps it to plain language.
  raise exception '%', p_code using errcode = 'P0001';
end;
$$;

-- Used by row-level security. Security definer so it can read space_members
-- without recursing into that table's own policy.
create or replace function public.is_space_member(p_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.space_members m
    where m.space_id = p_space_id and m.user_id = (select auth.uid())
  )
$$;

create or replace function public.shares_space_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.space_members mine
    join public.space_members theirs on theirs.space_id = mine.space_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = p_user_id
  )
$$;

-- -----------------------------------------------------------------------------
-- Actions
-- -----------------------------------------------------------------------------

-- Create a space and its first invite. Returns the invite token once.
create or replace function public.create_space(p_title text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_title text := nullif(btrim(regexp_replace(coalesce(p_title, ''), '\s+', ' ', 'g')), '');
  v_space_id uuid;
  v_invite record;
begin
  if v_uid is null then perform private.fail('not_signed_in'); end if;
  if not exists (select 1 from public.profiles where id = v_uid) then
    perform private.fail('profile_required');
  end if;
  if (
    select count(*) from public.spaces
    where created_by = v_uid and created_at > now() - interval '1 day'
  ) >= 20 then
    perform private.fail('rate_limited');
  end if;

  insert into public.spaces (title, created_by) values (v_title, v_uid) returning id into v_space_id;
  insert into public.space_members (space_id, user_id) values (v_space_id, v_uid);

  select * into v_invite from private.new_invite_token();
  insert into public.invitations (space_id, token_hash, created_by)
  values (v_space_id, v_invite.token_hash, v_uid);

  return jsonb_build_object('space_id', v_space_id, 'invite_token', v_invite.token);
end;
$$;

-- What the join page shows for a link. Works signed out, so the invited person
-- sees who invited them before creating an account. Reveals the inviter's name
-- and space title only while the invite is usable.
create or replace function public.get_invitation(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_inv record;
  v_members int;
  v_status text;
begin
  select i.space_id, i.created_by, i.expires_at, i.revoked_at, i.accepted_at,
         s.title, s.status as space_status, p.display_name as inviter_name
    into v_inv
  from public.invitations i
  join public.spaces s on s.id = i.space_id
  left join public.profiles p on p.id = i.created_by
  where i.token_hash = private.hash_token(p_token);

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if v_uid is not null and exists (
    select 1 from public.space_members where space_id = v_inv.space_id and user_id = v_uid
  ) then
    return jsonb_build_object(
      'status', case when v_inv.created_by = v_uid then 'own' else 'member' end,
      'space_id', v_inv.space_id
    );
  end if;

  select count(*) into v_members from public.space_members where space_id = v_inv.space_id;

  v_status := case
    when v_inv.revoked_at is not null then 'revoked'
    when v_inv.accepted_at is not null then 'used'
    when v_inv.expires_at <= now() then 'expired'
    when v_inv.space_status <> 'active' then 'closed'
    when v_members >= 2 then 'full'
    else 'valid'
  end;

  if v_status <> 'valid' then
    return jsonb_build_object('status', v_status);
  end if;

  return jsonb_build_object(
    'status', 'valid',
    'inviter_name', v_inv.inviter_name,
    'space_title', v_inv.title,
    'expires_at', v_inv.expires_at
  );
end;
$$;

-- Join a space with an invite. Safe against double taps (returns the space if
-- you're already in it) and against two people accepting at the same moment
-- (the invite and space rows are locked; the second caller sees 'invite_used').
create or replace function public.accept_invitation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.invitations%rowtype;
  v_space public.spaces%rowtype;
begin
  if v_uid is null then perform private.fail('not_signed_in'); end if;
  if not exists (select 1 from public.profiles where id = v_uid) then
    perform private.fail('profile_required');
  end if;

  select * into v_inv from public.invitations
  where token_hash = private.hash_token(p_token)
  for update;
  if not found then perform private.fail('invite_not_found'); end if;

  select * into v_space from public.spaces where id = v_inv.space_id for update;

  if v_inv.created_by = v_uid then perform private.fail('invite_own'); end if;

  if exists (select 1 from public.space_members where space_id = v_space.id and user_id = v_uid) then
    return jsonb_build_object('space_id', v_space.id, 'already_member', true);
  end if;

  if v_inv.revoked_at is not null then perform private.fail('invite_revoked'); end if;
  if v_inv.accepted_at is not null then perform private.fail('invite_used'); end if;
  if v_inv.expires_at <= now() then perform private.fail('invite_expired'); end if;
  if v_space.status <> 'active' then perform private.fail('space_closed'); end if;
  if (select count(*) from public.space_members where space_id = v_space.id) >= 2 then
    perform private.fail('space_full');
  end if;

  insert into public.space_members (space_id, user_id) values (v_space.id, v_uid);
  update public.invitations set accepted_by = v_uid, accepted_at = now() where id = v_inv.id;

  return jsonb_build_object('space_id', v_space.id, 'already_member', false);
end;
$$;

-- Replace the invite link: the old link stops working immediately.
create or replace function public.rotate_invitation(p_space_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_space public.spaces%rowtype;
  v_invite record;
begin
  if v_uid is null then perform private.fail('not_signed_in'); end if;

  select * into v_space from public.spaces where id = p_space_id for update;
  if not found or not exists (
    select 1 from public.space_members where space_id = p_space_id and user_id = v_uid
  ) then
    perform private.fail('not_member');
  end if;
  if v_space.status <> 'active' then perform private.fail('space_closed'); end if;
  if (select count(*) from public.space_members where space_id = p_space_id) >= 2 then
    perform private.fail('space_full');
  end if;
  if (
    select count(*) from public.invitations
    where space_id = p_space_id and created_at > now() - interval '1 day'
  ) >= 20 then
    perform private.fail('rate_limited');
  end if;

  update public.invitations set revoked_at = now()
  where space_id = p_space_id and revoked_at is null and accepted_at is null;

  select * into v_invite from private.new_invite_token();
  insert into public.invitations (space_id, token_hash, created_by)
  values (p_space_id, v_invite.token_hash, v_uid);

  return jsonb_build_object(
    'invite_token', v_invite.token,
    'expires_at', now() + interval '7 days'
  );
end;
$$;

-- Cancel the current invite link without making a new one.
create or replace function public.revoke_invitation(p_space_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then perform private.fail('not_signed_in'); end if;
  if not exists (
    select 1 from public.space_members where space_id = p_space_id and user_id = v_uid
  ) then
    perform private.fail('not_member');
  end if;

  update public.invitations set revoked_at = now()
  where space_id = p_space_id and revoked_at is null and accepted_at is null;
end;
$$;

-- Leave a space. You lose access immediately and any open invite is cancelled.
-- If the other person is still there, the space closes: they keep read access
-- to its history but no one can send or join. If nobody is left, the space and
-- everything in it is deleted.
create or replace function public.leave_space(p_space_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_remaining int;
begin
  if v_uid is null then perform private.fail('not_signed_in'); end if;

  perform 1 from public.spaces where id = p_space_id for update;
  if not exists (
    select 1 from public.space_members where space_id = p_space_id and user_id = v_uid
  ) then
    perform private.fail('not_member');
  end if;

  delete from public.space_members where space_id = p_space_id and user_id = v_uid;
  update public.invitations set revoked_at = now()
  where space_id = p_space_id and revoked_at is null and accepted_at is null;

  select count(*) into v_remaining from public.space_members where space_id = p_space_id;
  if v_remaining = 0 then
    delete from public.spaces where id = p_space_id;
    return jsonb_build_object('deleted', true);
  end if;

  update public.spaces set status = 'closed' where id = p_space_id;
  return jsonb_build_object('deleted', false);
end;
$$;

-- -----------------------------------------------------------------------------
-- Access control
-- -----------------------------------------------------------------------------

alter table public.spaces enable row level security;
alter table public.space_members enable row level security;
alter table public.invitations enable row level security;

revoke all on public.spaces, public.space_members, public.invitations from anon, authenticated;

grant select on public.spaces to authenticated;
grant update (title) on public.spaces to authenticated;
grant select on public.space_members to authenticated;
-- token_hash is deliberately not readable.
grant select (id, space_id, created_at, expires_at, revoked_at, accepted_at)
  on public.invitations to authenticated;

create policy "spaces: members read"
  on public.spaces for select to authenticated
  using (public.is_space_member(id));

create policy "spaces: members rename"
  on public.spaces for update to authenticated
  using (public.is_space_member(id))
  with check (public.is_space_member(id));

create policy "space_members: members read"
  on public.space_members for select to authenticated
  using (public.is_space_member(space_id));

create policy "invitations: members read status"
  on public.invitations for select to authenticated
  using (public.is_space_member(space_id));

-- The other person in a shared space can see your display name.
create policy "profiles: read space partners"
  on public.profiles for select to authenticated
  using (public.shares_space_with(id));

-- Functions: signed-in users only, except the invite preview.
revoke all on function
  public.is_space_member(uuid),
  public.shares_space_with(uuid),
  public.create_space(text),
  public.get_invitation(text),
  public.accept_invitation(text),
  public.rotate_invitation(uuid),
  public.revoke_invitation(uuid),
  public.leave_space(uuid)
from public, anon;

grant execute on function
  public.is_space_member(uuid),
  public.shares_space_with(uuid),
  public.create_space(text),
  public.get_invitation(text),
  public.accept_invitation(text),
  public.rotate_invitation(uuid),
  public.revoke_invitation(uuid),
  public.leave_space(uuid)
to authenticated;

grant execute on function public.get_invitation(text) to anon;

revoke all on all functions in schema private from public, anon, authenticated;
