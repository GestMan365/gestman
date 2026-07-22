-- GestMan365 Supabase snapshot — reference only, captured 2026-07-22.
-- Schema-only. No customer data. Do not apply directly to production.

-- Sequences confirmed:
-- public.gm_audit_log_id_seq
-- public.gm_platform_audit_log_id_seq
-- public.ordens_servico_numero_seq

-- Important indexes confirmed:
-- company_requests_open_cnpj_uidx: unique CNPJ for open request statuses
-- company_requests_search_idx: lower(trade_name), lower(responsible_email)
-- company_requests_status_created_idx: status, created_at desc
-- gm_audit_log_company_created_idx: company_id, created_at desc
-- gm_platform_audit_created_idx: created_at desc
-- ordens_servico_numero_key: unique(numero)
-- idx_ordens_servico_status: status
-- idx_ordens_servico_data_abertura: data_abertura
-- idx_ordens_servico_equipamento_id: equipamento_id
-- ativos_codigo_key, chamados_numero_key, pecas_codigo_key, tags_codigo_key

-- Every public table has a primary-key or association index where defined.
-- Full index DDL must be taken from an official schema-only dump.

