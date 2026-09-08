begin;

create or replace function public.gm_work_order_is_asset_active(p_order jsonb)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select public.gm_normalize_work_order_status(p_order ->> 'status')
           in ('Em execução', 'Pausada', 'Aguardando material')
    and public.gm_work_order_time_ms(p_order -> 'startedAt') is not null;
$$;

create or replace function public.gm_reconcile_asset_work_order_lifecycle(
  p_state jsonb,
  p_order_id text,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_state jsonb := p_state;
  v_order jsonb;
  v_active_order jsonb;
  v_asset jsonb;
  v_new_asset jsonb;
  v_downtime jsonb;
  v_new_downtime jsonb;
  v_asset_id text;
  v_status_key text;
  v_control jsonb;
  v_previous_status text;
  v_previous_origin text;
  v_event_ms bigint;
  v_event_action text;
  v_event_id text;
  v_event jsonb;
  v_manual boolean;
  v_has_active_order boolean := false;
  v_has_active_downtime boolean := false;
begin
  select item into v_order
  from jsonb_array_elements(
    case when jsonb_typeof(v_state -> 'orders') = 'array' then v_state -> 'orders' else '[]'::jsonb end
  ) item where item ->> 'id' = p_order_id limit 1;
  if v_order is null then raise exception 'GM_ORDER_NOT_FOUND'; end if;
  if p_actor_user_id is null then raise exception 'GM_AUTH_REQUIRED'; end if;

  v_asset_id := trim(coalesce(v_order ->> 'assetId', ''));
  if v_asset_id = '' then return v_state; end if;
  select item into v_asset
  from jsonb_array_elements(
    case when jsonb_typeof(v_state -> 'assets') = 'array' then v_state -> 'assets' else '[]'::jsonb end
  ) item where item ->> 'id' = v_asset_id limit 1;
  if v_asset is null then raise exception 'GM_ORDER_ASSET_TENANT_MISMATCH'; end if;

  select item into v_active_order
  from jsonb_array_elements(
    case when jsonb_typeof(v_state -> 'orders') = 'array' then v_state -> 'orders' else '[]'::jsonb end
  ) item
  where item ->> 'assetId' = v_asset_id
    and public.gm_work_order_is_asset_active(item)
  order by public.gm_work_order_time_ms(item -> 'startedAt'), item ->> 'id'
  limit 1;
  v_has_active_order := v_active_order is not null;

  select item into v_downtime
  from jsonb_array_elements(
    case when jsonb_typeof(v_state -> 'downtimes') = 'array' then v_state -> 'downtimes' else '[]'::jsonb end
  ) item
  where item ->> 'assetId' = v_asset_id
    and public.gm_normalize_downtime_status(item ->> 'status') = 'Ativa'
  order by public.gm_downtime_time_ms(item -> 'startAt'), item ->> 'id'
  limit 1;
  v_has_active_downtime := v_downtime is not null;

  v_new_asset := v_asset;
  v_control := case
    when jsonb_typeof(v_asset -> 'workOrderStatusControl') = 'object'
      and v_asset #>> '{workOrderStatusControl,source}' = 'work_order'
    then v_asset -> 'workOrderStatusControl'
    else null
  end;
  v_status_key := translate(lower(trim(coalesce(v_asset ->> 'status', ''))),
    'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc');
  v_manual := translate(lower(trim(coalesce(v_asset ->> 'statusOrigin', v_asset ->> 'statusSource', ''))),
    'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') = 'manual'
    or lower(coalesce(v_asset ->> 'statusSetManually', 'false')) = 'true';
  v_event_ms := coalesce(public.gm_work_order_time_ms(v_order -> 'updatedAt'),
    floor(extract(epoch from clock_timestamp()) * 1000));

  if v_has_active_order then
    if v_control is not null and v_manual then
      v_new_asset := v_new_asset - 'workOrderStatusControl';
      v_control := null;
    end if;

    if v_control is null and not (
      not v_has_active_downtime and
      (v_manual or v_status_key like '%manut%' or v_status_key like '%parad%' or v_status_key like '%inativ%')
    ) then
      v_previous_status := coalesce(nullif(v_downtime ->> 'previousAssetStatus', ''),
        nullif(v_asset ->> 'status', ''), 'Operando');
      v_control := jsonb_build_object(
        'source', 'work_order',
        'previousStatus', v_previous_status,
        'previousStatusOrigin', coalesce(v_asset ->> 'statusOrigin', ''),
        'activatedAt', v_event_ms,
        'activatedByOrderId', v_active_order ->> 'id'
      );
      v_new_asset := jsonb_set(v_new_asset, '{workOrderStatusControl}', v_control, true);
      v_event_action := case when v_has_active_downtime
        then 'WORK_ORDER_MAINTENANCE_LINKED' else 'WORK_ORDER_MAINTENANCE_STARTED' end;
      v_event_id := concat('asset-work-order:', v_active_order ->> 'id', ':', v_event_ms, ':', v_event_action);
      v_event := jsonb_build_object(
        'id', v_event_id, 'eventId', v_event_id, 'date', v_event_ms, 'at', v_event_ms,
        'action', v_event_action, 'source', 'work_order', 'orderId', v_active_order ->> 'id',
        'fromStatus', coalesce(v_asset ->> 'status', 'Operando'),
        'toStatus', case when v_has_active_downtime then coalesce(v_asset ->> 'status', 'Parado') else 'Em manutenção' end,
        'previousStatus', v_previous_status, 'actorUserId', p_actor_user_id, 'immutable', true
      );
      v_new_asset := jsonb_set(v_new_asset, '{statusHistory}',
        (case when jsonb_typeof(v_new_asset -> 'statusHistory') = 'array' then v_new_asset -> 'statusHistory' else '[]'::jsonb end)
        || jsonb_build_array(v_event), true);
    end if;

    if v_control is not null and not v_has_active_downtime and not v_manual then
      v_new_asset := v_new_asset || jsonb_build_object(
        'status', 'Em manutenção', 'statusOrigin', 'work_order', 'updatedAt', v_event_ms
      );
    end if;
  elsif v_control is not null then
    v_previous_status := coalesce(nullif(v_control ->> 'previousStatus', ''), 'Operando');
    v_previous_origin := coalesce(v_control ->> 'previousStatusOrigin', '');
    if v_has_active_downtime then
      v_new_downtime := jsonb_set(v_downtime, '{previousAssetStatus}', to_jsonb(v_previous_status), true);
      select jsonb_set(v_state, '{downtimes}', jsonb_agg(
        case when item ->> 'id' = v_downtime ->> 'id' then v_new_downtime else item end order by position
      ), true) into v_state
      from jsonb_array_elements(v_state -> 'downtimes') with ordinality as rows(item, position);
      v_new_asset := (v_new_asset - 'workOrderStatusControl') || jsonb_build_object('updatedAt', v_event_ms);
      v_event_action := 'WORK_ORDER_MAINTENANCE_RELEASED_DURING_DOWNTIME';
    elsif not v_manual then
      v_new_asset := (v_new_asset - 'workOrderStatusControl') || jsonb_build_object(
        'status', v_previous_status, 'updatedAt', v_event_ms
      );
      if v_previous_origin <> '' then
        v_new_asset := jsonb_set(v_new_asset, '{statusOrigin}', to_jsonb(v_previous_origin), true);
      else
        v_new_asset := v_new_asset - 'statusOrigin';
      end if;
      v_event_action := 'WORK_ORDER_MAINTENANCE_RESTORED';
    end if;

    if v_event_action is not null then
      v_event_id := concat('asset-work-order:', p_order_id, ':', v_event_ms, ':', v_event_action);
      v_event := jsonb_build_object(
        'id', v_event_id, 'eventId', v_event_id, 'date', v_event_ms, 'at', v_event_ms,
        'action', v_event_action, 'source', 'work_order', 'orderId', p_order_id,
        'fromStatus', coalesce(v_asset ->> 'status', 'Em manutenção'),
        'toStatus', coalesce(v_new_asset ->> 'status', v_asset ->> 'status'),
        'previousStatus', v_previous_status, 'actorUserId', p_actor_user_id, 'immutable', true
      );
      v_new_asset := jsonb_set(v_new_asset, '{statusHistory}',
        (case when jsonb_typeof(v_new_asset -> 'statusHistory') = 'array' then v_new_asset -> 'statusHistory' else '[]'::jsonb end)
        || jsonb_build_array(v_event), true);
    end if;
  end if;

  select jsonb_set(v_state, '{assets}', jsonb_agg(
    case when item ->> 'id' = v_asset_id then v_new_asset else item end order by position
  ), true) into v_state
  from jsonb_array_elements(v_state -> 'assets') with ordinality as rows(item, position);
  return v_state;
end;
$$;

create or replace function public.gm_mark_manual_asset_status_changes(
  p_old_state jsonb,
  p_new_state jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_state jsonb := p_new_state;
  v_asset_id text;
  v_new_asset jsonb;
  v_changed_at bigint := floor(extract(epoch from clock_timestamp()) * 1000);
begin
  for v_asset_id, v_new_asset in
    select new_asset ->> 'id', new_asset
    from jsonb_array_elements(
      case when jsonb_typeof(p_old_state -> 'assets') = 'array' then p_old_state -> 'assets' else '[]'::jsonb end
    ) old_asset
    join jsonb_array_elements(
      case when jsonb_typeof(p_new_state -> 'assets') = 'array' then p_new_state -> 'assets' else '[]'::jsonb end
    ) new_asset on new_asset ->> 'id' = old_asset ->> 'id'
    where coalesce(old_asset ->> 'status', '') is distinct from coalesce(new_asset ->> 'status', '')
  loop
    v_new_asset := (v_new_asset - 'workOrderStatusControl') || jsonb_build_object(
      'statusOrigin', 'manual', 'statusSetManually', true,
      'statusSetManuallyAt', coalesce(public.gm_work_order_time_ms(v_new_asset -> 'updatedAt'), v_changed_at)
    );
    select jsonb_set(v_state, '{assets}', jsonb_agg(
      case when item ->> 'id' = v_asset_id then v_new_asset else item end order by position
    ), true) into v_state
    from jsonb_array_elements(v_state -> 'assets') with ordinality as rows(item, position);
  end loop;
  return v_state;
end;
$$;

create or replace function public.gm_enforce_work_order_state_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_marker jsonb;
  v_downtime_marker jsonb;
  v_company_id uuid;
  v_actor_user_id uuid;
  v_order_id text;
  v_order jsonb;
  v_asset jsonb;
  v_asset_id text;
  v_old_status text;
  v_new_status text;
begin
  v_actor_user_id := auth.uid();
  if v_actor_user_id is null then raise exception 'GM_AUTH_REQUIRED'; end if;
  if old.company_id is null
     or new.company_id is null
     or new.company_id is distinct from old.company_id then
    raise exception 'GM_TENANT_CONTEXT_INVALID';
  end if;
  v_company_id := old.company_id;
  if not public.gm_is_company_member(v_company_id) then
    raise exception 'GM_TENANT_ACCESS_DENIED';
  end if;

  begin
    v_marker := nullif(current_setting('gestman.order_transition', true), '')::jsonb;
  exception when others then
    v_marker := null;
  end;
  begin
    v_downtime_marker := nullif(current_setting('gestman.downtime_transition', true), '')::jsonb;
  exception when others then
    v_downtime_marker := null;
  end;

  if v_marker is not null then
    v_order_id := trim(coalesce(v_marker ->> 'order_id', ''));
    if v_order_id = '' then raise exception 'GM_ORDER_REQUIRED'; end if;

    select item into v_order
    from jsonb_array_elements(
      case when jsonb_typeof(new.state -> 'orders') = 'array'
        then new.state -> 'orders' else '[]'::jsonb end
    ) item
    where item ->> 'id' = v_order_id
    limit 1;
    if v_order is null then raise exception 'GM_ORDER_NOT_FOUND'; end if;
    if nullif(trim(coalesce(v_order ->> 'companyId', '')), '') is not null
       and v_order ->> 'companyId' <> v_company_id::text then
      raise exception 'GM_ORDER_TENANT_MISMATCH';
    end if;

    v_asset_id := trim(coalesce(v_order ->> 'assetId', ''));
    if v_asset_id <> '' then
      select item into v_asset
      from jsonb_array_elements(
        case when jsonb_typeof(new.state -> 'assets') = 'array'
          then new.state -> 'assets' else '[]'::jsonb end
      ) item
      where item ->> 'id' = v_asset_id
      limit 1;
      if v_asset is null then raise exception 'GM_ORDER_ASSET_TENANT_MISMATCH'; end if;
      if nullif(trim(coalesce(v_asset ->> 'companyId', '')), '') is not null
         and v_asset ->> 'companyId' <> v_company_id::text then
        raise exception 'GM_ORDER_ASSET_TENANT_MISMATCH';
      end if;
    end if;
  end if;

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

  if v_marker is not null then
    new.state := public.gm_reconcile_asset_work_order_lifecycle(
      new.state, v_marker ->> 'order_id', v_actor_user_id
    );
  elsif v_downtime_marker is null then
    new.state := public.gm_mark_manual_asset_status_changes(old.state, new.state);
  end if;
  return new;
end;
$$;

revoke all on function public.gm_work_order_is_asset_active(jsonb) from public, anon, authenticated;
revoke all on function public.gm_reconcile_asset_work_order_lifecycle(jsonb, text, uuid) from public, anon, authenticated;
revoke all on function public.gm_mark_manual_asset_status_changes(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.gm_enforce_work_order_state_transition() from public, anon, authenticated;

revoke all on function public.gm_transition_work_order(bigint, text, text, jsonb, text, uuid) from public, anon;
grant execute on function public.gm_transition_work_order(bigint, text, text, jsonb, text, uuid) to authenticated;

comment on function public.gm_reconcile_asset_work_order_lifecycle(jsonb, text, uuid) is
  'Reconcilia atomicamente o status automático do ativo com o ciclo operacional das O.S., sem sobrescrever estado manual.';

comment on function public.gm_enforce_work_order_state_transition() is
  'Trigger SECURITY DEFINER interno: valida auth.uid() e participação no tenant antes de reconciliar o estado; EXECUTE direto é revogado de todos os papéis clientes.';

commit;
