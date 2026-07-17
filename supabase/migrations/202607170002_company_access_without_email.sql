begin;

-- Converte uma solicitação aprovada usando o domínio escolhido pelo proprietário
-- da plataforma. A senha permanece exclusivamente no Supabase Auth e nunca é
-- recebida ou persistida por esta função.
create or replace function public.gm_convert_company_request_with_access_internal(
  p_request_id uuid, p_actor_user_id uuid, p_admin_user_id uuid, p_company_slug text,
  p_plan_code text, p_user_limit integer, p_unit_limit integer, p_storage_limit_mb integer,
  p_starts_on date, p_trial_ends_on date, p_initial_status text,
  p_main_unit_name text, p_admin_name text, p_admin_email text
)
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  v_req public.company_requests;
  v_company_id uuid;
  v_slug text := lower(trim(p_company_slug));
begin
  if not public.gm_is_platform_admin(p_actor_user_id) then
    raise exception 'Acesso negado.' using errcode='42501';
  end if;
  if v_slug !~ '^[a-z0-9][a-z0-9-]{2,47}$' then
    raise exception 'Dominio invalido.' using errcode='22023';
  end if;
  if p_initial_status not in ('trial','active','suspended') then
    raise exception 'Status inicial invalido.' using errcode='22023';
  end if;
  if p_user_limit < 1 or p_unit_limit < 1 or p_storage_limit_mb < 1 then
    raise exception 'Limites invalidos.' using errcode='22023';
  end if;

  select * into v_req
  from public.company_requests
  where id=p_request_id
  for update;
  if not found then
    raise exception 'Solicitacao nao encontrada.' using errcode='P0002';
  end if;
  if v_req.status='converted' or v_req.converted_company_id is not null then
    raise exception 'Solicitacao ja convertida.' using errcode='23505';
  end if;
  if v_req.status <> 'approved' then
    raise exception 'A solicitacao precisa estar aprovada.' using errcode='22023';
  end if;
  if exists(select 1 from public.gm_companies where cnpj=v_req.cnpj or slug=v_slug) then
    raise exception 'Empresa ou dominio ja cadastrado.' using errcode='23505';
  end if;

  insert into public.gm_companies(
    name,slug,status,created_by,trade_name,legal_name,cnpj,
    responsible_name,responsible_email,responsible_phone,city,state
  )
  values(
    v_req.trade_name,v_slug,p_initial_status,p_actor_user_id,v_req.trade_name,v_req.legal_name,v_req.cnpj,
    v_req.responsible_name,v_req.responsible_email,v_req.responsible_phone,v_req.city,v_req.state
  )
  returning id into v_company_id;

  insert into public.gm_company_units(company_id,name,is_main)
  values(v_company_id,trim(p_main_unit_name),true);

  insert into public.gm_company_subscriptions(
    company_id,plan_code,user_limit,unit_limit,storage_limit_mb,starts_on,trial_ends_on,status
  )
  values(
    v_company_id,trim(p_plan_code),p_user_limit,p_unit_limit,p_storage_limit_mb,p_starts_on,p_trial_ends_on,
    case when p_initial_status='trial' then 'trial'
         when p_initial_status='suspended' then 'suspended'
         else 'active' end
  );

  insert into public.gm_profiles(user_id,display_name,active)
  values(p_admin_user_id,trim(p_admin_name),true)
  on conflict(user_id) do update
    set display_name=excluded.display_name,active=true,updated_at=now();

  insert into public.gm_company_members(company_id,user_id,role,active)
  values(v_company_id,p_admin_user_id,'administrator',true);

  insert into public.gm_tenant_state(company_id,state,version,updated_by)
  values(v_company_id,'{}'::jsonb,0,p_actor_user_id)
  on conflict(company_id) do nothing;

  insert into public.gm_user_preferences(company_id,user_id,preferences)
  values(v_company_id,p_admin_user_id,'{}'::jsonb)
  on conflict(company_id,user_id) do nothing;

  update public.company_requests
  set status='converted',
      converted_company_id=v_company_id,
      converted_by=p_actor_user_id,
      converted_at=now(),
      reviewed_by=coalesce(reviewed_by,p_actor_user_id),
      reviewed_at=coalesce(reviewed_at,now())
  where id=p_request_id;

  insert into public.gm_platform_audit_log(actor_user_id,action,entity,entity_id,metadata)
  values(
    p_actor_user_id,
    'company_request.converted',
    'company',
    v_company_id::text,
    jsonb_build_object(
      'request_id',p_request_id,
      'plan',p_plan_code,
      'admin_email',lower(trim(p_admin_email)),
      'company_slug',v_slug,
      'email_sent',false
    )
  );

  return v_company_id;
exception when unique_violation then
  raise exception 'Solicitacao, empresa ou dominio ja convertido.' using errcode='23505';
end;
$$;

revoke execute on function public.gm_convert_company_request_with_access_internal(
  uuid,uuid,uuid,text,text,integer,integer,integer,date,date,text,text,text,text
) from public, anon, authenticated;
grant execute on function public.gm_convert_company_request_with_access_internal(
  uuid,uuid,uuid,text,text,integer,integer,integer,date,date,text,text,text,text
) to service_role;

commit;
