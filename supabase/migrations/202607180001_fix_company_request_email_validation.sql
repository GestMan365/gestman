begin;

-- Corrige a expressão regular que rejeitava endereços de e-mail válidos.
-- A função continua sendo a única porta pública para criar solicitações.
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
  if exists(
    select 1
      from public.company_requests r
     where r.cnpj = v_cnpj
       and r.status in ('pending','reviewing','approved','converted')
  ) or exists(
    select 1
      from public.gm_companies c
     where c.cnpj = v_cnpj
       and c.status <> 'archived'
  ) then
    raise exception using errcode = '23505', message = 'Ja existe uma solicitacao ou empresa para este CNPJ.';
  end if;

  insert into public.company_requests(
    trade_name, legal_name, cnpj, responsible_name, responsible_role,
    responsible_email, responsible_phone, city, state, estimated_users,
    estimated_units, message
  ) values (
    left(trim(p_request->>'trade_name'),160),
    left(trim(p_request->>'legal_name'),200),
    v_cnpj,
    left(trim(p_request->>'responsible_name'),160),
    nullif(left(trim(p_request->>'responsible_role'),120),''),
    v_email,
    v_phone,
    left(trim(p_request->>'city'),120),
    upper(trim(p_request->>'state')),
    nullif(p_request->>'estimated_users','')::integer,
    nullif(p_request->>'estimated_units','')::integer,
    nullif(left(trim(p_request->>'message'),4000),'')
  )
  returning * into v_row;

  return query
  select v_row.id, v_row.status, v_row.created_at;
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'Ja existe uma solicitacao ou empresa para este CNPJ.';
end;
$$;

revoke all on function public.gm_submit_company_request(jsonb) from public;
grant execute on function public.gm_submit_company_request(jsonb) to anon, authenticated;

commit;
