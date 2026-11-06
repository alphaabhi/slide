-- =============================================================================
-- Avatars
-- Each person can pick one of SLIDE's illustrated avatars (or none, which shows
-- their initial). Only the key is stored; the images ship with the app.
-- The other person in a shared space can see it, like the display name.
-- =============================================================================

alter table public.profiles add column avatar text;

alter table public.profiles add constraint profiles_avatar_valid check (
  avatar is null or avatar in (
    'kai', 'rin', 'haru', 'sora', 'mika', 'jin', 'yuna', 'ren', 'aiko', 'taro', 'nori', 'emi'
  )
);

-- Clients may set or clear their own avatar (row-level security already limits
-- updates to your own profile).
grant insert (avatar) on public.profiles to authenticated;
grant update (avatar) on public.profiles to authenticated;

-- The join page also shows the inviter's avatar.
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
         s.title, s.status as space_status, p.display_name as inviter_name,
         p.avatar as inviter_avatar
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
    'inviter_avatar', v_inv.inviter_avatar,
    'space_title', v_inv.title,
    'expires_at', v_inv.expires_at
  );
end;
$$;
