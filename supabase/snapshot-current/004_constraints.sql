-- GestMan365 Supabase snapshot — reference only, captured 2026-07-22.
-- Schema-only. No customer data. Do not apply directly to production.

-- Confirmed dependency groups:
-- gm_companies.created_by -> auth.users.id
-- gm_company_members.company_id -> gm_companies.id
-- gm_company_members.user_id -> auth.users.id
-- gm_profiles.user_id -> auth.users.id
-- gm_tenant_state.company_id -> gm_companies.id
-- gm_tenant_state.updated_by -> auth.users.id
-- gm_user_preferences.company_id -> gm_companies.id
-- gm_user_preferences.user_id -> auth.users.id
-- gm_audit_log.company_id -> gm_companies.id ON DELETE CASCADE
-- gm_audit_log.user_id -> auth.users.id ON DELETE SET NULL
-- company_requests.reviewed_by/converted_by -> auth.users.id ON DELETE SET NULL
-- company_requests.converted_company_id -> gm_companies.id ON DELETE RESTRICT
-- equipamentos.local_instalacao_id -> locais_instalacao.id ON DELETE SET NULL
-- equipamentos.tag_id -> tags.id ON DELETE SET NULL
-- equipamentos.subtag_id -> subtags.id ON DELETE SET NULL
-- ordens_servico.ativo_id -> ativos.id ON DELETE SET NULL
-- ordens_servico.equipamento_id -> equipamentos.id ON DELETE SET NULL (NOT VALID)
-- estoque_saldos.estoque_id -> estoques.id ON DELETE CASCADE
-- estoque_saldos.peca_id -> pecas.id ON DELETE CASCADE
-- eventos_ordem_servico.ordem_servico_id -> ordens_servico.id ON DELETE CASCADE
-- perfil_permissoes -> perfis_acesso/permissoes ON DELETE CASCADE
-- usuarios_empresas -> auth.users/empresas/perfis_acesso

-- Full constraint DDL must be taken from an official schema-only dump.

