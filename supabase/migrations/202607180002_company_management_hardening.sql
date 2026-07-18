-- GestMan365 - reforco seguro da administracao de empresas clientes.
-- Migration aditiva: preserva empresas, usuarios e dados operacionais existentes.

create or replace function public.gm_manage_company(
  p_company_id uuid, p_action text, p_payload jsonb default '{}'::jsonb
)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_company public.gm_companies;
  v_subscription public.gm_company_subscriptions;
  v_member_count integer;
  v_unit_count integer;
  v_user_limit integer;
  v_unit_limit integer;
  v_before jsonb;
  v_after jsonb;
begin
  if not public.gm_is_platform_admin() then
    raise exception 'Acesso negado.' using errcode='42501';
  end if;

  select * into v_company from public.gm_companies where id=p_company_id for update;
  if not found then raise exception 'Empresa nao encontrada.' using errcode='P0002'; end if;
  select * into v_subscription from public.gm_company_subscriptions where company_id=p_company_id for update;

  select count(*) into v_member_count from public.gm_company_members
    where company_id=p_company_id and active is distinct from false;
  select count(*) into v_unit_count from public.gm_company_units
    where company_id=p_company_id and status='active';

  v_before := jsonb_build_object('company',to_jsonb(v_company),'subscription',to_jsonb(v_subscription));

  if p_action='suspend' then
    update public.gm_companies set status='suspended' where id=p_company_id;
    update public.gm_company_subscriptions set status='suspended' where company_id=p_company_id;
  elsif p_action='reactivate' then
    update public.gm_companies set status='active',archived_at=null where id=p_company_id;
    update public.gm_company_subscriptions set status='active' where company_id=p_company_id;
  elsif p_action='archive' then
    update public.gm_companies set status='archived',archived_at=now() where id=p_company_id;
    update public.gm_company_subscriptions set status='cancelled' where company_id=p_company_id;
  elsif p_action='update_registration' then
    if length(trim(coalesce(p_payload->>'trade_name',''))) < 2
      or length(trim(coalesce(p_payload->>'legal_name',''))) < 2
      or length(trim(coalesce(p_payload->>'responsible_name',''))) < 2
      or position('@' in coalesce(p_payload->>'responsible_email','')) < 2 then
      raise exception 'Revise os dados cadastrais obrigatorios.' using errcode='22023';
    end if;
    update public.gm_companies set
      trade_name=trim(p_payload->>'trade_name'),
      legal_name=trim(p_payload->>'legal_name'),
      responsible_name=trim(p_payload->>'responsible_name'),
      responsible_email=lower(trim(p_payload->>'responsible_email')),
      responsible_phone=nullif(regexp_replace(coalesce(p_payload->>'responsible_phone',''),'[^0-9]','','g'),''),
      city=nullif(trim(p_payload->>'city'),''),
      state=nullif(upper(trim(p_payload->>'state')),'')
    where id=p_company_id;
  elsif p_action in ('update_plan','update_limits') then
    v_user_limit := coalesce(nullif(p_payload->>'user_limit','')::integer,v_subscription.user_limit);
    v_unit_limit := coalesce(nullif(p_payload->>'unit_limit','')::integer,v_subscription.unit_limit);
    if v_user_limit < greatest(1,v_member_count) or v_user_limit > 100000 then
      raise exception 'O limite de usuarios nao pode ser menor que o uso atual.' using errcode='22023';
    end if;
    if v_unit_limit < greatest(1,v_unit_count) or v_unit_limit > 10000 then
      raise exception 'O limite de unidades nao pode ser menor que o uso atual.' using errcode='22023';
    end if;
    if coalesce(nullif(trim(p_payload->>'plan_code'),''),v_subscription.plan_code) is null then
      raise exception 'Informe o plano contratado.' using errcode='22023';
    end if;
    if nullif(p_payload->>'subscription_status','') is not null
      and (p_payload->>'subscription_status') not in ('trial','active','suspended','cancelled') then
      raise exception 'Status da assinatura invalido.' using errcode='22023';
    end if;
    update public.gm_company_subscriptions set
      plan_code=case when p_action='update_plan' then coalesce(nullif(trim(p_payload->>'plan_code'),''),plan_code) else plan_code end,
      user_limit=v_user_limit,
      unit_limit=v_unit_limit,
      starts_on=coalesce(nullif(p_payload->>'starts_on','')::date,starts_on),
      trial_ends_on=nullif(p_payload->>'trial_ends_on','')::date,
      status=coalesce(nullif(p_payload->>'subscription_status',''),status)
    where company_id=p_company_id;
  else
    raise exception 'Acao invalida.' using errcode='22023';
  end if;

  select jsonb_build_object(
    'company',to_jsonb(c),
    'subscription',to_jsonb(s)
  ) into v_after
  from public.gm_companies c
  left join public.gm_company_subscriptions s on s.company_id=c.id
  where c.id=p_company_id;

  insert into public.gm_platform_audit_log(actor_user_id,action,entity,entity_id,metadata)
    values(auth.uid(),'company.'||p_action,'company',p_company_id::text,
      jsonb_build_object('before',v_before,'after',v_after,'changes',p_payload));
  return v_after;
end;
$$;

revoke all on function public.gm_manage_company(uuid,text,jsonb) from public, anon;
grant execute on function public.gm_manage_company(uuid,text,jsonb) to authenticated;
