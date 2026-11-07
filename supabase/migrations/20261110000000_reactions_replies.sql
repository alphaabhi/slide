-- =============================================================================
-- Release A · Reactions and replies
--
-- * Replies: a message can quote an earlier message from the same space.
-- * Reactions: each person can put one emoji on any message in their space
--   (double-tap = ❤️). Changing it replaces it; removing it clears it.
--
-- Removing a reaction clears the emoji instead of deleting the row, so live
-- updates stay filtered to the space (Realtime can't filter or check access on
-- deletes).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Replies
-- -----------------------------------------------------------------------------

alter table public.messages
  add column reply_to uuid references public.messages (id) on delete set null;

comment on column public.messages.reply_to is
  'The earlier message (same space) this one replies to, if any.';

-- send_message gains an optional reply. Older app versions call it with three
-- named arguments, which still match because the new one has a default.
drop function if exists public.send_message(uuid, uuid, text);

create or replace function public.send_message(
  p_space_id uuid,
  p_client_id uuid,
  p_body text,
  p_reply_to uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_body text := regexp_replace(coalesce(p_body, ''), '^\s+|\s+$', '', 'g');
  v_status text;
  v_msg public.messages%rowtype;
begin
  if v_uid is null then perform private.fail('not_signed_in'); end if;
  if p_client_id is null then perform private.fail('message_invalid'); end if;

  -- A retry of a message that already reached the server: return it, don't duplicate.
  select * into v_msg from public.messages
  where space_id = p_space_id and client_id = p_client_id;
  if found then
    if v_msg.sender_id <> v_uid then perform private.fail('message_invalid'); end if;
    return to_jsonb(v_msg);
  end if;

  if not exists (
    select 1 from public.space_members where space_id = p_space_id and user_id = v_uid
  ) then
    perform private.fail('not_member');
  end if;

  select status into v_status from public.spaces where id = p_space_id;
  if v_status <> 'active' then perform private.fail('space_closed'); end if;

  if v_body = '' then perform private.fail('message_empty'); end if;
  if char_length(v_body) > 4000 then perform private.fail('message_too_long'); end if;

  -- You can only quote a message from this same space.
  if p_reply_to is not null and not exists (
    select 1 from public.messages where id = p_reply_to and space_id = p_space_id
  ) then
    perform private.fail('reply_invalid');
  end if;

  -- Basic flood protection: 20 messages per 10 seconds per person.
  if (
    select count(*) from public.messages
    where sender_id = v_uid and created_at > now() - interval '10 seconds'
  ) >= 20 then
    perform private.fail('rate_limited');
  end if;

  insert into public.messages (space_id, sender_id, client_id, body, reply_to)
  values (p_space_id, v_uid, p_client_id, v_body, p_reply_to)
  on conflict (space_id, client_id) do nothing
  returning * into v_msg;

  -- Two identical retries arrived at the same moment: the other one won.
  if not found then
    select * into v_msg from public.messages
    where space_id = p_space_id and client_id = p_client_id;
  end if;

  return to_jsonb(v_msg);
end;
$$;

revoke all on function public.send_message(uuid, uuid, text, uuid) from public, anon;
grant execute on function public.send_message(uuid, uuid, text, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Reactions
-- -----------------------------------------------------------------------------

create table public.message_reactions (
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Copied from the message so access checks and live updates can filter by space.
  space_id uuid not null references public.spaces (id) on delete cascade,
  -- Null = removed.
  emoji text,
  updated_at timestamptz not null default clock_timestamp(),
  primary key (message_id, user_id),

  -- One emoji (which can be several code points, e.g. 👍🏽 or 👩‍❤️‍👨); no letters,
  -- digits, spaces or markup.
  constraint message_reactions_emoji_valid check (
    emoji is null
    or (char_length(emoji) between 1 and 16 and emoji !~ '[[:alnum:][:space:]<>&"''`\\]')
  )
);

comment on table public.message_reactions is
  'One emoji per person per message. emoji is null when the reaction was removed.';

create index message_reactions_space_idx on public.message_reactions (space_id);

create or replace function public.react_to_message(p_message_id uuid, p_emoji text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_space uuid;
  v_emoji text := nullif(btrim(coalesce(p_emoji, '')), '');
  v_row public.message_reactions%rowtype;
begin
  if v_uid is null then perform private.fail('not_signed_in'); end if;

  select m.space_id into v_space from public.messages m where m.id = p_message_id;
  if v_space is null or not exists (
    select 1 from public.space_members where space_id = v_space and user_id = v_uid
  ) then
    perform private.fail('not_member');
  end if;

  if (select status from public.spaces where id = v_space) <> 'active' then
    perform private.fail('space_closed');
  end if;

  begin
    insert into public.message_reactions (message_id, user_id, space_id, emoji)
    values (p_message_id, v_uid, v_space, v_emoji)
    on conflict (message_id, user_id)
      do update set emoji = excluded.emoji, updated_at = clock_timestamp()
    returning * into v_row;
  exception when check_violation then
    perform private.fail('reaction_invalid');
  end;

  return to_jsonb(v_row);
end;
$$;

alter table public.message_reactions enable row level security;
revoke all on public.message_reactions from anon, authenticated;
grant select on public.message_reactions to authenticated;

create policy "message_reactions: members read"
  on public.message_reactions for select to authenticated
  using (public.is_space_member(space_id));

revoke all on function public.react_to_message(uuid, text) from public, anon;
grant execute on function public.react_to_message(uuid, text) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.message_reactions;
  end if;
end;
$$;
