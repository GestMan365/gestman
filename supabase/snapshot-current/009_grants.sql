-- GestMan365 Supabase snapshot — reference only, captured 2026-07-22.
-- Schema-only. No customer data. Statements remain commented intentionally.
-- Do not apply directly to production.

-- Observed execution model:
-- authenticated: current context, company users, tenant load/save, preferences,
--   company management and permission checks.
-- service_role: bootstrap, public request submission/conversion, internal user
--   upsert/activation and rate limiting.
--
-- Review required: PUBLIC currently has EXECUTE on multiple SECURITY DEFINER
-- functions, including gm_load_tenant_state, gm_current_platform_role,
-- gm_is_company_member, gm_is_company_admin, gm_review_company_request,
-- gm_touch_company_access and proxima_ordem_servico_numero.
--
-- Remote divergence: gm_submit_company_request showed service_role execution,
-- while a repository migration grants anon and authenticated.

