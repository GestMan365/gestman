begin;

-- Endurece a superficie RPC do backend remoto sem tocar no Supabase remoto.
-- As funcoes abaixo ja existem no snapshot e recebem apenas os grants minimos.

do $$
begin
  if to_regprocedure('public.gm_bootstrap_company(text,text,text)') is not null then
    execute 'revoke all on function public.gm_bootstrap_company(text,text,text) from public, anon, authenticated';
    execute 'grant execute on function public.gm_bootstrap_company(text,text,text) to service_role';
  end if;

  if to_regprocedure('public.gm_bootstrap_company_server(uuid,text,text,text,text)') is not null then
    execute 'revoke all on function public.gm_bootstrap_company_server(uuid,text,text,text,text) from public, anon, authenticated';
    execute 'grant execute on function public.gm_bootstrap_company_server(uuid,text,text,text,text) to service_role';
  end if;

  if to_regprocedure('public.gm_load_tenant_state()') is not null then
    execute 'revoke all on function public.gm_load_tenant_state() from public, anon';
    execute 'grant execute on function public.gm_load_tenant_state() to authenticated';
  end if;

  if to_regprocedure('public.gm_save_tenant_state(bigint,jsonb)') is not null then
    execute 'revoke all on function public.gm_save_tenant_state(bigint,jsonb) from public, anon';
    execute 'grant execute on function public.gm_save_tenant_state(bigint,jsonb) to authenticated';
  end if;

  if to_regprocedure('public.gm_current_context()') is not null then
    execute 'revoke all on function public.gm_current_context() from public, anon';
    execute 'grant execute on function public.gm_current_context() to authenticated';
  end if;

  if to_regprocedure('public.gm_list_company_users()') is not null then
    execute 'revoke all on function public.gm_list_company_users() from public, anon';
    execute 'grant execute on function public.gm_list_company_users() to authenticated';
  end if;

  if to_regprocedure('public.gm_manage_company(uuid,text,jsonb)') is not null then
    execute 'revoke all on function public.gm_manage_company(uuid,text,jsonb) from public, anon';
    execute 'grant execute on function public.gm_manage_company(uuid,text,jsonb) to authenticated';
  end if;

  if to_regprocedure('public.gm_review_company_request(uuid,text,text)') is not null then
    execute 'revoke all on function public.gm_review_company_request(uuid,text,text) from public, anon';
    execute 'grant execute on function public.gm_review_company_request(uuid,text,text) to authenticated';
  end if;

  if to_regprocedure('public.gm_touch_company_access(uuid)') is not null then
    execute 'revoke all on function public.gm_touch_company_access(uuid) from public, anon';
    execute 'grant execute on function public.gm_touch_company_access(uuid) to authenticated';
  end if;

  if to_regprocedure('public.gm_submit_company_request(jsonb)') is not null then
    execute 'revoke all on function public.gm_submit_company_request(jsonb) from public, anon, authenticated';
    execute 'grant execute on function public.gm_submit_company_request(jsonb) to service_role';
  end if;

  if to_regprocedure('public.gm_convert_company_request_internal(uuid,uuid,uuid,text,integer,integer,integer,date,date,text,text,text,text)') is not null then
    execute 'revoke all on function public.gm_convert_company_request_internal(uuid,uuid,uuid,text,integer,integer,integer,date,date,text,text,text,text) from public, anon, authenticated';
    execute 'grant execute on function public.gm_convert_company_request_internal(uuid,uuid,uuid,text,integer,integer,integer,date,date,text,text,text,text) to service_role';
  end if;

  if to_regprocedure('public.gm_convert_company_request_with_access_internal(uuid,uuid,uuid,text,text,integer,integer,integer,date,date,text,text,text,text)') is not null then
    execute 'revoke all on function public.gm_convert_company_request_with_access_internal(uuid,uuid,uuid,text,text,integer,integer,integer,date,date,text,text,text,text) from public, anon, authenticated';
    execute 'grant execute on function public.gm_convert_company_request_with_access_internal(uuid,uuid,uuid,text,text,integer,integer,integer,date,date,text,text,text,text) to service_role';
  end if;

  if to_regprocedure('public.gm_upsert_company_user_internal(uuid,uuid,uuid,text,text,text,text,text,text,text,jsonb,text,boolean,boolean,jsonb)') is not null then
    execute 'revoke all on function public.gm_upsert_company_user_internal(uuid,uuid,uuid,text,text,text,text,text,text,text,jsonb,text,boolean,boolean,jsonb) from public, anon, authenticated';
    execute 'grant execute on function public.gm_upsert_company_user_internal(uuid,uuid,uuid,text,text,text,text,text,text,text,jsonb,text,boolean,boolean,jsonb) to service_role';
  end if;

  if to_regprocedure('public.gm_set_company_user_active_internal(uuid,uuid,uuid,boolean)') is not null then
    execute 'revoke all on function public.gm_set_company_user_active_internal(uuid,uuid,uuid,boolean) from public, anon, authenticated';
    execute 'grant execute on function public.gm_set_company_user_active_internal(uuid,uuid,uuid,boolean) to service_role';
  end if;

  if to_regprocedure('public.gm_permanently_delete_company(uuid)') is not null then
    execute 'revoke all on function public.gm_permanently_delete_company(uuid) from public, anon';
    execute 'grant execute on function public.gm_permanently_delete_company(uuid) to authenticated';
  end if;

  if to_regprocedure('public.gm_current_platform_role()') is not null then
    execute 'revoke all on function public.gm_current_platform_role() from public, anon';
    execute 'grant execute on function public.gm_current_platform_role() to authenticated';
  end if;

  if to_regprocedure('public.gm_is_company_member(uuid)') is not null then
    execute 'revoke all on function public.gm_is_company_member(uuid) from public, anon';
    execute 'grant execute on function public.gm_is_company_member(uuid) to authenticated';
  end if;

  if to_regprocedure('public.gm_is_company_admin(uuid)') is not null then
    execute 'revoke all on function public.gm_is_company_admin(uuid) from public, anon';
    execute 'grant execute on function public.gm_is_company_admin(uuid) to authenticated';
  end if;

  if to_regprocedure('public.gm_is_platform_admin(uuid)') is not null then
    execute 'revoke all on function public.gm_is_platform_admin(uuid) from public, anon';
    execute 'grant execute on function public.gm_is_platform_admin(uuid) to authenticated';
  end if;

  if to_regprocedure('public.gm_member_can(uuid,text,text)') is not null then
    execute 'revoke all on function public.gm_member_can(uuid,text,text) from public, anon';
    execute 'grant execute on function public.gm_member_can(uuid,text,text) to authenticated';
  end if;

  if to_regprocedure('public.gm_storage_company_id(text)') is not null then
    execute 'revoke all on function public.gm_storage_company_id(text) from public, anon';
    execute 'grant execute on function public.gm_storage_company_id(text) to authenticated';
  end if;

  if to_regprocedure('public.gm_storage_module(text)') is not null then
    execute 'revoke all on function public.gm_storage_module(text) from public, anon';
    execute 'grant execute on function public.gm_storage_module(text) to authenticated';
  end if;

  if to_regprocedure('public.gm_consume_public_rate_limit(text,integer,integer)') is not null then
    execute 'revoke all on function public.gm_consume_public_rate_limit(text,integer,integer) from public, anon, authenticated';
    execute 'grant execute on function public.gm_consume_public_rate_limit(text,integer,integer) to service_role';
  end if;
end
$$;

commit;
