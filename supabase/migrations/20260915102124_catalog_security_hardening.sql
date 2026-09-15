begin;

set local lock_timeout = '5s';
set local statement_timeout = '5min';

-- Fail before changing privileges when the production objects no longer match
-- the catalog state audited for this release.
do $$
declare
  v_definition text;
  v_referenced_table oid;
begin
  select
    replace(pg_catalog.pg_get_constraintdef(c.oid, true), ' NOT VALID', ''),
    c.confrelid
  into v_definition, v_referenced_table
  from pg_catalog.pg_constraint c
  where c.conrelid = 'public.ordens_servico'::regclass
    and c.conname = 'ordens_servico_equipamento_id_fkey'
    and c.contype = 'f';

  if not found
     or v_referenced_table <> 'public.equipamentos'::regclass
     or v_definition <> 'FOREIGN KEY (equipamento_id) REFERENCES equipamentos(id) ON DELETE SET NULL' then
    raise exception 'GM_CATALOG_HARDENING_FK_PREFLIGHT_FAILED';
  end if;
end;
$$;

do $$
declare
  v_authenticated oid;
  v_target record;
  v_policy record;
begin
  select oid into strict v_authenticated
  from pg_catalog.pg_roles
  where rolname = 'authenticated';

  for v_target in
    select *
    from (values
      ('public.perfil_permissoes'::regclass, 'gestman365_perfil_permissoes_select_auth'),
      ('public.perfis_acesso'::regclass, 'gestman365_perfis_select_auth'),
      ('public.permissoes'::regclass, 'gestman365_permissoes_select_auth')
    ) as expected(table_oid, policy_name)
  loop
    select
      p.polcmd,
      p.polpermissive,
      p.polroles,
      pg_catalog.pg_get_expr(p.polqual, p.polrelid, true) as using_expression,
      pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid, true) as check_expression
    into v_policy
    from pg_catalog.pg_policy p
    where p.polrelid = v_target.table_oid
      and p.polname = v_target.policy_name;

    if not found then
      raise exception 'GM_CATALOG_HARDENING_POLICY_PREFLIGHT_FAILED: %', v_target.policy_name;
    end if;

    if not (
      v_policy.polcmd = 'r'
      and v_policy.polpermissive
      and v_policy.polroles = array[v_authenticated]::oid[]
      and v_policy.using_expression = 'true'
      and v_policy.check_expression is null
    ) then
      raise exception 'GM_CATALOG_HARDENING_POLICY_PREFLIGHT_FAILED: %', v_target.policy_name;
    end if;
  end loop;
end;
$$;

-- PostgreSQL validates historical rows and aborts the whole transaction when
-- an orphan is found. No automatic cleanup or data repair is performed.
alter table public.ordens_servico
  validate constraint ordens_servico_equipamento_id_fkey;

-- These legacy catalogs are not read directly by the current browser runtime.
-- Authorization is delivered through the existing tenant-scoped context and
-- company-user flows backed by gm_company_members.permission_levels.
revoke all privileges on table public.perfil_permissoes from public, anon, authenticated;
revoke all privileges on table public.perfis_acesso from public, anon, authenticated;
revoke all privileges on table public.permissoes from public, anon, authenticated;

drop policy gestman365_perfil_permissoes_select_auth on public.perfil_permissoes;
drop policy gestman365_perfis_select_auth on public.perfis_acesso;
drop policy gestman365_permissoes_select_auth on public.permissoes;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint c
    where c.conrelid = 'public.ordens_servico'::regclass
      and c.conname = 'ordens_servico_equipamento_id_fkey'
      and c.contype = 'f'
      and c.convalidated
  ) then
    raise exception 'GM_CATALOG_HARDENING_FK_POSTCHECK_FAILED';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_policy p
    where (p.polrelid, p.polname) in (
      ('public.perfil_permissoes'::regclass, 'gestman365_perfil_permissoes_select_auth'),
      ('public.perfis_acesso'::regclass, 'gestman365_perfis_select_auth'),
      ('public.permissoes'::regclass, 'gestman365_permissoes_select_auth')
    )
  ) then
    raise exception 'GM_CATALOG_HARDENING_POLICY_POSTCHECK_FAILED';
  end if;

  if exists (
    select 1
    from (values ('anon'), ('authenticated')) as client_roles(role_name)
    cross join (values
      ('public.perfil_permissoes'::regclass),
      ('public.perfis_acesso'::regclass),
      ('public.permissoes'::regclass)
    ) as catalogs(table_oid)
    cross join (values
      ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'),
      ('TRUNCATE'), ('REFERENCES'), ('TRIGGER'), ('MAINTAIN')
    ) as privileges(privilege_name)
    where has_table_privilege(client_roles.role_name, catalogs.table_oid, privileges.privilege_name)
  ) or exists (
    select 1
    from pg_catalog.pg_class c
    cross join lateral pg_catalog.aclexplode(
      coalesce(c.relacl, pg_catalog.acldefault('r', c.relowner))
    ) acl
    where c.oid in (
      'public.perfil_permissoes'::regclass,
      'public.perfis_acesso'::regclass,
      'public.permissoes'::regclass
    )
      and acl.grantee = 0
  ) then
    raise exception 'GM_CATALOG_HARDENING_GRANT_POSTCHECK_FAILED';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_class c
    where c.oid in (
      'public.perfil_permissoes'::regclass,
      'public.perfis_acesso'::regclass,
      'public.permissoes'::regclass
    )
      and not c.relrowsecurity
  ) then
    raise exception 'GM_CATALOG_HARDENING_RLS_POSTCHECK_FAILED';
  end if;
end;
$$;

commit;
