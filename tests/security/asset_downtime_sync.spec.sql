\set ON_ERROR_STOP on

begin;

insert into auth.users(id, email, role, aud, created_at, updated_at)
values
  ('51000000-0000-4000-8000-000000000001', 'qa-downtime-admin@example.invalid', 'authenticated', 'authenticated', now(), now()),
  ('51000000-0000-4000-8000-000000000002', 'qa-downtime-outsider@example.invalid', 'authenticated', 'authenticated', now(), now());

insert into public.gm_companies(id, name, slug, created_by)
values
  ('52000000-0000-4000-8000-000000000001', 'QA Downtime Company A', 'qa-downtime-company-a', '51000000-0000-4000-8000-000000000001'),
  ('52000000-0000-4000-8000-000000000002', 'QA Downtime Company B', 'qa-downtime-company-b', '51000000-0000-4000-8000-000000000002');

insert into public.gm_company_members(company_id, user_id, role, access_username, access_profile, executor, active)
values
  ('52000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000001', 'administrator', 'qa.downtime.admin', 'admin', false, true),
  ('52000000-0000-4000-8000-000000000002', '51000000-0000-4000-8000-000000000002', 'administrator', 'qa.downtime.outsider', 'admin', false, true);

insert into public.gm_profiles(user_id, display_name, active, contact_email, job_title)
values
  ('51000000-0000-4000-8000-000000000001', 'Administrador Paradas QA', true, 'downtime-admin@example.invalid', 'Administrador'),
  ('51000000-0000-4000-8000-000000000002', 'Externo Paradas QA', true, 'downtime-outsider@example.invalid', 'Administrador');

insert into public.gm_tenant_state(company_id, state)
values (
  '52000000-0000-4000-8000-000000000001',
  '{"assets":[
    {"id":"qa-asset-1","code":"QA-ATV-001","name":"Equipamento QA","status":"Operando","statusHistory":[]}
  ],"orders":[
    {"id":"qa-order-1","number":"QA-OS-001","assetId":"qa-asset-1","status":"Em execução","history":[]}
  ],"downtimes":[]}'::jsonb
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000001', true);

select * from public.gm_transition_asset_downtime(
  0, 'OPENED', 'qa-downtime-1',
  '{"assetId":"qa-asset-1","orderId":"qa-order-1","reason":"Falha mecânica","startAt":"2026-08-24T10:00:00Z"}'::jsonb,
  '53000000-0000-4000-8000-000000000001'
);

do $$
declare
  v_result record;
  v_state jsonb;
  v_asset jsonb;
  v_downtime jsonb;
begin
  select * into v_result from public.gm_transition_asset_downtime(
    0, 'OPENED', 'qa-downtime-1', '{}'::jsonb,
    '53000000-0000-4000-8000-000000000001'
  );
  if v_result.version <> 1 then raise exception 'QA_IDEMPOTENT_VERSION_CHANGED'; end if;
  if (select count(*) from public.gm_asset_downtime_events where downtime_id = 'qa-downtime-1') <> 1 then
    raise exception 'QA_IDEMPOTENT_EVENT_DUPLICATED';
  end if;

  select state into v_state from public.gm_tenant_state
  where company_id = '52000000-0000-4000-8000-000000000001';
  select item into v_asset from jsonb_array_elements(v_state -> 'assets') item
  where item ->> 'id' = 'qa-asset-1';
  select item into v_downtime from jsonb_array_elements(v_state -> 'downtimes') item
  where item ->> 'id' = 'qa-downtime-1';
  if v_asset ->> 'status' <> 'Parado' then raise exception 'QA_ASSET_NOT_STOPPED'; end if;
  if v_asset ->> 'activeDowntimeId' <> 'qa-downtime-1' then raise exception 'QA_ACTIVE_DOWNTIME_NOT_LINKED'; end if;
  if v_downtime ->> 'orderId' <> 'qa-order-1' then raise exception 'QA_ORDER_LINK_NOT_PRESERVED'; end if;
  if v_downtime ->> 'previousAssetStatus' <> 'Operando' then raise exception 'QA_PREVIOUS_ASSET_STATUS_NOT_SAVED'; end if;
end;
$$;

do $$
begin
  begin
    perform public.gm_transition_asset_downtime(
      1, 'OPENED', 'qa-downtime-2',
      '{"assetId":"qa-asset-1","reason":"Segunda falha","startAt":"2026-08-24T10:30:00Z"}'::jsonb,
      '53000000-0000-4000-8000-000000000002'
    );
    raise exception 'QA_DUPLICATE_ACTIVE_DOWNTIME_WAS_ACCEPTED';
  exception when others then
    if sqlerrm not like '%GM_ASSET_ACTIVE_DOWNTIME_EXISTS%' then raise; end if;
  end;
end;
$$;

do $$
declare
  v_state jsonb;
begin
  select state into v_state from public.gm_tenant_state
  where company_id = '52000000-0000-4000-8000-000000000001';
  select jsonb_set(v_state, '{downtimes,0,endAt}', '"2026-08-24T11:00:00Z"'::jsonb, true) into v_state;
  begin
    perform public.gm_save_tenant_state(1, v_state);
    raise exception 'QA_DIRECT_DOWNTIME_WRITE_WAS_ACCEPTED';
  exception when others then
    if sqlerrm not like '%GM_DOWNTIME_TRANSITION_RPC_REQUIRED%' then raise; end if;
  end;
end;
$$;

do $$
declare
  v_state jsonb;
begin
  select state into v_state from public.gm_tenant_state
  where company_id = '52000000-0000-4000-8000-000000000001';
  select jsonb_set(v_state, '{assets,0,status}', '"Operando"'::jsonb, true) into v_state;
  begin
    perform public.gm_save_tenant_state(1, v_state);
    raise exception 'QA_ACTIVE_ASSET_STATUS_WAS_CHANGED';
  exception when others then
    if sqlerrm not like '%GM_ASSET_ACTIVE_DOWNTIME_STATUS%' then raise; end if;
  end;
end;
$$;

select * from public.gm_transition_asset_downtime(
  1, 'CLOSED', 'qa-downtime-1',
  '{"endAt":"2026-08-24T11:00:00Z","cause":"Rolamento substituído"}'::jsonb,
  '53000000-0000-4000-8000-000000000003'
);

do $$
declare
  v_state jsonb;
  v_asset jsonb;
  v_downtime jsonb;
begin
  select state into v_state from public.gm_tenant_state
  where company_id = '52000000-0000-4000-8000-000000000001';
  select item into v_asset from jsonb_array_elements(v_state -> 'assets') item
  where item ->> 'id' = 'qa-asset-1';
  select item into v_downtime from jsonb_array_elements(v_state -> 'downtimes') item
  where item ->> 'id' = 'qa-downtime-1';
  if v_asset ->> 'status' <> 'Operando' then raise exception 'QA_ASSET_STATUS_NOT_RESTORED'; end if;
  if v_asset ? 'activeDowntimeId' then raise exception 'QA_ACTIVE_DOWNTIME_LINK_NOT_REMOVED'; end if;
  if v_downtime ->> 'status' <> 'Encerrada' then raise exception 'QA_DOWNTIME_NOT_CLOSED'; end if;
  if (v_downtime ->> 'durationMs')::bigint <> 3600000 then raise exception 'QA_DURATION_MS_INVALID'; end if;
  if (v_downtime ->> 'durationHours')::numeric <> 1 then raise exception 'QA_DURATION_HOURS_INVALID'; end if;
  if v_downtime ->> 'orderId' <> 'qa-order-1' then raise exception 'QA_CLOSED_ORDER_LINK_LOST'; end if;
  if jsonb_array_length(v_downtime -> 'history') <> 2 then raise exception 'QA_DOWNTIME_HISTORY_INCOMPLETE'; end if;
  if (select count(*) from public.gm_asset_downtime_events) <> 2 then raise exception 'QA_EVENT_COUNT_INVALID'; end if;
end;
$$;

do $$
begin
  begin
    perform public.gm_transition_asset_downtime(
      2, 'CLOSED', 'qa-downtime-1', '{"cause":"Tentativa repetida"}'::jsonb,
      '53000000-0000-4000-8000-000000000004'
    );
    raise exception 'QA_TERMINAL_DOWNTIME_WAS_CLOSED_AGAIN';
  exception when others then
    if sqlerrm not like '%GM_DOWNTIME_NOT_ACTIVE%' then raise; end if;
  end;
end;
$$;

select * from public.gm_transition_asset_downtime(
  2, 'OPENED', 'qa-downtime-cancel',
  '{"assetId":"qa-asset-1","reason":"Alarme falso","startAt":"2026-08-24T12:00:00Z"}'::jsonb,
  '53000000-0000-4000-8000-000000000005'
);

do $$
begin
  begin
    perform public.gm_transition_asset_downtime(
      3, 'CANCELLED', 'qa-downtime-cancel', '{}'::jsonb,
      '53000000-0000-4000-8000-000000000006'
    );
    raise exception 'QA_CANCEL_WITHOUT_REASON_WAS_ACCEPTED';
  exception when others then
    if sqlerrm not like '%GM_DOWNTIME_CANCEL_REASON_REQUIRED%' then raise; end if;
  end;
end;
$$;

select * from public.gm_transition_asset_downtime(
  3, 'CANCELLED', 'qa-downtime-cancel',
  '{"endAt":"2026-08-24T12:10:00Z","cancelReason":"Registro duplicado"}'::jsonb,
  '53000000-0000-4000-8000-000000000007'
);

do $$
begin
  begin
    insert into public.gm_asset_downtime_events(
      company_id, request_id, downtime_id, asset_id, action, to_status,
      state_version, actor_user_id
    ) values (
      '52000000-0000-4000-8000-000000000001',
      '53000000-0000-4000-8000-000000000008', 'qa-direct', 'qa-asset-1',
      'OPENED', 'Ativa', 4, '51000000-0000-4000-8000-000000000001'
    );
    raise exception 'QA_DIRECT_EVENT_WRITE_WAS_ACCEPTED';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000002', true);
do $$
begin
  if (select count(*) from public.gm_asset_downtime_events) <> 0 then
    raise exception 'QA_CROSS_TENANT_EVENTS_VISIBLE';
  end if;
end;
$$;

rollback;

\echo 'asset_downtime_sync.spec.sql: PASS'
