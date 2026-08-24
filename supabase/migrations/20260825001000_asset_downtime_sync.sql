begin;

create or replace function public.gm_normalize_downtime_status(p_status text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case translate(lower(trim(coalesce(p_status, ''))),
    'áàâãäéèêëíìîïóòôõöúùûüç',
    'aaaaaeeeeiiiiooooouuuuc')
    when 'ativa' then 'Ativa'
    when 'ativo' then 'Ativa'
    when 'encerrada' then 'Encerrada'
    when 'encerrado' then 'Encerrada'
    when 'cancelada' then 'Cancelada'
    when 'cancelado' then 'Cancelada'
    else null
  end;
$$;

create or replace function public.gm_downtime_time_ms(p_value jsonb)
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

create table if not exists public.gm_asset_downtime_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  request_id uuid not null,
  downtime_id text not null,
  asset_id text not null,
  order_id text,
  action text not null,
  from_status text,
  to_status text not null,
  reason text,
  duration_ms bigint,
  details jsonb not null default '{}'::jsonb,
  state_version bigint not null,
  actor_user_id uuid not null,
  occurred_at timestamptz not null default now(),
  constraint gm_asset_downtime_events_company_fkey
    foreign key (company_id) references public.gm_companies(id) on delete cascade,
  constraint gm_asset_downtime_events_actor_fkey
    foreign key (actor_user_id) references auth.users(id) on delete restrict,
  constraint gm_asset_downtime_events_request_key unique (company_id, request_id),
  constraint gm_asset_downtime_events_id_check check (
    length(trim(downtime_id)) between 1 and 160
    and length(trim(asset_id)) between 1 and 160
  ),
  constraint gm_asset_downtime_events_action_check check (action in ('OPENED', 'CLOSED', 'CANCELLED')),
  constraint gm_asset_downtime_events_status_check check (
    public.gm_normalize_downtime_status(to_status) is not null
    and (from_status is null or public.gm_normalize_downtime_status(from_status) is not null)
  ),
  constraint gm_asset_downtime_events_duration_check check (duration_ms is null or duration_ms >= 0)
);

create index if not exists gm_asset_downtime_events_asset_idx
  on public.gm_asset_downtime_events(company_id, asset_id, occurred_at desc);

create index if not exists gm_asset_downtime_events_downtime_idx
  on public.gm_asset_downtime_events(company_id, downtime_id, occurred_at desc);

alter table public.gm_asset_downtime_events enable row level security;

drop policy if exists gm_asset_downtime_events_company_select on public.gm_asset_downtime_events;
create policy gm_asset_downtime_events_company_select
on public.gm_asset_downtime_events
for select
to authenticated
using (public.gm_is_company_member(company_id));

revoke all on table public.gm_asset_downtime_events from public, anon, authenticated;
grant select on table public.gm_asset_downtime_events to authenticated;

create or replace function public.gm_enforce_asset_downtime_sync()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_marker jsonb;
  v_old jsonb;
  v_new jsonb;
  v_asset jsonb;
  v_downtime_id text;
  v_asset_id text;
  v_from_status text;
  v_to_status text;
  v_is_demo boolean;
  v_can_manage boolean;
begin
  begin
    v_marker := nullif(current_setting('gestman.downtime_transition', true), '')::jsonb;
  exception when others then
    v_marker := null;
  end;

  v_can_manage := public.gm_access_level_rank(public.gm_member_module_level(old.company_id, 'orders'))
    >= public.gm_access_level_rank('manage');

  for v_old, v_new in
    select old_item, new_item
    from jsonb_array_elements(
      case when jsonb_typeof(old.state -> 'downtimes') = 'array' then old.state -> 'downtimes' else '[]'::jsonb end
    ) old_item
    join jsonb_array_elements(
      case when jsonb_typeof(new.state -> 'downtimes') = 'array' then new.state -> 'downtimes' else '[]'::jsonb end
    ) new_item on new_item ->> 'id' = old_item ->> 'id'
    where public.gm_normalize_downtime_status(old_item ->> 'status')
            is distinct from public.gm_normalize_downtime_status(new_item ->> 'status')
       or coalesce(old_item ->> 'assetId', '') is distinct from coalesce(new_item ->> 'assetId', '')
       or coalesce(old_item ->> 'startAt', '') is distinct from coalesce(new_item ->> 'startAt', '')
       or coalesce(old_item ->> 'endAt', '') is distinct from coalesce(new_item ->> 'endAt', '')
       or coalesce(old_item ->> 'durationMs', '') is distinct from coalesce(new_item ->> 'durationMs', '')
       or coalesce(old_item ->> 'durationHours', '') is distinct from coalesce(new_item ->> 'durationHours', '')
       or coalesce(old_item ->> 'closedAt', '') is distinct from coalesce(new_item ->> 'closedAt', '')
  loop
    v_downtime_id := v_old ->> 'id';
    v_from_status := public.gm_normalize_downtime_status(v_old ->> 'status');
    v_to_status := public.gm_normalize_downtime_status(v_new ->> 'status');
    if v_marker is null
       or v_marker ->> 'downtime_id' <> v_downtime_id
       or v_marker ->> 'from_status' <> coalesce(v_from_status, '')
       or v_marker ->> 'to_status' <> coalesce(v_to_status, '') then
      raise exception 'GM_DOWNTIME_TRANSITION_RPC_REQUIRED';
    end if;
  end loop;

  for v_new in
    select new_item
    from jsonb_array_elements(
      case when jsonb_typeof(new.state -> 'downtimes') = 'array' then new.state -> 'downtimes' else '[]'::jsonb end
    ) new_item
    where not exists (
      select 1 from jsonb_array_elements(
        case when jsonb_typeof(old.state -> 'downtimes') = 'array' then old.state -> 'downtimes' else '[]'::jsonb end
      ) old_item where old_item ->> 'id' = new_item ->> 'id'
    )
  loop
    v_downtime_id := v_new ->> 'id';
    v_asset_id := v_new ->> 'assetId';
    v_to_status := public.gm_normalize_downtime_status(v_new ->> 'status');
    v_is_demo := coalesce(v_new ->> 'demoBatchId', '') <> ''
      or (v_new ->> 'source' = 'Carga operacional inicial — Nadir Suzano'
          and coalesce(v_new ->> 'version', '') <> '');
    if not (v_marker is not null
            and v_marker ->> 'action' = 'OPENED'
            and v_marker ->> 'downtime_id' = v_downtime_id)
       and not (v_is_demo and v_can_manage) then
      raise exception 'GM_DOWNTIME_TRANSITION_RPC_REQUIRED';
    end if;
    if v_to_status is null then raise exception 'GM_DOWNTIME_STATUS_INVALID'; end if;
    if v_to_status = 'Ativa' then
      if (select count(*) from jsonb_array_elements(new.state -> 'downtimes') item
          where item ->> 'assetId' = v_asset_id
            and public.gm_normalize_downtime_status(item ->> 'status') = 'Ativa') <> 1 then
        raise exception 'GM_ASSET_ACTIVE_DOWNTIME_EXISTS';
      end if;
      select item into v_asset from jsonb_array_elements(
        case when jsonb_typeof(new.state -> 'assets') = 'array' then new.state -> 'assets' else '[]'::jsonb end
      ) item where item ->> 'id' = v_asset_id limit 1;
      if v_asset is null then raise exception 'GM_DOWNTIME_ASSET_NOT_FOUND'; end if;
      if coalesce(v_asset ->> 'status', '') <> 'Parado' then raise exception 'GM_ASSET_DOWNTIME_STATUS_MISMATCH'; end if;
    end if;
  end loop;

  for v_old in
    select old_item
    from jsonb_array_elements(
      case when jsonb_typeof(old.state -> 'downtimes') = 'array' then old.state -> 'downtimes' else '[]'::jsonb end
    ) old_item
    where not exists (
      select 1 from jsonb_array_elements(
        case when jsonb_typeof(new.state -> 'downtimes') = 'array' then new.state -> 'downtimes' else '[]'::jsonb end
      ) new_item where new_item ->> 'id' = old_item ->> 'id'
    )
  loop
    v_is_demo := coalesce(v_old ->> 'demoBatchId', '') <> ''
      or (v_old ->> 'source' = 'Carga operacional inicial — Nadir Suzano'
          and coalesce(v_old ->> 'version', '') <> '');
    if not (v_is_demo and v_can_manage) then raise exception 'GM_DOWNTIME_HISTORY_IMMUTABLE'; end if;
  end loop;

  for v_asset in
    select new_asset
    from jsonb_array_elements(
      case when jsonb_typeof(old.state -> 'assets') = 'array' then old.state -> 'assets' else '[]'::jsonb end
    ) old_asset
    join jsonb_array_elements(
      case when jsonb_typeof(new.state -> 'assets') = 'array' then new.state -> 'assets' else '[]'::jsonb end
    ) new_asset on new_asset ->> 'id' = old_asset ->> 'id'
    where coalesce(old_asset ->> 'status', '') is distinct from coalesce(new_asset ->> 'status', '')
  loop
    if coalesce(v_asset ->> 'status', '') <> 'Parado'
       and exists (
         select 1 from jsonb_array_elements(
           case when jsonb_typeof(new.state -> 'downtimes') = 'array' then new.state -> 'downtimes' else '[]'::jsonb end
         ) item where item ->> 'assetId' = v_asset ->> 'id'
           and public.gm_normalize_downtime_status(item ->> 'status') = 'Ativa'
       ) then
      raise exception 'GM_ASSET_ACTIVE_DOWNTIME_STATUS';
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists gm_tenant_state_enforce_asset_downtime_sync on public.gm_tenant_state;
create trigger gm_tenant_state_enforce_asset_downtime_sync
before update of state on public.gm_tenant_state
for each row execute function public.gm_enforce_asset_downtime_sync();

create or replace function public.gm_transition_asset_downtime(
  p_expected_version bigint,
  p_action text,
  p_downtime_id text,
  p_payload jsonb default '{}'::jsonb,
  p_request_id uuid default gen_random_uuid()
)
returns table (
  version bigint,
  updated_at timestamptz,
  downtime_id text,
  action text,
  event_id uuid,
  downtime_data jsonb,
  asset_data jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company_id uuid;
  v_current_version bigint;
  v_state jsonb;
  v_action text := upper(trim(coalesce(p_action, '')));
  v_downtime jsonb;
  v_new_downtime jsonb;
  v_asset jsonb;
  v_new_asset jsonb;
  v_order jsonb;
  v_new_state jsonb;
  v_from_status text;
  v_to_status text;
  v_asset_id text;
  v_order_id text;
  v_reason text;
  v_actor_name text;
  v_event_id uuid := gen_random_uuid();
  v_event_time timestamptz := clock_timestamp();
  v_event_ms bigint;
  v_start_ms numeric;
  v_end_ms numeric;
  v_duration_ms bigint;
  v_previous_asset_status text;
  v_other_active_id text;
  v_saved_version bigint;
  v_saved_at timestamptz;
  v_forbidden_key text;
  v_existing public.gm_asset_downtime_events%rowtype;
begin
  if auth.uid() is null then raise exception 'GM_AUTH_REQUIRED'; end if;
  if v_action not in ('OPENED', 'CLOSED', 'CANCELLED') then raise exception 'GM_DOWNTIME_ACTION_INVALID'; end if;
  if trim(coalesce(p_downtime_id, '')) = '' then raise exception 'GM_DOWNTIME_REQUIRED'; end if;
  if p_request_id is null then raise exception 'GM_DOWNTIME_REQUEST_REQUIRED'; end if;
  if jsonb_typeof(coalesce(p_payload, '{}'::jsonb)) <> 'object' then raise exception 'GM_DOWNTIME_PAYLOAD_INVALID'; end if;

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
  if v_action = 'CANCELLED' and public.gm_access_level_rank(public.gm_member_module_level(v_company_id, 'orders'))
     < public.gm_access_level_rank('manage') then
    raise exception 'GM_PERMISSION_DENIED:orders';
  end if;

  select * into v_existing from public.gm_asset_downtime_events event
  where event.company_id = v_company_id and event.request_id = p_request_id;
  if found then
    select item into v_downtime from jsonb_array_elements(
      case when jsonb_typeof(v_state -> 'downtimes') = 'array' then v_state -> 'downtimes' else '[]'::jsonb end
    ) item where item ->> 'id' = v_existing.downtime_id limit 1;
    select item into v_asset from jsonb_array_elements(
      case when jsonb_typeof(v_state -> 'assets') = 'array' then v_state -> 'assets' else '[]'::jsonb end
    ) item where item ->> 'id' = v_existing.asset_id limit 1;
    return query select v_existing.state_version, v_existing.occurred_at, v_existing.downtime_id,
      v_existing.action, v_existing.id, v_downtime, v_asset;
    return;
  end if;

  if v_current_version <> p_expected_version then raise exception 'GM_STATE_CONFLICT'; end if;
  v_event_ms := floor(extract(epoch from v_event_time) * 1000)::bigint;

  if v_action = 'OPENED' then
    select key into v_forbidden_key from jsonb_object_keys(coalesce(p_payload, '{}'::jsonb)) key
    where key <> all(array[
      'assetId','orderId','reason','description','type','area','areaId','impact','owner',
      'productionAffected','note','evidence','startAt','demoBatchId','source','version'
    ]::text[]) limit 1;
    if v_forbidden_key is not null then raise exception 'GM_DOWNTIME_PAYLOAD_FIELD_FORBIDDEN:%', v_forbidden_key; end if;
    if exists (select 1 from jsonb_array_elements(
      case when jsonb_typeof(v_state -> 'downtimes') = 'array' then v_state -> 'downtimes' else '[]'::jsonb end
    ) item where item ->> 'id' = p_downtime_id) then raise exception 'GM_DOWNTIME_ALREADY_EXISTS'; end if;

    v_asset_id := trim(coalesce(p_payload ->> 'assetId', ''));
    v_order_id := trim(coalesce(p_payload ->> 'orderId', ''));
    v_reason := nullif(trim(coalesce(p_payload ->> 'reason', '')), '');
    if v_asset_id = '' then raise exception 'GM_DOWNTIME_ASSET_REQUIRED'; end if;
    if v_reason is null then raise exception 'GM_DOWNTIME_REASON_REQUIRED'; end if;
    select item into v_asset from jsonb_array_elements(
      case when jsonb_typeof(v_state -> 'assets') = 'array' then v_state -> 'assets' else '[]'::jsonb end
    ) item where item ->> 'id' = v_asset_id limit 1;
    if v_asset is null then raise exception 'GM_DOWNTIME_ASSET_NOT_FOUND'; end if;
    if lower(coalesce(v_asset ->> 'status', '')) = 'inativo' then raise exception 'GM_DOWNTIME_ASSET_INACTIVE'; end if;
    if exists (select 1 from jsonb_array_elements(
      case when jsonb_typeof(v_state -> 'downtimes') = 'array' then v_state -> 'downtimes' else '[]'::jsonb end
    ) item where item ->> 'assetId' = v_asset_id
      and public.gm_normalize_downtime_status(item ->> 'status') = 'Ativa') then
      raise exception 'GM_ASSET_ACTIVE_DOWNTIME_EXISTS';
    end if;
    if v_order_id <> '' then
      select item into v_order from jsonb_array_elements(
        case when jsonb_typeof(v_state -> 'orders') = 'array' then v_state -> 'orders' else '[]'::jsonb end
      ) item where item ->> 'id' = v_order_id limit 1;
      if v_order is null then raise exception 'GM_DOWNTIME_ORDER_NOT_FOUND'; end if;
      if coalesce(v_order ->> 'assetId', '') <> '' and v_order ->> 'assetId' <> v_asset_id then
        raise exception 'GM_DOWNTIME_ORDER_ASSET_MISMATCH';
      end if;
    end if;
    v_start_ms := public.gm_downtime_time_ms(p_payload -> 'startAt');
    if v_start_ms is null then raise exception 'GM_DOWNTIME_START_INVALID'; end if;
    v_previous_asset_status := coalesce(nullif(v_asset ->> 'status', ''), 'Operando');
    v_from_status := null;
    v_to_status := 'Ativa';
    v_new_downtime := p_payload
      || jsonb_build_object(
        'id', p_downtime_id, 'assetId', v_asset_id, 'orderId', v_order_id,
        'reason', v_reason, 'status', v_to_status, 'endAt', '', 'durationMs', null,
        'durationHours', null, 'previousAssetStatus', v_previous_asset_status,
        'createdAt', v_event_ms, 'updatedAt', v_event_ms, 'createdBy', auth.uid()
      );
    v_new_downtime := jsonb_set(v_new_downtime, '{history}',
      (case when jsonb_typeof(v_new_downtime -> 'history') = 'array' then v_new_downtime -> 'history' else '[]'::jsonb end)
      || jsonb_build_array(jsonb_build_object(
        'id', v_event_id, 'eventId', v_event_id, 'date', v_event_ms, 'at', v_event_ms,
        'label', 'Parada registrada', 'action', v_action, 'immutable', true
      )), true);
    v_new_asset := v_asset || jsonb_build_object(
      'status', 'Parado', 'activeDowntimeId', p_downtime_id, 'updatedAt', v_event_ms
    );
  else
    select item into v_downtime from jsonb_array_elements(
      case when jsonb_typeof(v_state -> 'downtimes') = 'array' then v_state -> 'downtimes' else '[]'::jsonb end
    ) item where item ->> 'id' = p_downtime_id limit 1;
    if v_downtime is null then raise exception 'GM_DOWNTIME_NOT_FOUND'; end if;
    v_from_status := public.gm_normalize_downtime_status(v_downtime ->> 'status');
    if v_from_status <> 'Ativa' then raise exception 'GM_DOWNTIME_NOT_ACTIVE'; end if;
    v_asset_id := v_downtime ->> 'assetId';
    v_order_id := coalesce(v_downtime ->> 'orderId', '');
    select item into v_asset from jsonb_array_elements(
      case when jsonb_typeof(v_state -> 'assets') = 'array' then v_state -> 'assets' else '[]'::jsonb end
    ) item where item ->> 'id' = v_asset_id limit 1;
    if v_asset is null then raise exception 'GM_DOWNTIME_ASSET_NOT_FOUND'; end if;
    v_start_ms := public.gm_downtime_time_ms(v_downtime -> 'startAt');
    if v_start_ms is null then raise exception 'GM_DOWNTIME_START_INVALID'; end if;
    v_end_ms := coalesce(public.gm_downtime_time_ms(p_payload -> 'endAt'), v_event_ms);
    if v_end_ms < v_start_ms then raise exception 'GM_DOWNTIME_INTERVAL_INVALID'; end if;
    v_duration_ms := round(v_end_ms - v_start_ms)::bigint;
    v_previous_asset_status := coalesce(nullif(v_downtime ->> 'previousAssetStatus', ''), 'Operando');

    if v_action = 'CLOSED' then
      select key into v_forbidden_key from jsonb_object_keys(coalesce(p_payload, '{}'::jsonb)) key
      where key <> all(array[
        'endAt','cause','actionTaken','finalNote','closingOwner','productionImpact','evidence'
      ]::text[]) limit 1;
      if v_forbidden_key is not null then raise exception 'GM_DOWNTIME_PAYLOAD_FIELD_FORBIDDEN:%', v_forbidden_key; end if;
      v_reason := nullif(trim(coalesce(p_payload ->> 'cause', '')), '');
      if v_reason is null then raise exception 'GM_DOWNTIME_CLOSE_REASON_REQUIRED'; end if;
      v_to_status := 'Encerrada';
    else
      select key into v_forbidden_key from jsonb_object_keys(coalesce(p_payload, '{}'::jsonb)) key
      where key <> all(array['endAt','cancelReason','finalNote','closingOwner']::text[]) limit 1;
      if v_forbidden_key is not null then raise exception 'GM_DOWNTIME_PAYLOAD_FIELD_FORBIDDEN:%', v_forbidden_key; end if;
      v_reason := nullif(trim(coalesce(p_payload ->> 'cancelReason', '')), '');
      if v_reason is null then raise exception 'GM_DOWNTIME_CANCEL_REASON_REQUIRED'; end if;
      v_to_status := 'Cancelada';
    end if;

    v_new_downtime := v_downtime || p_payload || jsonb_build_object(
      'status', v_to_status, 'endAt', coalesce(p_payload -> 'endAt', to_jsonb(v_event_time)),
      'durationMs', v_duration_ms, 'durationHours', round(v_duration_ms / 3600000.0, 4),
      'closedAt', v_event_ms, 'updatedAt', v_event_ms
    );
    v_new_downtime := jsonb_set(v_new_downtime, '{history}',
      (case when jsonb_typeof(v_downtime -> 'history') = 'array' then v_downtime -> 'history' else '[]'::jsonb end)
      || jsonb_build_array(jsonb_build_object(
        'id', v_event_id, 'eventId', v_event_id, 'date', v_event_ms, 'at', v_event_ms,
        'label', case when v_action = 'CLOSED' then 'Parada encerrada' else 'Parada cancelada' end,
        'action', v_action, 'reason', v_reason, 'durationMs', v_duration_ms, 'immutable', true
      )), true);

    select item ->> 'id' into v_other_active_id from jsonb_array_elements(v_state -> 'downtimes') item
    where item ->> 'id' <> p_downtime_id and item ->> 'assetId' = v_asset_id
      and public.gm_normalize_downtime_status(item ->> 'status') = 'Ativa'
    limit 1;
    if v_other_active_id is null then
      v_new_asset := (v_asset - 'activeDowntimeId') || jsonb_build_object(
        'status', v_previous_asset_status, 'updatedAt', v_event_ms
      );
    else
      v_new_asset := v_asset || jsonb_build_object(
        'status', 'Parado', 'activeDowntimeId', v_other_active_id, 'updatedAt', v_event_ms
      );
    end if;
  end if;

  select coalesce(profile.display_name, member.access_username, 'Usuário') into v_actor_name
  from public.gm_company_members member
  left join public.gm_profiles profile on profile.user_id = member.user_id
  where member.company_id = v_company_id and member.user_id = auth.uid()
  limit 1;

  v_new_downtime := jsonb_set(v_new_downtime, array['history', (jsonb_array_length(v_new_downtime -> 'history') - 1)::text, 'owner'],
    to_jsonb(coalesce(v_actor_name, 'Usuário')), true);
  v_new_asset := jsonb_set(v_new_asset, '{statusHistory}',
    (case when jsonb_typeof(v_asset -> 'statusHistory') = 'array' then v_asset -> 'statusHistory' else '[]'::jsonb end)
    || jsonb_build_array(jsonb_build_object(
      'id', v_event_id, 'eventId', v_event_id, 'date', v_event_ms, 'action', v_action,
      'downtimeId', p_downtime_id, 'orderId', v_order_id,
      'fromStatus', v_asset ->> 'status', 'toStatus', v_new_asset ->> 'status',
      'owner', coalesce(v_actor_name, 'Usuário'), 'immutable', true
    )), true);

  if v_action = 'OPENED' then
    v_new_state := jsonb_set(v_state, '{downtimes}', jsonb_build_array(v_new_downtime)
      || case when jsonb_typeof(v_state -> 'downtimes') = 'array' then v_state -> 'downtimes' else '[]'::jsonb end, true);
  else
    select jsonb_set(v_state, '{downtimes}', jsonb_agg(
      case when item ->> 'id' = p_downtime_id then v_new_downtime else item end order by position
    ), true) into v_new_state
    from jsonb_array_elements(v_state -> 'downtimes') with ordinality as rows(item, position);
  end if;

  select jsonb_set(v_new_state, '{assets}', jsonb_agg(
    case when item ->> 'id' = v_asset_id then v_new_asset else item end order by position
  ), true) into v_new_state
  from jsonb_array_elements(v_new_state -> 'assets') with ordinality as rows(item, position);

  perform set_config('gestman.downtime_transition', jsonb_build_object(
    'action', v_action, 'downtime_id', p_downtime_id,
    'from_status', coalesce(v_from_status, ''), 'to_status', v_to_status,
    'asset_id', v_asset_id
  )::text, true);

  select saved.version, saved.updated_at into v_saved_version, v_saved_at
  from public.gm_save_tenant_state(p_expected_version, v_new_state) saved;

  insert into public.gm_asset_downtime_events(
    id, company_id, request_id, downtime_id, asset_id, order_id, action,
    from_status, to_status, reason, duration_ms, details, state_version,
    actor_user_id, occurred_at
  ) values (
    v_event_id, v_company_id, p_request_id, p_downtime_id, v_asset_id,
    nullif(v_order_id, ''), v_action, v_from_status, v_to_status, v_reason,
    v_duration_ms, jsonb_build_object('asset_status', v_new_asset ->> 'status'),
    v_saved_version, auth.uid(), v_event_time
  );

  insert into public.gm_audit_log(company_id, user_id, action, entity, entity_id, metadata)
  values (v_company_id, auth.uid(), 'asset_downtime.transition', 'downtime', p_downtime_id,
    jsonb_build_object('action', v_action, 'asset_id', v_asset_id, 'order_id', v_order_id,
      'event_id', v_event_id, 'reason', v_reason, 'duration_ms', v_duration_ms,
      'version', v_saved_version));

  return query select v_saved_version, v_saved_at, p_downtime_id, v_action,
    v_event_id, v_new_downtime, v_new_asset;
end;
$$;

revoke all on function public.gm_normalize_downtime_status(text) from public, anon, authenticated;
revoke all on function public.gm_downtime_time_ms(jsonb) from public, anon, authenticated;
revoke all on function public.gm_transition_asset_downtime(bigint, text, text, jsonb, uuid) from public, anon;
grant execute on function public.gm_transition_asset_downtime(bigint, text, text, jsonb, uuid) to authenticated;

comment on table public.gm_asset_downtime_events is
  'Histórico imutável e tenant-scoped das transições sincronizadas entre Ativos, Paradas e Ordens de Serviço.';

commit;
