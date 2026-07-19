begin;

-- Exclusao definitiva de uma empresa cliente.
-- A funcao e chamada somente pela Edge Function autenticada do painel GestMan.
-- Todos os registros operacionais ficam em tabelas com company_id e possuem
-- ON DELETE CASCADE para public.gm_companies.
create or replace function public.gm_permanently_delete_company(p_company_id uuid)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company public.gm_companies;
  v_member_ids uuid[];
begin
  if not public.gm_is_platform_admin(auth.uid()) then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;

  select *
    into v_company
    from public.gm_companies
   where id = p_company_id
   for update;

  if not found then
    raise exception 'Empresa nao encontrada.' using errcode = 'P0002';
  end if;

  if lower(coalesce(v_company.slug, '')) = 'gestman' then
    raise exception 'A empresa da plataforma nao pode ser excluida.' using errcode = '42501';
  end if;

  select coalesce(array_agg(m.user_id), '{}'::uuid[])
    into v_member_ids
    from public.gm_company_members m
   where m.company_id = p_company_id;

  -- Remove a solicitacao original para liberar o FK RESTRICT e eliminar
  -- os dados comerciais enviados no onboarding.
  delete from public.company_requests
   where converted_company_id = p_company_id;

  -- Remove o historico administrativo referente a esta empresa.
  delete from public.gm_platform_audit_log
   where entity = 'company'
     and entity_id = p_company_id::text;

  -- As seis tabelas tenant atuais usam ON DELETE CASCADE:
  -- audit, membros, assinatura, unidades, estado e preferencias.
  delete from public.gm_companies
   where id = p_company_id;

  return v_member_ids;
end;
$$;

revoke all on function public.gm_permanently_delete_company(uuid) from public, anon;
grant execute on function public.gm_permanently_delete_company(uuid) to authenticated;

commit;
