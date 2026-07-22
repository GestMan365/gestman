-- GestMan365 Supabase snapshot — reference only, captured 2026-07-22.
-- Schema-only. No customer data. Do not apply directly to production.
-- Exact remote definitions of the three critical state RPCs follow.

CREATE OR REPLACE FUNCTION public.gm_bootstrap_company(p_name text, p_slug text, p_display_name text)
RETURNS TABLE(company_id uuid, company_name text, company_slug text, member_role text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_company public.gm_companies%rowtype;
  v_slug text := lower(trim(p_slug));
begin
  if v_user_id is null then raise exception 'GM_AUTH_REQUIRED'; end if;
  if exists (select 1 from public.gm_company_members where user_id = v_user_id) then
    raise exception 'GM_USER_ALREADY_HAS_COMPANY';
  end if;
  if trim(coalesce(p_name, '')) = '' or trim(coalesce(p_display_name, '')) = '' then
    raise exception 'GM_REQUIRED_FIELDS';
  end if;
  if v_slug !~ '^[a-z0-9][a-z0-9-]{1,62}$' then raise exception 'GM_INVALID_SLUG'; end if;
  insert into public.gm_companies(name, slug, created_by)
    values (trim(p_name), v_slug, v_user_id) returning * into v_company;
  insert into public.gm_profiles(user_id, display_name)
    values (v_user_id, trim(p_display_name))
    on conflict (user_id) do update set display_name = excluded.display_name, active = true;
  insert into public.gm_company_members(company_id, user_id, role)
    values (v_company.id, v_user_id, 'administrator');
  insert into public.gm_tenant_state(company_id, state, updated_by)
    values (v_company.id, '{}'::jsonb, v_user_id);
  insert into public.gm_user_preferences(company_id, user_id)
    values (v_company.id, v_user_id);
  insert into public.gm_audit_log(company_id, user_id, action, entity, entity_id)
    values (v_company.id, v_user_id, 'company.bootstrap', 'company', v_company.id::text);
  return query select v_company.id, v_company.name, v_company.slug, 'administrator'::text;
end;
$function$;

CREATE OR REPLACE FUNCTION public.gm_load_tenant_state()
RETURNS TABLE(company_id uuid, state jsonb, version bigint, updated_at timestamp with time zone)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  select s.company_id, s.state, s.version, s.updated_at
  from public.gm_tenant_state s
  where public.gm_is_company_member(s.company_id)
  limit 1;
$function$;

CREATE OR REPLACE FUNCTION public.gm_save_tenant_state(p_expected_version bigint, p_state jsonb)
RETURNS TABLE(version bigint, updated_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_company_id uuid;
  v_current_version bigint;
  v_current_state jsonb;
  v_persisted_state jsonb;
  v_updated_at timestamptz;
  v_key text;
  v_module text;
  v_level text;
  v_changed_keys text[] := '{}'::text[];
  v_changed_modules text[] := '{}'::text[];
begin
  if auth.uid() is null then raise exception 'GM_AUTH_REQUIRED'; end if;
  if jsonb_typeof(p_state) <> 'object' then raise exception 'GM_INVALID_STATE'; end if;
  select s.company_id, s.version, s.state
    into v_company_id, v_current_version, v_current_state
    from public.gm_tenant_state s
    where public.gm_is_company_member(s.company_id)
    order by s.updated_at desc limit 1 for update;
  if v_company_id is null then raise exception 'GM_COMPANY_NOT_FOUND'; end if;
  if v_current_version <> p_expected_version then raise exception 'GM_STATE_CONFLICT'; end if;
  v_persisted_state := p_state - 'profile';
  if coalesce(v_current_state, '{}'::jsonb) ? 'profile' then
    v_persisted_state := jsonb_set(v_persisted_state, '{profile}', v_current_state -> 'profile', true);
  end if;
  for v_key in
    select keys.key from (
      select jsonb_object_keys(coalesce(v_current_state, '{}'::jsonb)) as key
      union select jsonb_object_keys(v_persisted_state) as key
    ) keys
    where (coalesce(v_current_state, '{}'::jsonb) -> keys.key)
      is distinct from (v_persisted_state -> keys.key)
  loop
    v_module := public.gm_state_key_module(v_key);
    v_level := public.gm_member_module_level(v_company_id, v_module);
    if public.gm_access_level_rank(v_level) < public.gm_access_level_rank('operate') then
      raise exception 'GM_PERMISSION_DENIED:%:%', v_module, v_key;
    end if;
    if public.gm_array_removes_records(v_current_state -> v_key, v_persisted_state -> v_key)
       and public.gm_access_level_rank(v_level) < public.gm_access_level_rank('manage') then
      raise exception 'GM_DELETE_PERMISSION_DENIED:%:%', v_module, v_key;
    end if;
    v_changed_keys := array_append(v_changed_keys, v_key);
    if not v_module = any(v_changed_modules) then
      v_changed_modules := array_append(v_changed_modules, v_module);
    end if;
  end loop;
  update public.gm_tenant_state s
    set state = v_persisted_state, version = s.version + 1, updated_by = auth.uid()
    where s.company_id = v_company_id
    returning s.version, s.updated_at into v_current_version, v_updated_at;
  insert into public.gm_audit_log(company_id, user_id, action, entity, entity_id, metadata)
    values (v_company_id, auth.uid(), 'state.save', 'tenant_state', v_company_id::text,
      jsonb_build_object('version', v_current_version,
        'changed_keys', to_jsonb(v_changed_keys),
        'changed_modules', to_jsonb(v_changed_modules)));
  return query select v_current_version, v_updated_at;
end;
$function$;

-- Other remote signatures confirmed (definitions require official schema-only dump):
-- gestman365_set_updated_at()
-- gestman_login(text,text,text)
-- gm365_insert_evento_os(uuid,text,text,jsonb)
-- gm365_registrar_evento_os()
-- gm_access_level_rank(text)
-- gm_array_removes_records(jsonb,jsonb)
-- gm_company_slug(text,text)
-- gm_consume_public_rate_limit(text,integer,integer)
-- gm_convert_company_request_internal(...)
-- gm_convert_company_request_with_access_internal(...)
-- gm_current_context()
-- gm_current_platform_role()
-- gm_is_company_admin(uuid)
-- gm_is_company_member(uuid)
-- gm_is_platform_admin(uuid)
-- gm_is_valid_cnpj(text)
-- gm_list_company_users()
-- gm_manage_company(uuid,text,jsonb)
-- gm_member_can(uuid,text,text)
-- gm_member_module_level(uuid,text)
-- gm_permanently_delete_company(uuid)
-- gm_profile_default_level(text,text)
-- gm_protect_member_access_profile()
-- gm_review_company_request(uuid,text,text)
-- gm_set_company_user_active_internal(uuid,uuid,uuid,boolean)
-- gm_set_updated_at()
-- gm_state_key_module(text)
-- gm_storage_company_id(text)
-- gm_storage_module(text)
-- gm_submit_company_request(jsonb)
-- gm_touch_company_access(uuid)
-- gm_upsert_company_user_internal(...)
-- proxima_ordem_servico_numero()
-- rls_auto_enable()

