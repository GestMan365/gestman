-- Local-only security test specification.
-- These statements are intentionally not executed here because no local database
-- harness is available in this workspace.
-- Prerequisites: pgTAP, isolated fixtures, an anonymous connection and an
-- authenticated active member fixture. Never run against production.

-- Expected: authenticated member can read current context.
select ok(
  exists(select 1 from public.gm_current_context()),
  'gm_current_context returns a row for an authenticated member'
);

-- Expected: anonymous access to tenant state is denied.
select throws_ok(
  $$ select * from public.gm_load_tenant_state() $$,
  '42501',
  'gm_load_tenant_state denies anonymous access'
);

-- Expected: legacy password writes are blocked. The exact INSERT columns must be
-- aligned with the official schema-only dump before this specification is run.
select throws_ok(
  $$ insert into public.gestman_usuarios(id, empresa_id, nome, email, senha) values (gen_random_uuid(), gen_random_uuid(), 'x', 'x@example.com', 'x') $$,
  '42501',
  'legacy password writes are blocked'
);
