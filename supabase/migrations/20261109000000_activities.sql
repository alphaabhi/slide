-- =============================================================================
-- Stage 6 · Activities (games)
--
-- Would You Rather, This or That and Question of the Day. Each play is a
-- "round" in a space. Both members answer; neither can see the other's answer
-- until both have answered (enforced here, not just hidden in the app). Either
-- member can skip an open round.
--
-- Writes only go through start_round / answer_round / skip_round, which check
-- membership and validate every state change. Rounds stream live to both
-- members through Supabase Realtime; answers are fetched after a reveal.
-- =============================================================================

create table public.activity_rounds (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  kind text not null,
  -- Which prompt from the app's list, so the app can avoid repeats.
  prompt_key text not null,
  -- The prompt as shown, kept so history reads the same if the list changes.
  prompt text not null,
  option_a text,
  option_b text,
  started_by uuid not null references auth.users (id) on delete cascade,
  status text not null default 'open',
  -- Who has answered (never what). Lets the app say "your turn".
  answered_by uuid[] not null default '{}',
  skipped_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),

  constraint activity_rounds_kind_valid
    check (kind in ('would_you_rather', 'this_or_that', 'question_of_the_day')),
  constraint activity_rounds_status_valid check (status in ('open', 'revealed', 'skipped')),
  constraint activity_rounds_prompt_key_valid check (prompt_key ~ '^[a-z0-9-]{1,40}$'),
  constraint activity_rounds_prompt_length check (char_length(prompt) between 1 and 200),
  -- Choice games have exactly two options; Question of the Day has none.
  constraint activity_rounds_options check (
    case when kind = 'question_of_the_day'
      then option_a is null and option_b is null
      else char_length(option_a) between 1 and 80 and char_length(option_b) between 1 and 80
    end
  ),
  constraint activity_rounds_answered_max check (cardinality(answered_by) <= 2)
);

comment on table public.activity_rounds is
  'One play of a game in a space. Visible to the two members; answers live in activity_responses.';

create index activity_rounds_space_created_idx
  on public.activity_rounds (space_id, created_at desc);
-- One open round per game per space at a time.
create unique index activity_rounds_one_open_per_kind
  on public.activity_rounds (space_id, kind) where status = 'open';

create table public.activity_responses (
  round_id uuid not null references public.activity_rounds (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Choice games: 'a' or 'b'. Question of the Day: a short text answer.
  choice text,
  answer text,
  created_at timestamptz not null default clock_timestamp(),
  primary key (round_id, user_id),

  constraint activity_responses_one_kind check ((choice is null) <> (answer is null)),
  constraint activity_responses_choice_valid check (choice is null or choice in ('a', 'b')),
  constraint activity_responses_answer_length
    check (answer is null or char_length(answer) between 1 and 500),
  constraint activity_responses_answer_no_control_chars
    check (answer is null or answer !~ E'[\\x01-\\x08\\x0b\\x0c\\x0e-\\x1f\\x7f]')
);

comment on table public.activity_responses is
  'Answers. Readable by their author, and by the other member only once the round is revealed.';

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

-- Trimmed text, with runs of spaces collapsed (newlines kept for answers).
create or replace function private.clean_text(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(coalesce(p_text, ''), '^\s+|\s+$', '', 'g')
$$;

-- -----------------------------------------------------------------------------
-- Start a round
-- -----------------------------------------------------------------------------

create or replace function public.start_round(
  p_space_id uuid,
  p_kind text,
  p_prompt_key text,
  p_prompt text,
  p_option_a text default null,
  p_option_b text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_status text;
  v_round public.activity_rounds%rowtype;
  v_prompt text := private.clean_text(p_prompt);
  v_a text := nullif(private.clean_text(p_option_a), '');
  v_b text := nullif(private.clean_text(p_option_b), '');
begin
  if v_uid is null then perform private.fail('not_signed_in'); end if;

  if not exists (
    select 1 from public.space_members where space_id = p_space_id and user_id = v_uid
  ) then
    perform private.fail('not_member');
  end if;

  -- Serialise starts in this space so two taps can't create two rounds.
  select status into v_status from public.spaces where id = p_space_id for update;
  if v_status <> 'active' then perform private.fail('space_closed'); end if;
  if (select count(*) from public.space_members where space_id = p_space_id) < 2 then
    perform private.fail('space_waiting');
  end if;

  if p_kind is null or p_kind not in ('would_you_rather', 'this_or_that', 'question_of_the_day') then
    perform private.fail('activity_invalid');
  end if;

  -- Already one open for this game: return it rather than starting another.
  select * into v_round from public.activity_rounds
  where space_id = p_space_id and kind = p_kind and status = 'open';
  if found then return to_jsonb(v_round); end if;

  -- Question of the Day is once a day per space: return today's if there is one.
  if p_kind = 'question_of_the_day' then
    select * into v_round from public.activity_rounds
    where space_id = p_space_id and kind = p_kind and created_at > now() - interval '20 hours'
    order by created_at desc limit 1;
    if found then return to_jsonb(v_round); end if;
  end if;

  if (
    select count(*) from public.activity_rounds
    where space_id = p_space_id and created_at > now() - interval '1 hour'
  ) >= 60 then
    perform private.fail('rate_limited');
  end if;

  if p_kind = 'question_of_the_day' then
    v_a := null;
    v_b := null;
  elsif v_a is null or v_b is null then
    perform private.fail('activity_invalid');
  end if;

  begin
    insert into public.activity_rounds
      (space_id, kind, prompt_key, prompt, option_a, option_b, started_by)
    values (p_space_id, p_kind, p_prompt_key, v_prompt, v_a, v_b, v_uid)
    returning * into v_round;
  exception when check_violation then
    perform private.fail('activity_invalid');
  end;

  return to_jsonb(v_round);
end;
$$;

-- -----------------------------------------------------------------------------
-- Answer a round. The reveal happens here, atomically, when the second answer arrives.
-- -----------------------------------------------------------------------------

create or replace function public.answer_round(
  p_round_id uuid,
  p_choice text default null,
  p_answer text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_round public.activity_rounds%rowtype;
  v_answer text := private.clean_text(p_answer);
begin
  if v_uid is null then perform private.fail('not_signed_in'); end if;

  -- Lock the round: two answers arriving together must not both miss the reveal.
  select * into v_round from public.activity_rounds where id = p_round_id for update;
  if not found or not exists (
    select 1 from public.space_members where space_id = v_round.space_id and user_id = v_uid
  ) then
    perform private.fail('not_member');
  end if;

  -- A retry after a dropped connection: already answered, nothing to change.
  if v_uid = any (v_round.answered_by) then return to_jsonb(v_round); end if;

  if v_round.status <> 'open' then perform private.fail('round_closed'); end if;
  if (select status from public.spaces where id = v_round.space_id) <> 'active' then
    perform private.fail('space_closed');
  end if;

  if v_round.kind = 'question_of_the_day' then
    if v_answer = '' then perform private.fail('answer_empty'); end if;
    if char_length(v_answer) > 500 then perform private.fail('answer_too_long'); end if;
    begin
      insert into public.activity_responses (round_id, user_id, answer)
      values (p_round_id, v_uid, v_answer);
    exception when check_violation then
      perform private.fail('activity_invalid');
    end;
  else
    if p_choice is null or p_choice not in ('a', 'b') then
      perform private.fail('activity_invalid');
    end if;
    insert into public.activity_responses (round_id, user_id, choice)
    values (p_round_id, v_uid, p_choice);
  end if;

  update public.activity_rounds
  set answered_by = array_append(answered_by, v_uid),
      status = case when cardinality(answered_by) + 1 >= 2 then 'revealed' else status end,
      updated_at = clock_timestamp()
  where id = p_round_id
  returning * into v_round;

  return to_jsonb(v_round);
end;
$$;

-- -----------------------------------------------------------------------------
-- Skip (dismiss) an open round. Any answer already given stays hidden.
-- -----------------------------------------------------------------------------

create or replace function public.skip_round(p_round_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_round public.activity_rounds%rowtype;
begin
  if v_uid is null then perform private.fail('not_signed_in'); end if;

  select * into v_round from public.activity_rounds where id = p_round_id for update;
  if not found or not exists (
    select 1 from public.space_members where space_id = v_round.space_id and user_id = v_uid
  ) then
    perform private.fail('not_member');
  end if;

  -- Already finished or skipped: nothing to do.
  if v_round.status <> 'open' then return to_jsonb(v_round); end if;

  update public.activity_rounds
  set status = 'skipped', skipped_by = v_uid, updated_at = clock_timestamp()
  where id = p_round_id
  returning * into v_round;

  return to_jsonb(v_round);
end;
$$;

-- -----------------------------------------------------------------------------
-- Access control
-- -----------------------------------------------------------------------------

alter table public.activity_rounds enable row level security;
alter table public.activity_responses enable row level security;

revoke all on public.activity_rounds from anon, authenticated;
revoke all on public.activity_responses from anon, authenticated;
grant select on public.activity_rounds to authenticated;
grant select on public.activity_responses to authenticated;

create policy "activity_rounds: members read"
  on public.activity_rounds for select to authenticated
  using (public.is_space_member(space_id));

-- Your own answer always; the other person's only after the reveal.
create policy "activity_responses: own, or both answered"
  on public.activity_responses for select to authenticated
  using (
    exists (
      select 1 from public.activity_rounds r
      where r.id = round_id
        and public.is_space_member(r.space_id)
        and (user_id = (select auth.uid()) or r.status = 'revealed')
    )
  );

revoke all on function public.start_round(uuid, text, text, text, text, text) from public, anon;
revoke all on function public.answer_round(uuid, text, text) from public, anon;
revoke all on function public.skip_round(uuid) from public, anon;
grant execute on function public.start_round(uuid, text, text, text, text, text) to authenticated;
grant execute on function public.answer_round(uuid, text, text) to authenticated;
grant execute on function public.skip_round(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Live updates: new rounds, "they answered", reveals and skips reach both
-- members instantly. Answers themselves are not streamed; the app fetches them
-- (through the policy above) when a round changes.
-- -----------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.activity_rounds;
  end if;
end;
$$;
