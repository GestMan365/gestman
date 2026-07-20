begin;

-- Dados de acesso e autorização dos usuários de cada empresa.
alter table public.gm_profiles
  add column if not exists contact_email text,
  add column if not exists job_title text,
  add column if not exists details jsonb not null default '{}'::jsonb;

alter table public.gm_company_members
  add column if not exists access_username text,
  add column if not exists access_profile text not null default 'viewer',
  add column if not exists permission_levels jsonb not null default '{}'::jsonb,
  add column if not exists region_id text,
  add column if not exists executor boolean not null default false;

alter table public.gm_company_members drop constraint if exists gm_company_members_role_check;
alter table public.gm_company_members
  add constraint gm_company_members_role_check
  check (role in ('administrator', 'planner', 'supervisor', 'technician', 'executor', 'warehouse', 'requester', 'viewer'));

alter table public.gm_company_members drop constraint if exists gm_company_members_access_profile_check;
alter table public.gm_company_members
  add constraint gm_company_members_access_profile_check
  check (access_profile in ('admin', 'supervisor', 'technician', 'warehouse', 'requester', 'viewer'));

create unique index if not exists gm_company_members_company_username_uidx
  on public.gm_company_members(company_id, lower(access_username))
  where access_username is not null and trim(access_username) <> '';

create or replace function public.gm_protect_member_access_profile()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.role = 'administrator' then new.access_profile := 'admin'; end if;
  return new;
end;
$$;

drop trigger if exists gm_company_members_access_profile on public.gm_company_members;
create trigger gm_company_members_access_profile
before insert or update on public.gm_company_members
for each row execute function public.gm_protect_member_access_profile();

-- Compatibilidade dos administradores criados antes desta migração.
update public.gm_company_members
set access_profile = case role
  when 'administrator' then 'admin'
  when 'planner' then 'supervisor'
  when 'supervisor' then 'supervisor'
  when 'technician' then 'technician'
  when 'executor' then 'technician'
  when 'warehouse' then 'warehouse'
  when 'requester' then 'requester'
  else 'viewer'
end
where access_profile = 'viewer' or access_profile is null;

update public.gm_company_members m
set access_username = coalesce(
  nullif(auth_u.raw_user_meta_data->>'access_username', ''),
  split_part(auth_u.email, '.', 1)
)
from auth.users auth_u
where auth_u.id = m.user_id
  and (m.access_username is null or trim(m.access_username) = '');

-- O contexto entregue ao navegador passa a vir integralmente do banco.
drop function if exists public.gm_current_context();
create function public.gm_current_context()
returns table (
  company_id uuid,
  company_name text,
  company_slug text,
  company_status text,
  user_id uuid,
  user_email text,
  display_name text,
  member_role text,
  access_username text,
  access_profile text,
  permission_levels jsonb,
  region_id text,
  executor boolean,
  contact_email text,
  job_title text,
  avatar_url text,
  profile_details jsonb
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select c.id, c.name, c.slug, c.status, u.id, u.email,
         coalesce(p.display_name, u.email), m.role,
         coalesce(m.access_username, u.raw_user_meta_data->>'access_username'),
         case when m.role = 'administrator' then 'admin' else m.access_profile end,
         m.permission_levels, m.region_id, m.executor,
         p.contact_email, p.job_title, p.avatar_url, p.details
  from public.gm_company_members m
  join public.gm_companies c on c.id = m.company_id
  join auth.users u on u.id = m.user_id
  left join public.gm_profiles p on p.user_id = m.user_id
  where m.user_id = auth.uid() and m.active and coalesce(p.active, true) and c.status = 'active'
  order by m.created_at
  limit 1;
$$;

create or replace function public.gm_list_company_users()
returns table (
  user_id uuid,
  auth_email text,
  access_username text,
  display_name text,
  contact_email text,
  job_title text,
  avatar_url text,
  member_role text,
  access_profile text,
  permission_levels jsonb,
  region_id text,
  executor boolean,
  active boolean,
  profile_details jsonb,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
language sql
stable
security definer
set search_path = public, auth
as $$
  with mine as (
    select m.company_id
    from public.gm_company_members m
    where m.user_id = auth.uid() and m.active and m.role = 'administrator'
    limit 1
  )
  select u.id, u.email, m.access_username, coalesce(p.display_name, u.email),
         p.contact_email, p.job_title, p.avatar_url, m.role,
         case when m.role = 'administrator' then 'admin' else m.access_profile end,
         m.permission_levels, m.region_id, m.executor,
         (m.active and coalesce(p.active, true)), p.details,
         m.created_at, u.last_sign_in_at
  from mine
  join public.gm_company_members m on m.company_id = mine.company_id
  join auth.users u on u.id = m.user_id
  left join public.gm_profiles p on p.user_id = m.user_id
  order by case when m.role = 'administrator' then 0 else 1 end, coalesce(p.display_name, u.email);
$$;

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
    select 1 from public.gm_company_members
    where company_id = p_company_id and user_id = p_actor_user_id
      and active and role = 'administrator'
  ) then raise exception 'GM_ADMIN_REQUIRED'; end if;

  if trim(coalesce(p_display_name, '')) = '' or trim(coalesce(p_access_username, '')) = '' then
    raise exception 'GM_REQUIRED_FIELDS';
  end if;
  if p_access_username !~ '^[a-z0-9][a-z0-9._-]{1,47}$' then raise exception 'GM_INVALID_USERNAME'; end if;
  if p_access_profile not in ('admin', 'supervisor', 'technician', 'warehouse', 'requester', 'viewer') then
    raise exception 'GM_INVALID_PROFILE';
  end if;

  select m.user_id into v_primary_admin
  from public.gm_company_members m
  where m.company_id = p_company_id and m.role = 'administrator'
  order by m.created_at asc limit 1;
  if p_user_id = v_primary_admin and (not p_active or p_access_profile <> 'admin') then
    raise exception 'GM_PRIMARY_ADMIN_PROTECTED';
  end if;

  insert into public.gm_profiles(user_id, display_name, contact_email, job_title, avatar_url, active, details)
  values (p_user_id, trim(p_display_name), nullif(trim(coalesce(p_contact_email, '')), ''),
          nullif(trim(coalesce(p_job_title, '')), ''), nullif(trim(coalesce(p_avatar_url, '')), ''),
          p_active, coalesce(p_details, '{}'::jsonb))
  on conflict (user_id) do update set
    display_name = excluded.display_name,
    contact_email = excluded.contact_email,
    job_title = excluded.job_title,
    avatar_url = excluded.avatar_url,
    active = excluded.active,
    details = excluded.details;

  insert into public.gm_company_members(
    company_id, user_id, role, active, access_username, access_profile,
    permission_levels, region_id, executor
  ) values (
    p_company_id, p_user_id, p_member_role, p_active, lower(trim(p_access_username)), p_access_profile,
    coalesce(p_permission_levels, '{}'::jsonb), nullif(trim(coalesce(p_region_id, '')), ''), p_executor
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

  insert into public.gm_audit_log(company_id, user_id, action, entity, entity_id, metadata)
  values (p_company_id, p_actor_user_id, 'user.upsert', 'company_user', p_user_id::text,
          jsonb_build_object('access_username', p_access_username, 'access_profile', p_access_profile, 'active', p_active));
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
    select 1 from public.gm_company_members
    where company_id = p_company_id and user_id = p_actor_user_id
      and active and role = 'administrator'
  ) then raise exception 'GM_ADMIN_REQUIRED'; end if;
  if p_user_id = p_actor_user_id and not p_active then raise exception 'GM_SELF_DEACTIVATION_BLOCKED'; end if;
  select m.user_id into v_primary_admin from public.gm_company_members m
  where m.company_id = p_company_id and m.role = 'administrator'
  order by m.created_at asc limit 1;
  if p_user_id = v_primary_admin and not p_active then raise exception 'GM_PRIMARY_ADMIN_PROTECTED'; end if;

  update public.gm_company_members set active = p_active
  where company_id = p_company_id and user_id = p_user_id;
  if not found then raise exception 'GM_USER_NOT_FOUND'; end if;
  update public.gm_profiles set active = p_active where user_id = p_user_id;
  insert into public.gm_audit_log(company_id, user_id, action, entity, entity_id, metadata)
  values (p_company_id, p_actor_user_id, case when p_active then 'user.activate' else 'user.deactivate' end,
          'company_user', p_user_id::text, '{}'::jsonb);
  return true;
end;
$$;

revoke all on function public.gm_current_context() from public, anon;
revoke all on function public.gm_list_company_users() from public, anon;
revoke all on function public.gm_upsert_company_user_internal(uuid, uuid, uuid, text, text, text, text, text, text, text, jsonb, text, boolean, boolean, jsonb) from public, anon, authenticated;
revoke all on function public.gm_set_company_user_active_internal(uuid, uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.gm_current_context() to authenticated;
grant execute on function public.gm_list_company_users() to authenticated;
grant execute on function public.gm_upsert_company_user_internal(uuid, uuid, uuid, text, text, text, text, text, text, text, jsonb, text, boolean, boolean, jsonb) to service_role;
grant execute on function public.gm_set_company_user_active_internal(uuid, uuid, uuid, boolean) to service_role;

commit;
