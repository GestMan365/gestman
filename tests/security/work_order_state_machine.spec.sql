\set ON_ERROR_STOP on

begin;

insert into auth.users(id, email, role, aud, created_at, updated_at)
values
  ('41000000-0000-4000-8000-000000000001', 'qa-order-admin@example.invalid', 'authenticated', 'authenticated', now(), now()),
  ('41000000-0000-4000-8000-000000000002', 'qa-order-outsider@example.invalid', 'authenticated', 'authenticated', now(), now());

insert into public.gm_companies(id, name, slug, created_by)
values
  ('42000000-0000-4000-8000-000000000001', 'QA Order Company A', 'qa-order-company-a', '41000000-0000-4000-8000-000000000001'),
  ('42000000-0000-4000-8000-000000000002', 'QA Order Company B', 'qa-order-company-b', '41000000-0000-4000-8000-000000000002');

insert into public.gm_company_members(company_id, user_id, role, access_username, access_profile, executor, active)
values
  ('42000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000001', 'administrator', 'qa.order.admin', 'admin', false, true),
  ('42000000-0000-4000-8000-000000000002', '41000000-0000-4000-8000-000000000002', 'administrator', 'qa.order.outsider', 'admin', false, true);

insert into public.gm_profiles(user_id, display_name, active, contact_email, job_title)
values
  ('41000000-0000-4000-8000-000000000001', 'Administrador O.S. QA', true, 'order-admin@example.invalid', 'Administrador'),
  ('41000000-0000-4000-8000-000000000002', 'Externo O.S. QA', true, 'order-outsider@example.invalid', 'Administrador');

insert into public.gm_tenant_state(company_id, state)
values (
  '42000000-0000-4000-8000-000000000001',
  '{"orders":[
    {"id":"qa-order-open","number":"QA-OS-001","status":"Aberta","executor":"","createdAt":1760000000000,"history":[]},
    {"id":"qa-order-legacy","number":"QA-OS-002","status":"Em execução","executor":"Técnico legado","startedAt":"2026-08-24T10:00:00Z","history":[]},
    {"id":"qa-order-cancel","number":"QA-OS-003","status":"Aberta","executor":"","history":[]}
  ]}'::jsonb
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000001', true);

select * from public.gm_transition_work_order(
  0, 'qa-order-open', 'Em execução',
  '{"executor":"Técnico QA","startedAt":1787565600000}'::jsonb,
  null, '43000000-0000-4000-8000-000000000001'
);

do $$
declare
  v_result record;
begin
  select * into v_result from public.gm_transition_work_order(
    0, 'qa-order-open', 'Em execução', '{}'::jsonb,
    null, '43000000-0000-4000-8000-000000000001'
  );
  if v_result.version <> 1 then raise exception 'QA_IDEMPOTENT_VERSION_CHANGED'; end if;
  if (select count(*) from public.gm_work_order_events where order_id = 'qa-order-open') <> 1 then
    raise exception 'QA_IDEMPOTENT_EVENT_DUPLICATED';
  end if;
end;
$$;

do $$
declare
  v_state jsonb;
begin
  select state into v_state from public.gm_tenant_state
  where company_id = '42000000-0000-4000-8000-000000000001';
  select jsonb_set(v_state, '{orders,0,status}', '"Cancelada"'::jsonb, true) into v_state;
  begin
    perform public.gm_save_tenant_state(1, v_state);
    raise exception 'QA_DIRECT_STATUS_WRITE_WAS_ACCEPTED';
  exception when others then
    if sqlerrm not like '%GM_ORDER_TRANSITION_RPC_REQUIRED%' then raise; end if;
  end;
end;
$$;

do $$
begin
  begin
    perform public.gm_transition_work_order(
      1, 'qa-order-open', 'Planejada', '{}'::jsonb,
      null, '43000000-0000-4000-8000-000000000002'
    );
    raise exception 'QA_INVALID_TRANSITION_WAS_ACCEPTED';
  exception when others then
    if sqlerrm not like '%GM_ORDER_TRANSITION_INVALID%' then raise; end if;
  end;
end;
$$;

do $$
begin
  begin
    perform public.gm_transition_work_order(
      1, 'qa-order-open', 'Pausada', '{}'::jsonb,
      null, '43000000-0000-4000-8000-000000000003'
    );
    raise exception 'QA_PAUSE_WITHOUT_REASON_WAS_ACCEPTED';
  exception when others then
    if sqlerrm not like '%GM_ORDER_TRANSITION_REASON_REQUIRED%' then raise; end if;
  end;
end;
$$;

select * from public.gm_transition_work_order(
  1, 'qa-order-open', 'Pausada', '{}'::jsonb,
  'Aguardando liberação operacional', '43000000-0000-4000-8000-000000000004'
);

select * from public.gm_transition_work_order(
  2, 'qa-order-open', 'Em execução', '{}'::jsonb,
  null, '43000000-0000-4000-8000-000000000005'
);

select * from public.gm_transition_work_order(
  3, 'qa-order-open', 'Concluída',
  '{"comment":"Serviço concluído e validado","finishedAt":1787569200000}'::jsonb,
  null, '43000000-0000-4000-8000-000000000006'
);

select * from public.gm_transition_work_order(
  4, 'qa-order-legacy', 'Concluída',
  '{"comment":"Registro legado concluído","finishedAt":"2026-08-24T11:00:00Z"}'::jsonb,
  null, '43000000-0000-4000-8000-000000000007'
);

select * from public.gm_transition_work_order(
  5, 'qa-order-cancel', 'Cancelada', '{}'::jsonb,
  'Cadastro aberto por engano', '43000000-0000-4000-8000-000000000008'
);

do $$
declare
  v_state jsonb;
  v_order jsonb;
begin
  select state into v_state from public.gm_tenant_state
  where company_id = '42000000-0000-4000-8000-000000000001';
  select item into v_order from jsonb_array_elements(v_state -> 'orders') item
  where item ->> 'id' = 'qa-order-open';
  if v_order ->> 'status' <> 'Concluída' then raise exception 'QA_ORDER_NOT_COMPLETED'; end if;
  if jsonb_array_length(v_order -> 'history') <> 4 then raise exception 'QA_ORDER_HISTORY_INCOMPLETE'; end if;
  if (select version from public.gm_tenant_state where company_id = '42000000-0000-4000-8000-000000000001') <> 6 then
    raise exception 'QA_FINAL_VERSION_INVALID';
  end if;
  if (select count(*) from public.gm_work_order_events) <> 6 then raise exception 'QA_EVENT_COUNT_INVALID'; end if;
end;
$$;

do $$
begin
  begin
    perform public.gm_transition_work_order(
      6, 'qa-order-open', 'Em execução', '{}'::jsonb,
      null, '43000000-0000-4000-8000-000000000009'
    );
    raise exception 'QA_TERMINAL_ORDER_WAS_RESUMED';
  exception when others then
    if sqlerrm not like '%GM_ORDER_TRANSITION_INVALID%' then raise; end if;
  end;
end;
$$;

do $$
begin
  begin
    insert into public.gm_work_order_events(
      company_id, request_id, order_id, from_status, to_status, action,
      state_version, actor_user_id
    ) values (
      '42000000-0000-4000-8000-000000000001',
      '43000000-0000-4000-8000-000000000010', 'qa-direct',
      'Aberta', 'Cancelada', 'CANCELLED', 6,
      '41000000-0000-4000-8000-000000000001'
    );
    raise exception 'QA_DIRECT_EVENT_WRITE_WAS_ACCEPTED';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000002', true);
do $$
begin
  if (select count(*) from public.gm_work_order_events) <> 0 then
    raise exception 'QA_CROSS_TENANT_EVENTS_VISIBLE';
  end if;
end;
$$;

rollback;

\echo 'work_order_state_machine.spec.sql: PASS'
