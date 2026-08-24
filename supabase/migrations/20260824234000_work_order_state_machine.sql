begin;

create or replace function public.gm_normalize_work_order_status(p_status text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case translate(lower(trim(coalesce(p_status, ''))),
    'áàâãäéèêëíìîïóòôõöúùûüç',
    'aaaaaeeeeiiiiooooouuuuc')
    when 'planejada' then 'Planejada'
    when 'planejado' then 'Planejada'
    when 'aberta' then 'Aberta'
    when 'aberto' then 'Aberta'
    when 'em execucao' then 'Em execução'
    when 'em andamento' then 'Em execução'
    when 'aguardando material' then 'Aguardando material'
    when 'pausada' then 'Pausada'
    when 'pausado' then 'Pausada'
    when 'concluida' then 'Concluída'
    when 'concluido' then 'Concluída'
    when 'finalizada' then 'Concluída'
    when 'finalizado' then 'Concluída'
    when 'cancelada' then 'Cancelada'
    when 'cancelado' then 'Cancelada'
    else null
  end;
$$;

create or replace function public.gm_work_order_transition_allowed(p_from text, p_to text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case public.gm_normalize_work_order_status(p_from)
    when 'Planejada' then public.gm_normalize_work_order_status(p_to) in ('Aberta', 'Em execução', 'Cancelada')
    when 'Aberta' then public.gm_normalize_work_order_status(p_to) in ('Em execução', 'Aguardando material', 'Cancelada')
    when 'Aguardando material' then public.gm_normalize_work_order_status(p_to) in ('Em execução', 'Pausada', 'Cancelada')
    when 'Em execução' then public.gm_normalize_work_order_status(p_to) in ('Pausada', 'Aguardando material', 'Concluída', 'Cancelada')
    when 'Pausada' then public.gm_normalize_work_order_status(p_to) in ('Em execução', 'Aguardando material', 'Cancelada')
    else false
  end;
$$;

create or replace function public.gm_work_order_time_ms(p_value jsonb)
returns numeric
language plpgsql
stable
set search_path = ''
as $$
declare
  v_text text;
begin
  if p_value is null or p_value = 'null'::jsonb then return null; end if;
  v_text := trim(both '"' from p_value::text);
  if v_text ~ '^[0-9]+([.][0-9]+)?$' then return v_text::numeric; end if;
  begin
    return extract(epoch from v_text::timestamptz) * 1000;
  exception when others then
    return null;
  end;
end;
$$;

create table if not exists public.gm_work_order_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  request_id uuid not null,
  order_id text not null,
  order_number text,
  from_status text not null,
  to_status text not null,
  action text not null,
  reason text,
  details jsonb not null default '{}'::jsonb,
  state_version bigint not null,
  actor_user_id uuid not null,
  occurred_at timestamptz not null default now(),
  constraint gm_work_order_events_company_fkey
    foreign key (company_id) references public.gm_companies(id) on delete cascade,
  constraint gm_work_order_events_actor_fkey
    foreign key (actor_user_id) references auth.users(id) on delete restrict,
  constraint gm_work_order_events_request_key unique (company_id, request_id),
  constraint gm_work_order_events_order_id_check check (length(trim(order_id)) between 1 and 160),
  constraint gm_work_order_events_status_check check (
    public.gm_normalize_work_order_status(from_status) is not null
    and public.gm_normalize_work_order_status(to_status) is not null
  )
);

create index if not exists gm_work_order_events_order_idx
  on public.gm_work_order_events(company_id, order_id, occurred_at desc);

alter table public.gm_work_order_events enable row level security;

drop policy if exists gm_work_order_events_company_select on public.gm_work_order_events;
create policy gm_work_order_events_company_select
on public.gm_work_order_events
for select
to authenticated
using (public.gm_is_company_member(company_id));

revoke all on table public.gm_work_order_events from public, anon, authenticated;
grant select on table public.gm_work_order_events to authenticated;

create or replace function public.gm_enforce_work_order_state_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_marker jsonb;
  v_order_id text;
  v_old_status text;
  v_new_status text;
begin
  begin
    v_marker := nullif(current_setting('gestman.order_transition', true), '')::jsonb;
  exception when others then
    v_marker := null;
  end;

  for v_order_id, v_old_status, v_new_status in
    select old_order ->> 'id',
           public.gm_normalize_work_order_status(old_order ->> 'status'),
           public.gm_normalize_work_order_status(new_order ->> 'status')
    from jsonb_array_elements(
      case when jsonb_typeof(old.state -> 'orders') = 'array' then old.state -> 'orders' else '[]'::jsonb end
    ) old_order
    join jsonb_array_elements(
      case when jsonb_typeof(new.state -> 'orders') = 'array' then new.state -> 'orders' else '[]'::jsonb end
    ) new_order on new_order ->> 'id' = old_order ->> 'id'
    where public.gm_normalize_work_order_status(old_order ->> 'status')
      is distinct from public.gm_normalize_work_order_status(new_order ->> 'status')
  loop
    if v_new_status is null then raise exception 'GM_ORDER_STATUS_INVALID'; end if;
    if v_marker is null
       or v_marker ->> 'order_id' <> v_order_id
       or v_marker ->> 'from_status' <> coalesce(v_old_status, '')
       or v_marker ->> 'to_status' <> v_new_status then
      raise exception 'GM_ORDER_TRANSITION_RPC_REQUIRED';
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists gm_tenant_state_enforce_work_order_transition on public.gm_tenant_state;
create trigger gm_tenant_state_enforce_work_order_transition
before update of state on public.gm_tenant_state
for each row execute function public.gm_enforce_work_order_state_transition();

create or replace function public.gm_transition_work_order(
  p_expected_version bigint,
  p_order_id text,
  p_to_status text,
  p_patch jsonb default '{}'::jsonb,
  p_reason text default null,
  p_request_id uuid default gen_random_uuid()
)
returns table (
  version bigint,
  updated_at timestamptz,
  order_id text,
  from_status text,
  to_status text,
  event_id uuid,
  order_data jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company_id uuid;
  v_current_version bigint;
  v_state jsonb;
  v_order jsonb;
  v_new_order jsonb;
  v_new_state jsonb;
  v_from_status text;
  v_to_status text;
  v_action text;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_event_id uuid := gen_random_uuid();
  v_event_time timestamptz := clock_timestamp();
  v_event_ms bigint;
  v_saved_version bigint;
  v_saved_at timestamptz;
  v_forbidden_key text;
  v_started_ms numeric;
  v_finished_ms numeric;
  v_pause_started_ms numeric;
  v_pause_hours numeric;
  v_actor_name text;
  v_existing public.gm_work_order_events%rowtype;
begin
  if auth.uid() is null then raise exception 'GM_AUTH_REQUIRED'; end if;
  if trim(coalesce(p_order_id, '')) = '' then raise exception 'GM_ORDER_REQUIRED'; end if;
  if p_request_id is null then raise exception 'GM_ORDER_TRANSITION_REQUEST_REQUIRED'; end if;
  if jsonb_typeof(coalesce(p_patch, '{}'::jsonb)) <> 'object' then raise exception 'GM_ORDER_PATCH_INVALID'; end if;

  select tenant.company_id, tenant.version, tenant.state
    into v_company_id, v_current_version, v_state
  from public.gm_tenant_state tenant
  where public.gm_is_company_member(tenant.company_id)
  order by tenant.updated_at desc
  limit 1
  for update;

  if v_company_id is null then raise exception 'GM_COMPANY_NOT_FOUND'; end if;
  if public.gm_access_level_rank(public.gm_member_module_level(v_company_id, 'orders'))
     < public.gm_access_level_rank('operate') then
    raise exception 'GM_PERMISSION_DENIED:orders';
  end if;

  select * into v_existing
  from public.gm_work_order_events event
  where event.company_id = v_company_id and event.request_id = p_request_id;
  if found then
    select item into v_order
    from jsonb_array_elements(
      case when jsonb_typeof(v_state -> 'orders') = 'array' then v_state -> 'orders' else '[]'::jsonb end
    ) item where item ->> 'id' = v_existing.order_id limit 1;
    return query select v_existing.state_version, v_existing.occurred_at, v_existing.order_id,
      v_existing.from_status, v_existing.to_status, v_existing.id, v_order;
    return;
  end if;

  if v_current_version <> p_expected_version then raise exception 'GM_STATE_CONFLICT'; end if;

  select item into v_order
  from jsonb_array_elements(
    case when jsonb_typeof(v_state -> 'orders') = 'array' then v_state -> 'orders' else '[]'::jsonb end
  ) item where item ->> 'id' = p_order_id limit 1;
  if v_order is null then raise exception 'GM_ORDER_NOT_FOUND'; end if;

  v_from_status := public.gm_normalize_work_order_status(v_order ->> 'status');
  v_to_status := public.gm_normalize_work_order_status(p_to_status);
  if v_from_status is null or v_to_status is null then raise exception 'GM_ORDER_STATUS_INVALID'; end if;
  if v_from_status = v_to_status then
    return query select v_current_version, now(), p_order_id, v_from_status, v_to_status, null::uuid, v_order;
    return;
  end if;
  if not public.gm_work_order_transition_allowed(v_from_status, v_to_status) then
    raise exception 'GM_ORDER_TRANSITION_INVALID:%:%', v_from_status, v_to_status;
  end if;
  if v_to_status in ('Pausada', 'Aguardando material', 'Cancelada') and v_reason is null then
    raise exception 'GM_ORDER_TRANSITION_REASON_REQUIRED';
  end if;

  select key into v_forbidden_key
  from jsonb_object_keys(coalesce(p_patch, '{}'::jsonb)) key
  where key <> all(array[
    'executor','executorId','executorIds','executorSnapshot','startedAt','finishedAt',
    'comment','solution','servicePerformed','workedHours','actualDurationHours','mttr',
    'pendingExecution','attachments','plan','type','maintenance','priority','scheduledAt',
    'durationDays','durationHours','executors','machineStopped','description'
  ]::text[])
  limit 1;
  if v_forbidden_key is not null then raise exception 'GM_ORDER_PATCH_FIELD_FORBIDDEN:%', v_forbidden_key; end if;

  v_event_ms := floor(extract(epoch from v_event_time) * 1000)::bigint;
  v_new_order := v_order || coalesce(p_patch, '{}'::jsonb);

  if v_to_status = 'Em execução' then
    if v_from_status = 'Pausada' then
      v_pause_started_ms := public.gm_work_order_time_ms(v_order -> 'pausedAt');
      if v_pause_started_ms is not null then
        v_pause_hours := (case when coalesce(v_order ->> 'pauseHours', '') ~ '^[0-9]+([.][0-9]+)?$' then (v_order ->> 'pauseHours')::numeric else 0 end)
          + greatest(0, v_event_ms - v_pause_started_ms) / 3600000.0;
        v_new_order := jsonb_set(v_new_order, '{pauseHours}', to_jsonb(round(v_pause_hours, 4)), true);
      end if;
      v_new_order := jsonb_set(v_new_order, '{pausedAt}', 'null'::jsonb, true);
      v_new_order := jsonb_set(v_new_order, '{pauseReason}', '""'::jsonb, true);
      v_action := 'RESUMED';
    else
      v_action := 'STARTED';
    end if;
    if coalesce(v_new_order ->> 'executor', '') = '' then raise exception 'GM_ORDER_EXECUTOR_REQUIRED'; end if;
    if public.gm_work_order_time_ms(v_new_order -> 'startedAt') is null then
      v_new_order := jsonb_set(v_new_order, '{startedAt}', to_jsonb(v_event_ms), true);
    end if;
    v_new_order := jsonb_set(v_new_order, '{waitingReason}', '""'::jsonb, true);
  elsif v_to_status = 'Pausada' then
    v_action := 'PAUSED';
    v_new_order := jsonb_set(v_new_order, '{pausedAt}', to_jsonb(v_event_ms), true);
    v_new_order := jsonb_set(v_new_order, '{pauseReason}', to_jsonb(v_reason), true);
  elsif v_to_status = 'Aguardando material' then
    v_action := 'WAITING_MATERIAL';
    v_new_order := jsonb_set(v_new_order, '{waitingReason}', to_jsonb(v_reason), true);
  elsif v_to_status = 'Concluída' then
    v_action := 'COMPLETED';
    if coalesce(v_new_order ->> 'executor', '') = '' then raise exception 'GM_ORDER_EXECUTOR_REQUIRED'; end if;
    if coalesce(nullif(v_new_order ->> 'comment', ''), nullif(v_new_order ->> 'solution', ''), '') = '' then
      raise exception 'GM_ORDER_COMPLETION_REQUIRED';
    end if;
    v_started_ms := public.gm_work_order_time_ms(v_new_order -> 'startedAt');
    if v_started_ms is null then raise exception 'GM_ORDER_START_REQUIRED'; end if;
    v_finished_ms := public.gm_work_order_time_ms(v_new_order -> 'finishedAt');
    if v_finished_ms is null then
      v_new_order := jsonb_set(v_new_order, '{finishedAt}', to_jsonb(v_event_ms), true);
      v_finished_ms := v_event_ms;
    end if;
    if v_finished_ms < v_started_ms then raise exception 'GM_ORDER_INTERVAL_INVALID'; end if;
  elsif v_to_status = 'Cancelada' then
    v_action := 'CANCELLED';
    v_pause_started_ms := public.gm_work_order_time_ms(v_order -> 'pausedAt');
    if v_from_status = 'Pausada' and v_pause_started_ms is not null then
      v_pause_hours := (case when coalesce(v_order ->> 'pauseHours', '') ~ '^[0-9]+([.][0-9]+)?$' then (v_order ->> 'pauseHours')::numeric else 0 end)
        + greatest(0, v_event_ms - v_pause_started_ms) / 3600000.0;
      v_new_order := jsonb_set(v_new_order, '{pauseHours}', to_jsonb(round(v_pause_hours, 4)), true);
      v_new_order := jsonb_set(v_new_order, '{pausedAt}', 'null'::jsonb, true);
    end if;
    if jsonb_typeof(v_new_order -> 'finishedAt') <> 'number' then
      v_new_order := jsonb_set(v_new_order, '{finishedAt}', to_jsonb(v_event_ms), true);
    end if;
  else
    v_action := 'OPENED';
  end if;

  select coalesce(profile.display_name, member.access_username, 'Usuário') into v_actor_name
  from public.gm_company_members member
  left join public.gm_profiles profile on profile.user_id = member.user_id
  where member.company_id = v_company_id and member.user_id = auth.uid()
  limit 1;

  v_new_order := jsonb_set(v_new_order, '{status}', to_jsonb(v_to_status), true);
  v_new_order := jsonb_set(v_new_order, '{updatedAt}', to_jsonb(v_event_ms), true);
  v_new_order := jsonb_set(v_new_order, '{history}',
    (case when jsonb_typeof(v_order -> 'history') = 'array' then v_order -> 'history' else '[]'::jsonb end)
    || jsonb_build_array(jsonb_build_object(
      'id', v_event_id, 'eventId', v_event_id, 'date', v_event_ms, 'at', v_event_ms,
      'type', 'Status', 'action', v_action,
      'text', concat(v_from_status, ' → ', v_to_status,
        case when v_reason is not null then concat(' · ', v_reason) else '' end),
      'owner', coalesce(v_actor_name, 'Usuário'), 'immutable', true
    )), true);

  select jsonb_set(v_state, '{orders}', jsonb_agg(
    case when item ->> 'id' = p_order_id then v_new_order else item end order by position
  ), true)
  into v_new_state
  from jsonb_array_elements(v_state -> 'orders') with ordinality as orders(item, position);

  perform set_config('gestman.order_transition', jsonb_build_object(
    'order_id', p_order_id, 'from_status', v_from_status, 'to_status', v_to_status
  )::text, true);

  select saved.version, saved.updated_at into v_saved_version, v_saved_at
  from public.gm_save_tenant_state(p_expected_version, v_new_state) saved;

  insert into public.gm_work_order_events(
    id, company_id, request_id, order_id, order_number, from_status, to_status,
    action, reason, details, state_version, actor_user_id, occurred_at
  ) values (
    v_event_id, v_company_id, p_request_id, p_order_id, v_order ->> 'number',
    v_from_status, v_to_status, v_action, v_reason,
    jsonb_build_object('executor', coalesce(v_new_order ->> 'executor', '')),
    v_saved_version, auth.uid(), v_event_time
  );

  insert into public.gm_audit_log(company_id, user_id, action, entity, entity_id, metadata)
  values (v_company_id, auth.uid(), 'work_order.transition', 'work_order', p_order_id,
    jsonb_build_object('from_status', v_from_status, 'to_status', v_to_status,
      'event_id', v_event_id, 'reason', v_reason, 'version', v_saved_version));

  return query select v_saved_version, v_saved_at, p_order_id, v_from_status,
    v_to_status, v_event_id, v_new_order;
end;
$$;

revoke all on function public.gm_normalize_work_order_status(text) from public, anon, authenticated;
revoke all on function public.gm_work_order_transition_allowed(text, text) from public, anon, authenticated;
revoke all on function public.gm_work_order_time_ms(jsonb) from public, anon, authenticated;
revoke all on function public.gm_transition_work_order(bigint, text, text, jsonb, text, uuid) from public, anon;
grant execute on function public.gm_transition_work_order(bigint, text, text, jsonb, text, uuid) to authenticated;

comment on table public.gm_work_order_events is
  'Histórico imutável e tenant-scoped das transições de estado de Ordens de Serviço.';

commit;
