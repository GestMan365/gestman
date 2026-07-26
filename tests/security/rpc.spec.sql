-- Local-only RPC security specification.
-- Prerequisites: pgTAP and separate connections for anon, authenticated member,
-- inactive member and service_role in an isolated Supabase project.

-- Expected: service_role-only bootstrap remains restricted.
select throws_ok(
  $$ select * from public.gm_bootstrap_company('Empresa', 'empresa', 'Administrador') $$,
  '42501',
  'gm_bootstrap_company remains restricted'
);

-- Expected: state save enforces versioning and membership.
select throws_ok(
  $$ select * from public.gm_save_tenant_state(0, '{}'::jsonb) $$,
  '42501',
  'gm_save_tenant_state remains membership-bound'
);
