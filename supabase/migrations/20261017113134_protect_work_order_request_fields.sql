-- The request submitted with an existing work order belongs to the company
-- administrator. Technicians may append execution data, but not rewrite it.
create or replace function public.gm_protect_work_order_request_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previous jsonb;
  v_next jsonb;
  v_next_by_id jsonb;
  v_field text;
  v_request_fields constant text[] := array[
    'number', 'assetId', 'title', 'description', 'requester', 'createdAt', 'plan',
    'type', 'maintenance', 'priority', 'scheduledAt', 'deadline',
    'plannedDurationHours', 'durationDays', 'durationHours',
    'teamId', 'resourceId', 'executorIds', 'executorSnapshot',
    'participantIds', 'linkedChecklists', 'plannedSpareId', 'preventivePlanId'
  ];
begin
  if auth.uid() is null then raise exception 'GM_AUTH_REQUIRED'; end if;
  if old.company_id is distinct from new.company_id then
    raise exception 'GM_TENANT_CONTEXT_INVALID';
  end if;
  if public.gm_is_company_admin(old.company_id) then return new; end if;

  select coalesce(jsonb_object_agg(value ->> 'id', value), '{}'::jsonb)
    into v_next_by_id
  from jsonb_array_elements(
    case when jsonb_typeof(new.state -> 'orders') = 'array'
      then new.state -> 'orders' else '[]'::jsonb end
  ) as item(value)
  where value ? 'id';

  for v_previous in
    select value from jsonb_array_elements(
      case when jsonb_typeof(old.state -> 'orders') = 'array'
        then old.state -> 'orders' else '[]'::jsonb end
    )
  loop
    v_next := v_next_by_id -> (v_previous ->> 'id');
    if v_next is null then
      raise exception 'GM_ORDER_REQUEST_ADMIN_ONLY:remove_order';
    end if;
    foreach v_field in array v_request_fields loop
      if v_previous -> v_field is distinct from v_next -> v_field then
        raise exception 'GM_ORDER_REQUEST_ADMIN_ONLY:%', v_field;
      end if;
    end loop;
    -- The assigned executor can be completed for a legacy unassigned order,
    -- but an existing assignment is part of the submitted request.
    if nullif(trim(coalesce(v_previous ->> 'executor', '')), '') is not null
       and v_previous -> 'executor' is distinct from v_next -> 'executor' then
      raise exception 'GM_ORDER_REQUEST_ADMIN_ONLY:executor';
    end if;
    -- Evidence submitted with the request cannot be removed or rewritten.
    if not (coalesce(v_previous -> 'attachments', '[]'::jsonb)
            <@ coalesce(v_next -> 'attachments', '[]'::jsonb)) then
      raise exception 'GM_ORDER_REQUEST_ADMIN_ONLY:attachments';
    end if;
  end loop;
  return new;
end;
$$;

revoke all on function public.gm_protect_work_order_request_fields() from public, anon, authenticated;
drop trigger if exists gm_tenant_state_protect_order_request on public.gm_tenant_state;
create trigger gm_tenant_state_protect_order_request
before update of state on public.gm_tenant_state
for each row execute function public.gm_protect_work_order_request_fields();
