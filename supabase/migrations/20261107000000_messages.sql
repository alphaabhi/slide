-- =============================================================================
-- Stage 4 · Messages
--
-- Text messages inside a space. Only the two members can read them; only a
-- member of an active space can send, and only as themselves.
--
-- Sending goes through send_message(), which is idempotent on a client-chosen
-- id: if the network drops after the server saved a message and the app
-- retries, the retry returns the saved message instead of creating a copy.
-- =============================================================================

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  -- Chosen by the sending device; makes retries safe (see send_message).
  client_id uuid not null,
  body text not null,
  created_at timestamptz not null default clock_timestamp(),

  constraint messages_body_length check (char_length(body) between 1 and 4000),
  constraint messages_body_not_blank check (btrim(body, E' \t\r\n') <> ''),
  -- Newlines and tabs are fine; other control characters are not.
  constraint messages_body_no_control_chars
    check (body !~ E'[\\x01-\\x08\\x0b\\x0c\\x0e-\\x1f\\x7f]'),
  constraint messages_client_id_unique unique (space_id, client_id)
);

comment on table public.messages is 'Chat messages. Visible only to the two members of the space.';

-- History is always read newest-first within one space.
create index messages_space_created_idx on public.messages (space_id, created_at desc, id desc);
-- For the per-person send rate limit.
create index messages_sender_recent_idx on public.messages (sender_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Sending
-- -----------------------------------------------------------------------------

create or replace function public.send_message(p_space_id uuid, p_client_id uuid, p_body text)
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

  -- Basic flood protection: 20 messages per 10 seconds per person.
  if (
    select count(*) from public.messages
    where sender_id = v_uid and created_at > now() - interval '10 seconds'
  ) >= 20 then
    perform private.fail('rate_limited');
  end if;

  insert into public.messages (space_id, sender_id, client_id, body)
  values (p_space_id, v_uid, p_client_id, v_body)
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

-- -----------------------------------------------------------------------------
-- Access control: members read; nobody writes directly; no edits or deletes.
-- -----------------------------------------------------------------------------

alter table public.messages enable row level security;
revoke all on public.messages from anon, authenticated;
grant select on public.messages to authenticated;

create policy "messages: members read"
  on public.messages for select to authenticated
  using (public.is_space_member(space_id));

revoke all on function public.send_message(uuid, uuid, text) from public, anon;
grant execute on function public.send_message(uuid, uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Live updates: stream new messages to the open chat. Supabase Realtime applies
-- the read policy above to every subscriber, so only members receive them.
-- -----------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;
