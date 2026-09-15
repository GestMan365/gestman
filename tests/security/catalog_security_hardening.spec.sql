\set ON_ERROR_STOP on

-- Execute somente em banco descartável após aplicar as migrations locais.
begin;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.ordens_servico'::regclass
      and conname = 'ordens_servico_equipamento_id_fkey'
      and convalidated
  ) then
    raise exception 'QA_FK_NOT_VALIDATED';
  end if;

  if exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public'
      and policyname in (
        'gestman365_perfil_permissoes_select_auth',
        'gestman365_perfis_select_auth',
        'gestman365_permissoes_select_auth'
      )
  ) then
    raise exception 'QA_UNIVERSAL_POLICY_REMAINS';
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
    raise exception 'QA_DIRECT_CATALOG_ACCESS_REMAINS';
  end if;

  if exists (
    select 1 from pg_catalog.pg_class
    where oid in (
      'public.perfil_permissoes'::regclass,
      'public.perfis_acesso'::regclass,
      'public.permissoes'::regclass
    ) and not relrowsecurity
  ) then
    raise exception 'QA_CATALOG_RLS_DISABLED';
  end if;
end;
$$;

insert into auth.users(id, email, role, aud, created_at, updated_at)
values
  ('61000000-0000-4000-8000-000000000001', 'qa-catalog-admin-a@example.invalid', 'authenticated', 'authenticated', now(), now()),
  ('61000000-0000-4000-8000-000000000002', 'qa-catalog-user-a@example.invalid', 'authenticated', 'authenticated', now(), now()),
  ('61000000-0000-4000-8000-000000000003', 'qa-catalog-admin-b@example.invalid', 'authenticated', 'authenticated', now(), now());

insert into public.gm_companies(id, name, slug, created_by)
values
  ('62000000-0000-4000-8000-000000000001', 'QA Catalog Company A', 'qa-catalog-company-a', '61000000-0000-4000-8000-000000000001'),
  ('62000000-0000-4000-8000-000000000002', 'QA Catalog Company B', 'qa-catalog-company-b', '61000000-0000-4000-8000-000000000003');

insert into public.gm_company_members(company_id, user_id, role, access_username, access_profile, permission_levels, active)
values
  ('62000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000001', 'administrator', 'qa.catalog.admin.a', 'admin', '{"orders":"manage"}', true),
  ('62000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000002', 'technician', 'qa.catalog.user.a', 'technician', '{"orders":"operate"}', true),
  ('62000000-0000-4000-8000-000000000002', '61000000-0000-4000-8000-000000000003', 'administrator', 'qa.catalog.admin.b', 'admin', '{"orders":"manage"}', true);

set local role anon;
do $$
begin
  begin
    perform * from public.perfis_acesso limit 1;
    raise exception 'QA_ANON_CATALOG_READ_ACCEPTED';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000002', true);
do $$
begin
  begin
    perform * from public.perfil_permissoes limit 1;
    raise exception 'QA_COMMON_USER_CATALOG_READ_ACCEPTED';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000001', true);

do $$
begin
  begin
    perform * from public.permissoes limit 1;
    raise exception 'QA_AUTHENTICATED_CATALOG_READ_ACCEPTED';
  exception when insufficient_privilege then null;
  end;

  if (select count(*) from public.gm_current_context()) <> 1 then
    raise exception 'QA_AUTHORIZED_CONTEXT_BROKEN';
  end if;

  if (select count(*) from public.gm_list_company_users()) <> 2 then
    raise exception 'QA_AUTHORIZED_USER_LIST_BROKEN';
  end if;

  if exists (
    select 1 from public.gm_list_company_users()
    where user_id = '61000000-0000-4000-8000-000000000003'
  ) then
    raise exception 'QA_CROSS_TENANT_USER_VISIBLE';
  end if;
end;
$$;

reset role;

insert into public.equipamentos(id, codigo, nome)
values ('63000000-0000-4000-8000-000000000001', 'QA-CATALOG-EQ', 'QA Catalog Equipment');

insert into public.ordens_servico(id, numero, solicitante, equipamento_id)
values ('64000000-0000-4000-8000-000000000001', 'QA-CATALOG-OS-VALID', 'QA', '63000000-0000-4000-8000-000000000001');

do $$
begin
  begin
    insert into public.ordens_servico(id, numero, solicitante, equipamento_id)
    values ('64000000-0000-4000-8000-000000000002', 'QA-CATALOG-OS-INVALID', 'QA', '63000000-0000-4000-8000-000000000099');
    raise exception 'QA_INVALID_FK_INSERT_ACCEPTED';
  exception when foreign_key_violation then null;
  end;

  begin
    update public.ordens_servico
    set equipamento_id = '63000000-0000-4000-8000-000000000099'
    where id = '64000000-0000-4000-8000-000000000001';
    raise exception 'QA_INVALID_FK_UPDATE_ACCEPTED';
  exception when foreign_key_violation then null;
  end;

  if not exists (
    select 1 from public.ordens_servico
    where id = '64000000-0000-4000-8000-000000000001'
      and equipamento_id = '63000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'QA_VALID_FK_OPERATION_BROKEN';
  end if;
end;
$$;

rollback;

\echo 'catalog_security_hardening.spec.sql: PASS'
