-- GestMan365 Supabase snapshot — reference only, captured 2026-07-22.
-- Schema-only. No customer data. Statements remain commented intentionally.
-- Do not apply directly to production.

-- All 43 tables in public have RLS enabled.

-- RLS enabled with no policy (default deny for anon/authenticated REST):
-- checklists, equipamentos, estoque_saldos, estoques, eventos_ordem_servico,
-- fornecedores, gm_public_rate_limits, locais_instalacao, movimentacoes_estoque,
-- movimentacoes_estoque_itens, movimentacoes_tags, perfis, regioes,
-- requisicoes_materiais, requisicoes_materiais_itens, subtags,
-- subtags_equipamento, tags, transferencias_estoque,
-- transferencias_estoque_itens.

-- Critical legacy policies observed remotely:
-- ativos: prototipo_select_ativos USING (true)
-- ativos: prototipo_insert_ativos WITH CHECK (true)
-- ativos: prototipo_update_ativos USING (true)
-- chamados: equivalent three prototipo policies
-- ordens_servico: equivalent three prototipo policies
-- pecas: equivalent three prototipo policies
-- preventivas: equivalent three prototipo policies
-- gestman_empresas_insert_public: INSERT to anon,authenticated WITH CHECK (true)
-- gestman_usuarios_insert_public: INSERT to anon,authenticated WITH CHECK (true)

-- Tenant policies observed:
-- gm_companies_select_members: gm_is_company_member(id)
-- gm_companies_platform_select/update: gm_is_platform_admin()
-- gm_members_admin_manage: gm_is_company_admin(company_id)
-- gm_members_select_company: gm_is_company_member(company_id)
-- gm_members_platform_select: gm_is_platform_admin()
-- gm_state_company_access: gm_is_company_member(company_id)
-- gm_preferences_own_access: user_id=auth.uid() AND gm_is_company_member(company_id)
-- gm_audit_company_select: gm_is_company_member(company_id)
-- gm_profiles_update_self: user_id=auth.uid()
-- gm_profiles_select_company: shared active company membership
-- gm_platform_admins_self_select: user_id=auth.uid() AND active
-- company_requests_platform_select/update: gm_is_platform_admin()
-- gm_units_tenant_select and gm_subscriptions_tenant_select:
--   gm_is_company_member(company_id) OR gm_is_platform_admin()

