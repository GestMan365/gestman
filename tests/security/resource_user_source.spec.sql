\set ON_ERROR_STOP on

begin;

insert into auth.users(id, email, role, aud, created_at, updated_at)
values
  ('10000000-0000-4000-8000-000000000001', 'qa-resource-admin@example.invalid', 'authenticated', 'authenticated', now(), now()),
  ('10000000-0000-4000-8000-000000000002', 'qa-resource-user-1@example.invalid', 'authenticated', 'authenticated', now(), now()),
  ('10000000-0000-4000-8000-000000000003', 'qa-resource-user-2@example.invalid', 'authenticated', 'authenticated', now(), now()),
  ('20000000-0000-4000-8000-000000000001', 'qa-resource-outsider@example.invalid', 'authenticated', 'authenticated', now(), now());

insert into public.gm_companies(id, name, slug, created_by)
values
  ('30000000-0000-4000-8000-000000000001', 'QA Resource Company A', 'qa-resource-company-a', '10000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000002', 'QA Resource Company B', 'qa-resource-company-b', '20000000-0000-4000-8000-000000000001');

insert into public.gm_company_members(company_id, user_id, role, access_username, access_profile, executor, active)
values
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'administrator', 'qa.admin', 'admin', false, true),
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'technician', 'qa.technician.1', 'technician', true, true),
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'technician', 'qa.technician.2', 'technician', true, true),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'administrator', 'qa.outsider', 'admin', false, true);

insert into public.gm_profiles(user_id, display_name, active, contact_email, job_title)
values
  ('10000000-0000-4000-8000-000000000001', 'Administrador QA', true, 'admin@example.invalid', 'Administrador'),
  ('10000000-0000-4000-8000-000000000002', 'Técnico QA 1', true, 'tech1@example.invalid', 'Técnico mecânico'),
  ('10000000-0000-4000-8000-000000000003', 'Técnico QA 2', true, 'tech2@example.invalid', 'Técnico elétrico'),
  ('20000000-0000-4000-8000-000000000001', 'Usuário Externo QA', true, 'outsider@example.invalid', 'Administrador');

insert into public.gm_tenant_state(company_id, state)
values (
  '30000000-0000-4000-8000-000000000001',
  '{"resources":[{"id":"qa-resource-1","name":"Técnico QA 1","resourceType":"Usuário interno","userId":"10000000-0000-4000-8000-000000000002"},{"id":"qa-resource-2","name":"Técnico QA 2","resourceType":"Usuário interno","userId":""}],"orders":[{"id":"qa-order-history","executorSnapshot":{"name":"Técnico QA 1"}}]}'::jsonb
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);

select * from public.gm_save_resource_user_link(
  0,
  '{"resources":[{"id":"qa-resource-1","name":"Técnico QA 1","resourceType":"Usuário interno","userId":"10000000-0000-4000-8000-000000000002"},{"id":"qa-resource-2","name":"Técnico QA 2","resourceType":"Usuário interno","userId":""}],"orders":[{"id":"qa-order-history","executorSnapshot":{"name":"Técnico QA 1"}}]}'::jsonb,
  'qa-resource-1',
  '10000000-0000-4000-8000-000000000002'
);

do $$
begin
  if (select count(*) from public.gm_resource_user_links) <> 1 then
    raise exception 'QA_LINK_NOT_CREATED';
  end if;
  if (select version from public.gm_tenant_state where company_id = '30000000-0000-4000-8000-000000000001') <> 1 then
    raise exception 'QA_STATE_VERSION_NOT_INCREMENTED';
  end if;
  if (select resource_id from public.gm_list_operational_users() where user_id = '10000000-0000-4000-8000-000000000002') <> 'qa-resource-1' then
    raise exception 'QA_DIRECTORY_LINK_MISSING';
  end if;
end;
$$;

do $$
begin
  begin
    perform public.gm_save_resource_user_link(
      1,
      '{"resources":[{"id":"qa-resource-1","resourceType":"Usuário interno","userId":"10000000-0000-4000-8000-000000000002"},{"id":"qa-resource-2","resourceType":"Usuário interno","userId":"10000000-0000-4000-8000-000000000002"}]}'::jsonb,
      'qa-resource-2',
      '10000000-0000-4000-8000-000000000002'
    );
    raise exception 'QA_DUPLICATE_LINK_WAS_ACCEPTED';
  exception when others then
    if sqlerrm not like '%GM_RESOURCE_USER_ALREADY_LINKED%' then raise; end if;
  end;
end;
$$;

do $$
begin
  begin
    insert into public.gm_resource_user_links(company_id, resource_id, user_id)
    values ('30000000-0000-4000-8000-000000000001', 'qa-direct-write', '10000000-0000-4000-8000-000000000003');
    raise exception 'QA_DIRECT_WRITE_WAS_ACCEPTED';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
update public.gm_company_members
set active = false
where company_id = '30000000-0000-4000-8000-000000000001'
  and user_id = '10000000-0000-4000-8000-000000000003';
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);

do $$
begin
  begin
    perform public.gm_save_resource_user_link(
      1,
      '{"resources":[{"id":"qa-resource-1","resourceType":"Usuário interno","userId":"10000000-0000-4000-8000-000000000002"},{"id":"qa-resource-2","resourceType":"Usuário interno","userId":"10000000-0000-4000-8000-000000000003"}]}'::jsonb,
      'qa-resource-2',
      '10000000-0000-4000-8000-000000000003'
    );
    raise exception 'QA_INACTIVE_USER_WAS_LINKED';
  exception when others then
    if sqlerrm not like '%GM_RESOURCE_USER_NOT_ACTIVE%' then raise; end if;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000001', true);
do $$
begin
  if (select count(*) from public.gm_resource_user_links) <> 0 then
    raise exception 'QA_CROSS_TENANT_LINK_VISIBLE';
  end if;
end;
$$;

reset role;
delete from auth.users where id = '10000000-0000-4000-8000-000000000002';

do $$
declare
  v_state jsonb;
begin
  select state into v_state from public.gm_tenant_state
  where company_id = '30000000-0000-4000-8000-000000000001';
  if jsonb_array_length(v_state -> 'resources') <> 2 then
    raise exception 'QA_RESOURCE_HISTORY_WAS_DELETED';
  end if;
  if coalesce(v_state #>> '{resources,0,userId}', 'missing') <> '' then
    raise exception 'QA_DELETED_USER_LINK_NOT_CLEARED';
  end if;
  if v_state #>> '{orders,0,executorSnapshot,name}' <> 'Técnico QA 1' then
    raise exception 'QA_ORDER_SNAPSHOT_WAS_CHANGED';
  end if;
end;
$$;

rollback;

\echo 'resource_user_source.spec.sql: PASS'
