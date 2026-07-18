begin;

-- GestMan365 - onboarding seguro de empresas clientes.
-- Esta migration e aditiva: nao apaga nem altera dados operacionais existentes.

create extension if not exists pgcrypto;

-- Administradores da plataforma GestMan (separados dos administradores dos clientes).
create table if not exists public.gm_platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'superadmin')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_requests (
  id uuid primary key default gen_random_uuid(),
  trade_name text not null check (length(trim(trade_name)) between 2 and 160),
  legal_name text not null check (length(trim(legal_name)) between 2 and 200),
  cnpj text not null check (cnpj ~ '^[0-9]{14}$'),
  responsible_name text not null check (length(trim(responsible_name)) between 2 and 160),
  responsible_role text,
  responsible_email text not null,
  responsible_phone text not null,
  city text not null,
  state text not null check (state ~ '^[A-Z]{2}$'),
  estimated_users integer check (estimated_users is null or estimated_users between 1 and 100000),
  estimated_units integer check (estimated_units is null or estimated_units between 1 and 10000),
  message text,
  status text not null default 'pending' check (status in ('pending', 'reviewing', 'approved', 'rejected', 'converted')),
  internal_notes text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  converted_company_id uuid references public.gm_companies(id) on delete restrict,
  converted_by uuid references auth.users(id) on delete set null,
  converted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists company_requests_open_cnpj_uidx
  on public.company_requests(cnpj)
  where status in ('pending', 'reviewing', 'approved', 'converted');
create index if not exists company_requests_status_created_idx
  on public.company_requests(status, created_at desc);
create index if not exists company_requests_search_idx
  on public.company_requests(lower(trade_name), lower(responsible_email));

-- Amplia o cadastro de empresa sem remover as colunas anteriores.
alter table public.gm_companies add column if not exists trade_name text;
alter table public.gm_companies add column if not exists legal_name text;
alter table public.gm_companies add column if not exists cnpj text;
alter table public.gm_companies add column if not exists responsible_name text;
alter table public.gm_companies add column if not exists responsible_email text;
alter table public.gm_companies add column if not exists responsible_phone text;
alter table public.gm_companies add column if not exists city text;
alter table public.gm_companies add column if not exists state text;
alter table public.gm_companies add column if not exists logo_url text;
alter table public.gm_companies add column if not exists last_access_at timestamptz;
alter table public.gm_companies add column if not exists archived_at timestamptz;
alter table public.gm_companies drop constraint if exists gm_companies_status_check;
alter table public.gm_companies add constraint gm_companies_status_check
  check (status in ('trial', 'active', 'suspended', 'archived'));
create unique index if not exists gm_companies_cnpj_uidx on public.gm_companies(cnpj) where cnpj is not null;

create table if not exists public.gm_company_units (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.gm_companies(id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 160),
  is_main boolean not null default false,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists gm_company_units_one_main_uidx
  on public.gm_company_units(company_id) where is_main;

create table if not exists public.gm_company_subscriptions (
  company_id uuid primary key references public.gm_companies(id) on delete cascade,
  plan_code text not null check (length(trim(plan_code)) between 2 and 80),
  user_limit integer not null check (user_limit > 0),
  unit_limit integer not null check (unit_limit > 0),
  storage_limit_mb integer not null check (storage_limit_mb > 0),
  starts_on date not null,
  trial_ends_on date,
  status text not null check (status in ('trial', 'active', 'suspended', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gm_platform_audit_log (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists gm_platform_audit_created_idx on public.gm_platform_audit_log(created_at desc);

drop trigger if exists gm_platform_admins_updated_at on public.gm_platform_admins;
create trigger gm_platform_admins_updated_at before update on public.gm_platform_admins
for each row execute function public.gm_set_updated_at();
drop trigger if exists company_requests_updated_at on public.company_requests;
create trigger company_requests_updated_at before update on public.company_requests
for each row execute function public.gm_set_updated_at();
drop trigger if exists gm_company_units_updated_at on public.gm_company_units;
create trigger gm_company_units_updated_at before update on public.gm_company_units
for each row execute function public.gm_set_updated_at();
drop trigger if exists gm_company_subscriptions_updated_at on public.gm_company_subscriptions;
create trigger gm_company_subscriptions_updated_at before update on public.gm_company_subscriptions
for each row execute function public.gm_set_updated_at();

create or replace function public.gm_is_platform_admin(p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.gm_platform_admins a
    where a.user_id = p_user_id and a.active and a.role in ('owner', 'superadmin')
  );
$$;

create or replace function public.gm_current_platform_role()
returns text language sql stable security definer set search_path = public
as $$
  select a.role from public.gm_platform_admins a
  where a.user_id = auth.uid() and a.active limit 1;
$$;

create or replace function public.gm_is_valid_cnpj(p_value text)
returns boolean language plpgsql immutable set search_path = public
as $$
declare
  v text := regexp_replace(coalesce(p_value, ''), '[^0-9]', '', 'g');
  s integer; i integer; d1 integer; d2 integer;
begin
  if length(v) <> 14 or length(replace(v, substring(v, 1, 1), '')) = 0 then return false; end if;
  s := 0;
  for i in 1..12 loop
    s := s + substring(v, i, 1)::integer * (array[5,4,3,2,9,8,7,6,5,4,3,2])[i];
  end loop;
  d1 := case when (s % 11) < 2 then 0 else 11 - (s % 11) end;
  s := 0;
  for i in 1..13 loop
    s := s + substring(v, i, 1)::integer * (array[6,5,4,3,2,9,8,7,6,5,4,3,2])[i];
  end loop;
  d2 := case when (s % 11) < 2 then 0 else 11 - (s % 11) end;
  return substring(v, 13, 1)::integer = d1 and substring(v, 14, 1)::integer = d2;
end;
$$;

-- Unica porta publica para solicitar cadastro. Visitantes nao recebem acesso direto a tabela.
create or replace function public.gm_submit_company_request(p_request jsonb)
returns table(request_id uuid, request_status text, submitted_at timestamptz)
language plpgsql security definer set search_path = public
as $$
declare
  v_cnpj text := regexp_replace(coalesce(p_request->>'cnpj', ''), '[^0-9]', '', 'g');
  v_email text := lower(trim(coalesce(p_request->>'responsible_email', '')));
  v_phone text := regexp_replace(coalesce(p_request->>'responsible_phone', ''), '[^0-9]', '', 'g');
  v_row public.company_requests;
begin
  if length(trim(coalesce(p_request->>'trade_name',''))) < 2
    or length(trim(coalesce(p_request->>'legal_name',''))) < 2
    or length(trim(coalesce(p_request->>'responsible_name',''))) < 2
    or length(trim(coalesce(p_request->>'city',''))) < 2
    or upper(trim(coalesce(p_request->>'state',''))) !~ '^[A-Z]{2}$' then
    raise exception using errcode = '22023', message = 'Dados obrigatorios invalidos.';
  end if;
  if not public.gm_is_valid_cnpj(v_cnpj) then
    raise exception using errcode = '22023', message = 'CNPJ invalido.';
  end if;
  if v_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then
    raise exception using errcode = '22023', message = 'E-mail profissional invalido.';
  end if;
  if length(v_phone) < 10 or length(v_phone) > 13 then
    raise exception using errcode = '22023', message = 'Telefone invalido.';
  end if;
  if exists(select 1 from public.company_requests r where r.cnpj=v_cnpj and r.status in ('pending','reviewing','approved','converted'))
     or exists(select 1 from public.gm_companies c where c.cnpj=v_cnpj and c.status <> 'archived') then
    raise exception using errcode = '23505', message = 'Ja existe uma solicitacao ou empresa para este CNPJ.';
  end if;

  insert into public.company_requests(
    trade_name, legal_name, cnpj, responsible_name, responsible_role,
    responsible_email, responsible_phone, city, state, estimated_users,
    estimated_units, message
  ) values (
    left(trim(p_request->>'trade_name'),160), left(trim(p_request->>'legal_name'),200), v_cnpj,
    left(trim(p_request->>'responsible_name'),160), nullif(left(trim(p_request->>'responsible_role'),120),''),
    v_email, v_phone, left(trim(p_request->>'city'),120), upper(trim(p_request->>'state')),
    nullif(p_request->>'estimated_users','')::integer, nullif(p_request->>'estimated_units','')::integer,
    nullif(left(trim(p_request->>'message'),4000),'')
  ) returning * into v_row;
  return query select v_row.id, v_row.status, v_row.created_at;
exception when unique_violation then
  raise exception using errcode = '23505', message = 'Ja existe uma solicitacao ou empresa para este CNPJ.';
end;
$$;

create or replace function public.gm_review_company_request(
  p_request_id uuid, p_status text, p_internal_notes text default null
)
returns public.company_requests
language plpgsql security definer set search_path = public
as $$
declare v_row public.company_requests; v_action text;
begin
  if not public.gm_is_platform_admin() then raise exception 'Acesso negado.' using errcode='42501'; end if;
  if p_status not in ('reviewing','approved','rejected') then raise exception 'Status invalido.' using errcode='22023'; end if;
  update public.company_requests set status=p_status, internal_notes=nullif(trim(p_internal_notes),''),
    reviewed_by=auth.uid(), reviewed_at=now()
  where id=p_request_id and status <> 'converted' returning * into v_row;
  if not found then raise exception 'Solicitacao nao encontrada ou ja convertida.' using errcode='P0002'; end if;
  v_action := case p_status when 'approved' then 'company_request.approved' when 'rejected' then 'company_request.rejected' else 'company_request.reviewing' end;
  insert into public.gm_platform_audit_log(actor_user_id,action,entity,entity_id,metadata)
    values(auth.uid(),v_action,'company_request',v_row.id::text,jsonb_build_object('status',p_status));
  return v_row;
end;
$$;

create or replace function public.gm_company_slug(p_name text, p_cnpj text)
returns text language sql immutable set search_path = public
as $$
  select left(trim(both '-' from regexp_replace(lower(translate(coalesce(p_name,'empresa'),
    'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc')), '[^a-z0-9]+','-','g')),48)
    || '-' || right(regexp_replace(coalesce(p_cnpj,''),'[^0-9]','','g'),6);
$$;

-- Chamada exclusivamente pela Edge Function com service_role. Nunca concedida a anon/authenticated.
create or replace function public.gm_convert_company_request_internal(
  p_request_id uuid, p_actor_user_id uuid, p_admin_user_id uuid,
  p_plan_code text, p_user_limit integer, p_unit_limit integer, p_storage_limit_mb integer,
  p_starts_on date, p_trial_ends_on date, p_initial_status text,
  p_main_unit_name text, p_admin_name text, p_admin_email text
)
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_req public.company_requests; v_company_id uuid; v_slug text;
begin
  if not public.gm_is_platform_admin(p_actor_user_id) then raise exception 'Acesso negado.' using errcode='42501'; end if;
  if p_initial_status not in ('trial','active','suspended') then raise exception 'Status inicial invalido.' using errcode='22023'; end if;
  if p_user_limit < 1 or p_unit_limit < 1 or p_storage_limit_mb < 1 then raise exception 'Limites invalidos.' using errcode='22023'; end if;
  select * into v_req from public.company_requests where id=p_request_id for update;
  if not found then raise exception 'Solicitacao nao encontrada.' using errcode='P0002'; end if;
  if v_req.status='converted' or v_req.converted_company_id is not null then raise exception 'Solicitacao ja convertida.' using errcode='23505'; end if;
  if v_req.status <> 'approved' then raise exception 'A solicitacao precisa estar aprovada.' using errcode='22023'; end if;
  if exists(select 1 from public.gm_companies where cnpj=v_req.cnpj) then raise exception 'Empresa ja cadastrada.' using errcode='23505'; end if;

  v_slug := public.gm_company_slug(v_req.trade_name,v_req.cnpj);
  insert into public.gm_companies(name,slug,status,created_by,trade_name,legal_name,cnpj,
    responsible_name,responsible_email,responsible_phone,city,state)
  values(v_req.trade_name,v_slug,p_initial_status,p_actor_user_id,v_req.trade_name,v_req.legal_name,v_req.cnpj,
    v_req.responsible_name,v_req.responsible_email,v_req.responsible_phone,v_req.city,v_req.state)
  returning id into v_company_id;

  insert into public.gm_company_units(company_id,name,is_main) values(v_company_id,trim(p_main_unit_name),true);
  insert into public.gm_company_subscriptions(company_id,plan_code,user_limit,unit_limit,storage_limit_mb,starts_on,trial_ends_on,status)
  values(v_company_id,trim(p_plan_code),p_user_limit,p_unit_limit,p_storage_limit_mb,p_starts_on,p_trial_ends_on,
    case when p_initial_status='trial' then 'trial' when p_initial_status='suspended' then 'suspended' else 'active' end);
  insert into public.gm_profiles(user_id,display_name,active) values(p_admin_user_id,trim(p_admin_name),true)
    on conflict(user_id) do update set display_name=excluded.display_name,active=true,updated_at=now();
  insert into public.gm_company_members(company_id,user_id,role,active)
    values(v_company_id,p_admin_user_id,'administrator',true);
  insert into public.gm_tenant_state(company_id,state,version,updated_by)
    values(v_company_id,'{}'::jsonb,0,p_actor_user_id) on conflict(company_id) do nothing;
  insert into public.gm_user_preferences(company_id,user_id,preferences)
    values(v_company_id,p_admin_user_id,'{}'::jsonb) on conflict(company_id,user_id) do nothing;

  update public.company_requests set status='converted',converted_company_id=v_company_id,
    converted_by=p_actor_user_id,converted_at=now(),reviewed_by=coalesce(reviewed_by,p_actor_user_id),
    reviewed_at=coalesce(reviewed_at,now()) where id=p_request_id;
  insert into public.gm_platform_audit_log(actor_user_id,action,entity,entity_id,metadata)
    values(p_actor_user_id,'company_request.converted','company',v_company_id::text,
      jsonb_build_object('request_id',p_request_id,'plan',p_plan_code,'admin_email',lower(trim(p_admin_email))));
  return v_company_id;
exception when unique_violation then
  raise exception 'Solicitacao ou empresa ja convertida.' using errcode='23505';
end;
$$;

create or replace function public.gm_manage_company(
  p_company_id uuid, p_action text, p_payload jsonb default '{}'::jsonb
)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_company public.gm_companies; v_before jsonb; v_after jsonb;
begin
  if not public.gm_is_platform_admin() then raise exception 'Acesso negado.' using errcode='42501'; end if;
  select * into v_company from public.gm_companies where id=p_company_id for update;
  if not found then raise exception 'Empresa nao encontrada.' using errcode='P0002'; end if;
  v_before := to_jsonb(v_company);
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
    update public.gm_companies set
      trade_name=coalesce(nullif(trim(p_payload->>'trade_name'),''),trade_name),
      legal_name=coalesce(nullif(trim(p_payload->>'legal_name'),''),legal_name),
      responsible_name=coalesce(nullif(trim(p_payload->>'responsible_name'),''),responsible_name),
      responsible_email=coalesce(nullif(lower(trim(p_payload->>'responsible_email')),''),responsible_email),
      responsible_phone=coalesce(nullif(regexp_replace(p_payload->>'responsible_phone','[^0-9]','','g'),''),responsible_phone),
      city=coalesce(nullif(trim(p_payload->>'city'),''),city), state=coalesce(nullif(upper(trim(p_payload->>'state')),''),state)
    where id=p_company_id;
  elsif p_action in ('update_plan','update_limits') then
    update public.gm_company_subscriptions set
      plan_code=case when p_action='update_plan' then coalesce(nullif(trim(p_payload->>'plan_code'),''),plan_code) else plan_code end,
      user_limit=coalesce(nullif(p_payload->>'user_limit','')::integer,user_limit),
      unit_limit=coalesce(nullif(p_payload->>'unit_limit','')::integer,unit_limit),
      storage_limit_mb=coalesce(nullif(p_payload->>'storage_limit_mb','')::integer,storage_limit_mb)
    where company_id=p_company_id;
  else raise exception 'Acao invalida.' using errcode='22023'; end if;
  select to_jsonb(c) into v_after from public.gm_companies c where c.id=p_company_id;
  insert into public.gm_platform_audit_log(actor_user_id,action,entity,entity_id,metadata)
    values(auth.uid(),'company.'||p_action,'company',p_company_id::text,jsonb_build_object('before',v_before,'after',v_after,'changes',p_payload));
  return v_after;
end;
$$;

create or replace function public.gm_touch_company_access(p_company_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.gm_is_company_member(p_company_id) then raise exception 'Acesso negado.' using errcode='42501'; end if;
  update public.gm_companies set last_access_at=now() where id=p_company_id;
end;
$$;

-- RLS: o publico somente executa gm_submit_company_request; nao consulta tabelas.
alter table public.gm_platform_admins enable row level security;
alter table public.company_requests enable row level security;
alter table public.gm_company_units enable row level security;
alter table public.gm_company_subscriptions enable row level security;
alter table public.gm_platform_audit_log enable row level security;

drop policy if exists gm_platform_admins_self_select on public.gm_platform_admins;
create policy gm_platform_admins_self_select on public.gm_platform_admins for select to authenticated
using (user_id=auth.uid() and active);
drop policy if exists company_requests_platform_select on public.company_requests;
create policy company_requests_platform_select on public.company_requests for select to authenticated
using (public.gm_is_platform_admin());
drop policy if exists company_requests_platform_update on public.company_requests;
create policy company_requests_platform_update on public.company_requests for update to authenticated
using (public.gm_is_platform_admin()) with check (public.gm_is_platform_admin());
drop policy if exists gm_units_tenant_select on public.gm_company_units;
create policy gm_units_tenant_select on public.gm_company_units for select to authenticated
using (public.gm_is_company_member(company_id) or public.gm_is_platform_admin());
drop policy if exists gm_subscriptions_tenant_select on public.gm_company_subscriptions;
create policy gm_subscriptions_tenant_select on public.gm_company_subscriptions for select to authenticated
using (public.gm_is_company_member(company_id) or public.gm_is_platform_admin());
drop policy if exists gm_platform_audit_select on public.gm_platform_audit_log;
create policy gm_platform_audit_select on public.gm_platform_audit_log for select to authenticated
using (public.gm_is_platform_admin());

drop policy if exists gm_companies_platform_select on public.gm_companies;
create policy gm_companies_platform_select on public.gm_companies for select to authenticated
using (public.gm_is_platform_admin());
drop policy if exists gm_companies_platform_update on public.gm_companies;
create policy gm_companies_platform_update on public.gm_companies for update to authenticated
using (public.gm_is_platform_admin()) with check (public.gm_is_platform_admin());
drop policy if exists gm_members_platform_select on public.gm_company_members;
create policy gm_members_platform_select on public.gm_company_members for select to authenticated
using (public.gm_is_platform_admin());

revoke all on public.company_requests from anon, authenticated;
revoke all on public.gm_platform_admins from anon;
revoke all on public.gm_platform_audit_log from anon, authenticated;
revoke execute on function public.gm_convert_company_request_internal(uuid,uuid,uuid,text,integer,integer,integer,date,date,text,text,text,text) from public, anon, authenticated;
grant execute on function public.gm_convert_company_request_internal(uuid,uuid,uuid,text,integer,integer,integer,date,date,text,text,text,text) to service_role;
grant execute on function public.gm_submit_company_request(jsonb) to anon, authenticated;
grant execute on function public.gm_current_platform_role() to authenticated;
grant execute on function public.gm_review_company_request(uuid,text,text) to authenticated;
grant execute on function public.gm_manage_company(uuid,text,jsonb) to authenticated;
grant execute on function public.gm_touch_company_access(uuid) to authenticated;
grant select on public.company_requests, public.gm_platform_admins, public.gm_company_units, public.gm_company_subscriptions, public.gm_companies, public.gm_company_members to authenticated;
grant select on public.gm_platform_audit_log to authenticated;

commit;

-- Primeiro proprietario (executar manualmente depois de criar o usuario no Supabase Auth):
-- insert into public.gm_platform_admins(user_id, role) values ('UUID-DO-USUARIO', 'owner');
