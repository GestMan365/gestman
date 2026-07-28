begin;

create or replace function public.gm_upsert_company_user_internal(
  p_actor_user_id uuid,
  p_company_id uuid,
  p_user_id uuid,
  p_display_name text,
  p_contact_email text,
  p_job_title text,
  p_avatar_url text,
  p_access_username text,
  p_member_role text,
  p_access_profile text,
  p_permission_levels jsonb,
  p_region_id text,
  p_executor boolean,
  p_active boolean,
  p_details jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_primary_admin uuid;
begin
  if not exists (
    select 1
    from public.gm_company_members
    where company_id = p_company_id
      and user_id = p_actor_user_id
      and active
      and role = 'administrator'
  ) then
    raise exception 'GM_ADMIN_REQUIRED';
  end if;

  if trim(coalesce(p_display_name, '')) = ''
     or trim(coalesce(p_access_username, '')) = '' then
    raise exception 'GM_REQUIRED_FIELDS';
  end if;
  if p_access_username !~ '^[a-z0-9][a-z0-9._-]{1,47}$' then
    raise exception 'GM_INVALID_USERNAME';
  end if;
  if p_access_profile not in (
    'admin', 'supervisor', 'technician', 'warehouse', 'requester', 'viewer'
  ) then
    raise exception 'GM_INVALID_PROFILE';
  end if;

  select m.user_id
  into v_primary_admin
  from public.gm_company_members m
  where m.company_id = p_company_id
    and m.role = 'administrator'
  order by m.created_at asc
  limit 1;

  if p_user_id = v_primary_admin
     and (not p_active or p_access_profile <> 'admin') then
    raise exception 'GM_PRIMARY_ADMIN_PROTECTED';
  end if;

  insert into public.gm_profiles(
    user_id,
    display_name,
    contact_email,
    job_title,
    avatar_url,
    active,
    details
  )
  values (
    p_user_id,
    trim(p_display_name),
    nullif(trim(coalesce(p_contact_email, '')), ''),
    nullif(trim(coalesce(p_job_title, '')), ''),
    nullif(trim(coalesce(p_avatar_url, '')), ''),
    true,
    coalesce(p_details, '{}'::jsonb)
  )
  on conflict (user_id) do update set
    display_name = excluded.display_name,
    contact_email = excluded.contact_email,
    job_title = excluded.job_title,
    avatar_url = excluded.avatar_url,
    details = excluded.details;

  insert into public.gm_company_members(
    company_id,
    user_id,
    role,
    active,
    access_username,
    access_profile,
    permission_levels,
    region_id,
    executor
  )
  values (
    p_company_id,
    p_user_id,
    p_member_role,
    p_active,
    lower(trim(p_access_username)),
    p_access_profile,
    coalesce(p_permission_levels, '{}'::jsonb),
    nullif(trim(coalesce(p_region_id, '')), ''),
    p_executor
  )
  on conflict (company_id, user_id) do update set
    role = excluded.role,
    active = excluded.active,
    access_username = excluded.access_username,
    access_profile = excluded.access_profile,
    permission_levels = excluded.permission_levels,
    region_id = excluded.region_id,
    executor = excluded.executor;

  insert into public.gm_user_preferences(company_id, user_id)
  values (p_company_id, p_user_id)
  on conflict (company_id, user_id) do nothing;

  insert into public.gm_audit_log(
    company_id,
    user_id,
    action,
    entity,
    entity_id,
    metadata
  )
  values (
    p_company_id,
    p_actor_user_id,
    'membership.upsert',
    'company_membership',
    p_user_id::text,
    jsonb_build_object(
      'access_username', p_access_username,
      'access_profile', p_access_profile,
      'membership_active', p_active,
      'scope', 'company'
    )
  );

  return p_user_id;
end;
$$;

create or replace function public.gm_set_company_user_active_internal(
  p_actor_user_id uuid,
  p_company_id uuid,
  p_user_id uuid,
  p_active boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_primary_admin uuid;
begin
  if not exists (
    select 1
    from public.gm_company_members
    where company_id = p_company_id
      and user_id = p_actor_user_id
      and active
      and role = 'administrator'
  ) then
    raise exception 'GM_ADMIN_REQUIRED';
  end if;
  if p_user_id = p_actor_user_id and not p_active then
    raise exception 'GM_SELF_DEACTIVATION_BLOCKED';
  end if;

  select m.user_id
  into v_primary_admin
  from public.gm_company_members m
  where m.company_id = p_company_id
    and m.role = 'administrator'
  order by m.created_at asc
  limit 1;

  if p_user_id = v_primary_admin and not p_active then
    raise exception 'GM_PRIMARY_ADMIN_PROTECTED';
  end if;

  update public.gm_company_members
  set active = p_active
  where company_id = p_company_id
    and user_id = p_user_id;
  if not found then
    raise exception 'GM_USER_NOT_FOUND';
  end if;

  insert into public.gm_audit_log(
    company_id,
    user_id,
    action,
    entity,
    entity_id,
    metadata
  )
  values (
    p_company_id,
    p_actor_user_id,
    case
      when p_active then 'membership.activate'
      else 'membership.deactivate'
    end,
    'company_membership',
    p_user_id::text,
    jsonb_build_object('scope', 'company', 'membership_active', p_active)
  );

  return true;
end;
$$;

create or replace function public.gm_set_global_user_active_internal(
  p_actor_user_id uuid,
  p_user_id uuid,
  p_active boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.gm_is_platform_admin(p_actor_user_id) then
    raise exception 'GM_PLATFORM_ADMIN_REQUIRED' using errcode = '42501';
  end if;
  if p_actor_user_id = p_user_id and not p_active then
    raise exception 'GM_SELF_DEACTIVATION_BLOCKED';
  end if;

  update public.gm_profiles
  set active = p_active
  where user_id = p_user_id;
  if not found then
    raise exception 'GM_USER_NOT_FOUND';
  end if;

  insert into public.gm_platform_audit_log(
    actor_user_id,
    action,
    entity,
    entity_id,
    metadata
  )
  values (
    p_actor_user_id,
    case
      when p_active then 'user.global.activate'
      else 'user.global.deactivate'
    end,
    'global_user',
    p_user_id::text,
    jsonb_build_object('scope', 'global', 'profile_active', p_active)
  );

  return true;
end;
$$;

revoke all on function public.gm_upsert_company_user_internal(
  uuid, uuid, uuid, text, text, text, text, text, text, text, jsonb, text,
  boolean, boolean, jsonb
) from public, anon, authenticated;
revoke all on function public.gm_set_company_user_active_internal(
  uuid, uuid, uuid, boolean
) from public, anon, authenticated;
revoke all on function public.gm_set_global_user_active_internal(
  uuid, uuid, boolean
) from public, anon, authenticated;

grant execute on function public.gm_upsert_company_user_internal(
  uuid, uuid, uuid, text, text, text, text, text, text, text, jsonb, text,
  boolean, boolean, jsonb
) to service_role;
grant execute on function public.gm_set_company_user_active_internal(
  uuid, uuid, uuid, boolean
) to service_role;
grant execute on function public.gm_set_global_user_active_internal(
  uuid, uuid, boolean
) to service_role;

commit;
