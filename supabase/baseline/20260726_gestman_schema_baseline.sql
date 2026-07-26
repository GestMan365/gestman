-- GestMan365 Supabase schema baseline
-- Source: schema-only production dump captured 2026-07-26.
-- This file contains schema and security configuration only; no tenant data,
-- users, credentials, project references or managed Supabase schemas.
--
-- Application order:
--   extensions; sequences/tables; constraints/indexes; functions/RPCs;
--   views/triggers; RLS policies; minimum grants; Storage policies.
--
-- The legacy public.gestman_usuarios.senha column is retained temporarily.
-- Direct password writes and legacy login execution are blocked below.

begin;

set local check_function_bodies = false;
set local search_path = pg_catalog, public;


-- ---------------------------------------------------------------------------
-- Extensions owned by the application
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";

-- No user-defined enum or domain exists in schema public.

-- ---------------------------------------------------------------------------
-- Sequences
-- ---------------------------------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS "public"."ordens_servico_numero_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "public"."company_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trade_name" "text" NOT NULL,
    "legal_name" "text" NOT NULL,
    "cnpj" "text" NOT NULL,
    "responsible_name" "text" NOT NULL,
    "responsible_role" "text",
    "responsible_email" "text" NOT NULL,
    "responsible_phone" "text" NOT NULL,
    "city" "text" NOT NULL,
    "state" "text" NOT NULL,
    "estimated_users" integer,
    "estimated_units" integer,
    "message" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "internal_notes" "text",
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "converted_company_id" "uuid",
    "converted_by" "uuid",
    "converted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "notification_email" "text",
    "notification_sent_at" timestamp with time zone,
    "notification_error" "text",
    CONSTRAINT "company_requests_cnpj_check" CHECK (("cnpj" ~ '^[0-9]{14}$'::"text")),
    CONSTRAINT "company_requests_estimated_units_check" CHECK ((("estimated_units" IS NULL) OR (("estimated_units" >= 1) AND ("estimated_units" <= 10000)))),
    CONSTRAINT "company_requests_estimated_users_check" CHECK ((("estimated_users" IS NULL) OR (("estimated_users" >= 1) AND ("estimated_users" <= 100000)))),
    CONSTRAINT "company_requests_legal_name_check" CHECK ((("length"(TRIM(BOTH FROM "legal_name")) >= 2) AND ("length"(TRIM(BOTH FROM "legal_name")) <= 200))),
    CONSTRAINT "company_requests_responsible_name_check" CHECK ((("length"(TRIM(BOTH FROM "responsible_name")) >= 2) AND ("length"(TRIM(BOTH FROM "responsible_name")) <= 160))),
    CONSTRAINT "company_requests_state_check" CHECK (("state" ~ '^[A-Z]{2}$'::"text")),
    CONSTRAINT "company_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'reviewing'::"text", 'approved'::"text", 'rejected'::"text", 'converted'::"text"]))),
    CONSTRAINT "company_requests_trade_name_check" CHECK ((("length"(TRIM(BOTH FROM "trade_name")) >= 2) AND ("length"(TRIM(BOTH FROM "trade_name")) <= 160)))
);

CREATE TABLE IF NOT EXISTS "public"."ativos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "codigo" "text" NOT NULL,
    "nome" "text" NOT NULL,
    "setor" "text" NOT NULL,
    "criticidade" "text" DEFAULT 'Media'::"text" NOT NULL,
    "status" "text" DEFAULT 'Operando'::"text" NOT NULL,
    "responsavel" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."chamados" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "numero" "text" NOT NULL,
    "origem" "text" NOT NULL,
    "descricao" "text" NOT NULL,
    "prioridade" "text" DEFAULT 'Media'::"text" NOT NULL,
    "status" "text" DEFAULT 'Aberto'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."checklists" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "codigo" "text" NOT NULL,
    "equipamento_id" "uuid",
    "nome" "text" NOT NULL,
    "frequencia" "text" DEFAULT 'Mensal'::"text" NOT NULL,
    "ultimo_preenchimento" timestamp with time zone,
    "observacoes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."empresas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" "text" NOT NULL,
    "documento" "text",
    "email" "text",
    "telefone" "text",
    "status" "text" DEFAULT 'Ativa'::"text" NOT NULL,
    "plano" "text" DEFAULT 'GestMan365'::"text" NOT NULL,
    "observacoes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."equipamentos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "codigo" "text" NOT NULL,
    "nome" "text" NOT NULL,
    "local_instalacao_id" "uuid",
    "criticidade" "text" DEFAULT 'Baixa'::"text" NOT NULL,
    "status" "text" DEFAULT 'Operando'::"text" NOT NULL,
    "marca" "text",
    "modelo" "text",
    "imagem_tag" "text" DEFAULT 'geral'::"text" NOT NULL,
    "componentes" "text",
    "descricao" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tag_id" "uuid",
    "subtag_id" "uuid",
    "pos_x" numeric(7,2),
    "pos_y" numeric(7,2)
);

CREATE TABLE IF NOT EXISTS "public"."estoque_saldos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "estoque_id" "uuid" NOT NULL,
    "peca_id" "uuid" NOT NULL,
    "saldo_atual" numeric(12,2) DEFAULT 0 NOT NULL,
    "saldo_minimo" numeric(12,2) DEFAULT 0 NOT NULL,
    "localizacao" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."estoques" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" "text" NOT NULL,
    "localizacao" "text",
    "responsavel" "text",
    "ativo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."eventos_ordem_servico" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ordem_servico_id" "uuid",
    "acao" "text" NOT NULL,
    "usuario" "text",
    "dados" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."fornecedores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "razao_social" "text" NOT NULL,
    "fantasia" "text",
    "cnpj" "text",
    "telefone" "text",
    "email" "text",
    "observacao" "text",
    "ativo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."gestman_empresas" (
    "id" "uuid" NOT NULL,
    "login" "text" NOT NULL,
    "nome" "text" NOT NULL,
    "plano" "text" DEFAULT 'Mensal'::"text" NOT NULL,
    "status" "text" DEFAULT 'Pendente'::"text" NOT NULL,
    "aprovado" boolean DEFAULT false NOT NULL,
    "ativo" boolean DEFAULT true NOT NULL,
    "remote_sync" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."gestman_usuarios" (
    "id" "uuid" NOT NULL,
    "empresa_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "email" "text" NOT NULL,
    "senha" "text" NOT NULL,
    "perfil" "text" DEFAULT 'admin'::"text" NOT NULL,
    "ativo" boolean DEFAULT true NOT NULL,
    "permissoes" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "foto_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."gm_audit_log" (
    "id" bigint NOT NULL,
    "company_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "action" "text" NOT NULL,
    "entity" "text" NOT NULL,
    "entity_id" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."gm_companies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "trade_name" "text",
    "legal_name" "text",
    "cnpj" "text",
    "responsible_name" "text",
    "responsible_email" "text",
    "responsible_phone" "text",
    "city" "text",
    "state" "text",
    "logo_url" "text",
    "last_access_at" timestamp with time zone,
    "archived_at" timestamp with time zone,
    CONSTRAINT "gm_companies_name_check" CHECK ((("length"(TRIM(BOTH FROM "name")) >= 2) AND ("length"(TRIM(BOTH FROM "name")) <= 160))),
    CONSTRAINT "gm_companies_slug_check" CHECK (("slug" ~ '^[a-z0-9][a-z0-9-]{1,62}$'::"text")),
    CONSTRAINT "gm_companies_status_check" CHECK (("status" = ANY (ARRAY['trial'::"text", 'active'::"text", 'suspended'::"text", 'archived'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."gm_company_members" (
    "company_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "access_username" "text",
    "access_profile" "text" DEFAULT 'viewer'::"text" NOT NULL,
    "permission_levels" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "region_id" "text",
    "executor" boolean DEFAULT false NOT NULL,
    CONSTRAINT "gm_company_members_access_profile_check" CHECK (("access_profile" = ANY (ARRAY['admin'::"text", 'supervisor'::"text", 'technician'::"text", 'warehouse'::"text", 'requester'::"text", 'viewer'::"text"]))),
    CONSTRAINT "gm_company_members_role_check" CHECK (("role" = ANY (ARRAY['administrator'::"text", 'planner'::"text", 'supervisor'::"text", 'technician'::"text", 'executor'::"text", 'warehouse'::"text", 'requester'::"text", 'viewer'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."gm_company_subscriptions" (
    "company_id" "uuid" NOT NULL,
    "plan_code" "text" NOT NULL,
    "user_limit" integer NOT NULL,
    "unit_limit" integer NOT NULL,
    "storage_limit_mb" integer NOT NULL,
    "starts_on" "date" NOT NULL,
    "trial_ends_on" "date",
    "status" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "gm_company_subscriptions_plan_code_check" CHECK ((("length"(TRIM(BOTH FROM "plan_code")) >= 2) AND ("length"(TRIM(BOTH FROM "plan_code")) <= 80))),
    CONSTRAINT "gm_company_subscriptions_status_check" CHECK (("status" = ANY (ARRAY['trial'::"text", 'active'::"text", 'suspended'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "gm_company_subscriptions_storage_limit_mb_check" CHECK (("storage_limit_mb" > 0)),
    CONSTRAINT "gm_company_subscriptions_unit_limit_check" CHECK (("unit_limit" > 0)),
    CONSTRAINT "gm_company_subscriptions_user_limit_check" CHECK (("user_limit" > 0))
);

CREATE TABLE IF NOT EXISTS "public"."gm_company_units" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "is_main" boolean DEFAULT false NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "gm_company_units_name_check" CHECK ((("length"(TRIM(BOTH FROM "name")) >= 2) AND ("length"(TRIM(BOTH FROM "name")) <= 160))),
    CONSTRAINT "gm_company_units_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."gm_platform_admins" (
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "gm_platform_admins_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'superadmin'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."gm_platform_audit_log" (
    "id" bigint NOT NULL,
    "actor_user_id" "uuid",
    "action" "text" NOT NULL,
    "entity" "text" NOT NULL,
    "entity_id" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."gm_profiles" (
    "user_id" "uuid" NOT NULL,
    "display_name" "text" NOT NULL,
    "avatar_url" "text",
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "contact_email" "text",
    "job_title" "text",
    "details" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "gm_profiles_display_name_check" CHECK ((("length"(TRIM(BOTH FROM "display_name")) >= 2) AND ("length"(TRIM(BOTH FROM "display_name")) <= 160)))
);

CREATE TABLE IF NOT EXISTS "public"."gm_public_rate_limits" (
    "key_hash" "text" NOT NULL,
    "window_started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "gm_public_rate_limits_attempts_check" CHECK (("attempts" >= 0))
);

CREATE TABLE IF NOT EXISTS "public"."gm_tenant_state" (
    "company_id" "uuid" NOT NULL,
    "state" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "version" bigint DEFAULT 0 NOT NULL,
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "gm_tenant_state_state_check" CHECK (("jsonb_typeof"("state") = 'object'::"text")),
    CONSTRAINT "gm_tenant_state_version_check" CHECK (("version" >= 0))
);

CREATE TABLE IF NOT EXISTS "public"."gm_user_preferences" (
    "company_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "preferences" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "gm_user_preferences_preferences_check" CHECK (("jsonb_typeof"("preferences") = 'object'::"text"))
);

CREATE TABLE IF NOT EXISTS "public"."locais_instalacao" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "regiao_id" "uuid",
    "nome" "text" NOT NULL,
    "tipo" "text" DEFAULT 'Linha'::"text" NOT NULL,
    "ordem" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cor" "text",
    "pos_x" numeric(7,2),
    "pos_y" numeric(7,2),
    "largura" numeric(7,2),
    "altura" numeric(7,2)
);

CREATE TABLE IF NOT EXISTS "public"."movimentacoes_estoque" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "numero" "text",
    "tipo" "text" NOT NULL,
    "estoque_id" "uuid",
    "fornecedor_id" "uuid",
    "status" "text" DEFAULT 'Aberta'::"text" NOT NULL,
    "data_movimentacao" timestamp with time zone DEFAULT "now"() NOT NULL,
    "responsavel" "text",
    "observacao" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."movimentacoes_estoque_itens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "movimentacao_id" "uuid" NOT NULL,
    "peca_id" "uuid" NOT NULL,
    "quantidade" numeric(12,2) NOT NULL,
    "valor_unitario" numeric(12,2) DEFAULT 0 NOT NULL,
    "observacao" "text"
);

CREATE TABLE IF NOT EXISTS "public"."movimentacoes_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "equipamento_id" "uuid",
    "de_local_id" "uuid",
    "para_local_id" "uuid",
    "motivo" "text" NOT NULL,
    "responsavel" "text",
    "data_movimentacao" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."ordens_servico" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "numero" "text" NOT NULL,
    "ativo_id" "uuid",
    "solicitante" "text" NOT NULL,
    "prioridade" "text" DEFAULT 'Media'::"text" NOT NULL,
    "status" "text" DEFAULT 'Aberta'::"text" NOT NULL,
    "tecnico" "text",
    "descricao" "text",
    "custo_estimado" numeric(12,2) DEFAULT 0 NOT NULL,
    "prazo" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "equipamento_id" "uuid",
    "executante" "text",
    "tipo_servico" "text" DEFAULT 'Corretiva'::"text" NOT NULL,
    "tipo_manutencao" "text",
    "comentario" "text",
    "categoria" "text",
    "equipamento_parado" boolean DEFAULT false NOT NULL,
    "pendente_execucao" boolean DEFAULT false NOT NULL,
    "data_abertura" timestamp with time zone,
    "data_inicio" timestamp with time zone,
    "data_fim" timestamp with time zone,
    "mttr_horas" numeric(10,2) DEFAULT 0 NOT NULL,
    "assinatura_nome" "text",
    "assinatura_imagem" "text",
    "epis" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "anexos" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "detalhes" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."pecas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "codigo" "text" NOT NULL,
    "nome" "text" NOT NULL,
    "saldo" numeric(12,2) DEFAULT 0 NOT NULL,
    "saldo_minimo" numeric(12,2) DEFAULT 0 NOT NULL,
    "localizacao" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "fornecedor_id" "uuid",
    "cod_fornecedor" "text",
    "descricao" "text",
    "observacao" "text",
    "unidade" "text" DEFAULT 'UN'::"text" NOT NULL,
    "ativo" boolean DEFAULT true NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."perfil_permissoes" (
    "perfil_id" "uuid" NOT NULL,
    "permissao_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."perfis" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" "text" DEFAULT 'Administrador'::"text" NOT NULL,
    "cargo" "text" DEFAULT 'Administrador'::"text",
    "email" "text",
    "foto_url" "text",
    "tipo" "text" DEFAULT 'admin'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."perfis_acesso" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "codigo" "text" NOT NULL,
    "nome" "text" NOT NULL,
    "descricao" "text",
    "nivel" integer DEFAULT 0 NOT NULL,
    "ativo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."permissoes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "codigo" "text" NOT NULL,
    "modulo" "text" NOT NULL,
    "acao" "text" NOT NULL,
    "descricao" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."preventivas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ativo_id" "uuid",
    "nome" "text" NOT NULL,
    "frequencia" "text" NOT NULL,
    "proxima_execucao" "date",
    "status" "text" DEFAULT 'No prazo'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."regioes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" "text" NOT NULL,
    "descricao" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cor" "text",
    "pos_x" numeric(7,2),
    "pos_y" numeric(7,2),
    "largura" numeric(7,2),
    "altura" numeric(7,2)
);

CREATE TABLE IF NOT EXISTS "public"."requisicoes_materiais" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "numero" "text",
    "estoque_id" "uuid",
    "ordem_servico_id" "uuid",
    "solicitante" "text" NOT NULL,
    "status" "text" DEFAULT 'Aberta'::"text" NOT NULL,
    "data_requisicao" timestamp with time zone DEFAULT "now"() NOT NULL,
    "observacao" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."requisicoes_materiais_itens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "requisicao_id" "uuid" NOT NULL,
    "peca_id" "uuid" NOT NULL,
    "quantidade" numeric(12,2) NOT NULL,
    "observacao" "text"
);

CREATE TABLE IF NOT EXISTS "public"."subtags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tag_id" "uuid",
    "codigo" "text" NOT NULL,
    "nome" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."subtags_equipamento" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "equipamento_id" "uuid",
    "codigo" "text" NOT NULL,
    "nome" "text" NOT NULL,
    "tipo" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "codigo" "text" NOT NULL,
    "nome" "text" NOT NULL,
    "descricao" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."transferencias_estoque" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "estoque_origem_id" "uuid",
    "estoque_destino_id" "uuid",
    "responsavel" "text",
    "status" "text" DEFAULT 'Aberta'::"text" NOT NULL,
    "data_transferencia" timestamp with time zone DEFAULT "now"() NOT NULL,
    "observacao" "text"
);

CREATE TABLE IF NOT EXISTS "public"."transferencias_estoque_itens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "transferencia_id" "uuid" NOT NULL,
    "peca_id" "uuid" NOT NULL,
    "quantidade" numeric(12,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."usuarios_empresas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "auth_user_id" "uuid",
    "empresa_id" "uuid" NOT NULL,
    "perfil_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "email" "text" NOT NULL,
    "telefone" "text",
    "cargo" "text",
    "foto_url" "text",
    "ativo" boolean DEFAULT true NOT NULL,
    "ultimo_acesso" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

-- ---------------------------------------------------------------------------
-- Sequence ownership, identity/defaults and column comments
-- ---------------------------------------------------------------------------

COMMENT ON COLUMN "public"."company_requests"."notification_email" IS 'Destinatario interno da notificacao de nova solicitacao.';

COMMENT ON COLUMN "public"."company_requests"."notification_sent_at" IS 'Data e hora em que o provedor confirmou o envio da notificacao.';

COMMENT ON COLUMN "public"."company_requests"."notification_error" IS 'Ultimo erro do provedor de e-mail, sem dados secretos.';

ALTER TABLE "public"."gm_audit_log" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."gm_audit_log_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

ALTER TABLE "public"."gm_platform_audit_log" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."gm_platform_audit_log_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

-- ---------------------------------------------------------------------------
-- Primary, unique and check constraints
-- ---------------------------------------------------------------------------

ALTER TABLE ONLY "public"."ativos"
    ADD CONSTRAINT "ativos_codigo_key" UNIQUE ("codigo");

ALTER TABLE ONLY "public"."ativos"
    ADD CONSTRAINT "ativos_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."chamados"
    ADD CONSTRAINT "chamados_numero_key" UNIQUE ("numero");

ALTER TABLE ONLY "public"."chamados"
    ADD CONSTRAINT "chamados_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."checklists"
    ADD CONSTRAINT "checklists_codigo_key" UNIQUE ("codigo");

ALTER TABLE ONLY "public"."checklists"
    ADD CONSTRAINT "checklists_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."company_requests"
    ADD CONSTRAINT "company_requests_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."empresas"
    ADD CONSTRAINT "empresas_nome_key" UNIQUE ("nome");

ALTER TABLE ONLY "public"."empresas"
    ADD CONSTRAINT "empresas_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."equipamentos"
    ADD CONSTRAINT "equipamentos_codigo_key" UNIQUE ("codigo");

ALTER TABLE ONLY "public"."equipamentos"
    ADD CONSTRAINT "equipamentos_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."estoque_saldos"
    ADD CONSTRAINT "estoque_saldos_estoque_id_peca_id_key" UNIQUE ("estoque_id", "peca_id");

ALTER TABLE ONLY "public"."estoque_saldos"
    ADD CONSTRAINT "estoque_saldos_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."estoques"
    ADD CONSTRAINT "estoques_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."eventos_ordem_servico"
    ADD CONSTRAINT "eventos_ordem_servico_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."fornecedores"
    ADD CONSTRAINT "fornecedores_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."gestman_empresas"
    ADD CONSTRAINT "gestman_empresas_login_key" UNIQUE ("login");

ALTER TABLE ONLY "public"."gestman_empresas"
    ADD CONSTRAINT "gestman_empresas_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."gestman_usuarios"
    ADD CONSTRAINT "gestman_usuarios_empresa_id_email_key" UNIQUE ("empresa_id", "email");

ALTER TABLE ONLY "public"."gestman_usuarios"
    ADD CONSTRAINT "gestman_usuarios_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."gm_audit_log"
    ADD CONSTRAINT "gm_audit_log_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."gm_companies"
    ADD CONSTRAINT "gm_companies_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."gm_companies"
    ADD CONSTRAINT "gm_companies_slug_key" UNIQUE ("slug");

ALTER TABLE ONLY "public"."gm_company_members"
    ADD CONSTRAINT "gm_company_members_pkey" PRIMARY KEY ("company_id", "user_id");

ALTER TABLE ONLY "public"."gm_company_subscriptions"
    ADD CONSTRAINT "gm_company_subscriptions_pkey" PRIMARY KEY ("company_id");

ALTER TABLE ONLY "public"."gm_company_units"
    ADD CONSTRAINT "gm_company_units_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."gm_platform_admins"
    ADD CONSTRAINT "gm_platform_admins_pkey" PRIMARY KEY ("user_id");

ALTER TABLE ONLY "public"."gm_platform_audit_log"
    ADD CONSTRAINT "gm_platform_audit_log_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."gm_profiles"
    ADD CONSTRAINT "gm_profiles_pkey" PRIMARY KEY ("user_id");

ALTER TABLE ONLY "public"."gm_public_rate_limits"
    ADD CONSTRAINT "gm_public_rate_limits_pkey" PRIMARY KEY ("key_hash");
ALTER TABLE ONLY "public"."gm_tenant_state"
    ADD CONSTRAINT "gm_tenant_state_pkey" PRIMARY KEY ("company_id");

ALTER TABLE ONLY "public"."gm_user_preferences"
    ADD CONSTRAINT "gm_user_preferences_pkey" PRIMARY KEY ("company_id", "user_id");

ALTER TABLE ONLY "public"."locais_instalacao"
    ADD CONSTRAINT "locais_instalacao_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."locais_instalacao"
    ADD CONSTRAINT "locais_instalacao_regiao_id_nome_key" UNIQUE ("regiao_id", "nome");

ALTER TABLE ONLY "public"."movimentacoes_estoque_itens"
    ADD CONSTRAINT "movimentacoes_estoque_itens_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."movimentacoes_estoque"
    ADD CONSTRAINT "movimentacoes_estoque_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."movimentacoes_tags"
    ADD CONSTRAINT "movimentacoes_tags_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."ordens_servico"
    ADD CONSTRAINT "ordens_servico_numero_key" UNIQUE ("numero");

ALTER TABLE ONLY "public"."ordens_servico"
    ADD CONSTRAINT "ordens_servico_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."pecas"
    ADD CONSTRAINT "pecas_codigo_key" UNIQUE ("codigo");

ALTER TABLE ONLY "public"."pecas"
    ADD CONSTRAINT "pecas_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."perfil_permissoes"
    ADD CONSTRAINT "perfil_permissoes_pkey" PRIMARY KEY ("perfil_id", "permissao_id");

ALTER TABLE ONLY "public"."perfis_acesso"
    ADD CONSTRAINT "perfis_acesso_codigo_key" UNIQUE ("codigo");

ALTER TABLE ONLY "public"."perfis_acesso"
    ADD CONSTRAINT "perfis_acesso_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."perfis"
    ADD CONSTRAINT "perfis_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."permissoes"
    ADD CONSTRAINT "permissoes_codigo_key" UNIQUE ("codigo");

ALTER TABLE ONLY "public"."permissoes"
    ADD CONSTRAINT "permissoes_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."preventivas"
    ADD CONSTRAINT "preventivas_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."regioes"
    ADD CONSTRAINT "regioes_nome_key" UNIQUE ("nome");

ALTER TABLE ONLY "public"."regioes"
    ADD CONSTRAINT "regioes_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."requisicoes_materiais_itens"
    ADD CONSTRAINT "requisicoes_materiais_itens_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."requisicoes_materiais"
    ADD CONSTRAINT "requisicoes_materiais_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."subtags_equipamento"
    ADD CONSTRAINT "subtags_equipamento_equipamento_id_codigo_key" UNIQUE ("equipamento_id", "codigo");

ALTER TABLE ONLY "public"."subtags_equipamento"
    ADD CONSTRAINT "subtags_equipamento_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."subtags"
    ADD CONSTRAINT "subtags_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."subtags"
    ADD CONSTRAINT "subtags_tag_id_codigo_key" UNIQUE ("tag_id", "codigo");

ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_codigo_key" UNIQUE ("codigo");

ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."transferencias_estoque_itens"
    ADD CONSTRAINT "transferencias_estoque_itens_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."transferencias_estoque"
    ADD CONSTRAINT "transferencias_estoque_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."usuarios_empresas"
    ADD CONSTRAINT "usuarios_empresas_empresa_id_email_key" UNIQUE ("empresa_id", "email");

ALTER TABLE ONLY "public"."usuarios_empresas"
    ADD CONSTRAINT "usuarios_empresas_pkey" PRIMARY KEY ("id");

-- ---------------------------------------------------------------------------
-- Foreign keys
-- ---------------------------------------------------------------------------

ALTER TABLE ONLY "public"."checklists"
    ADD CONSTRAINT "checklists_equipamento_id_fkey" FOREIGN KEY ("equipamento_id") REFERENCES "public"."equipamentos"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."company_requests"
    ADD CONSTRAINT "company_requests_converted_by_fkey" FOREIGN KEY ("converted_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."company_requests"
    ADD CONSTRAINT "company_requests_converted_company_id_fkey" FOREIGN KEY ("converted_company_id") REFERENCES "public"."gm_companies"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."company_requests"
    ADD CONSTRAINT "company_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."equipamentos"
    ADD CONSTRAINT "equipamentos_local_instalacao_id_fkey" FOREIGN KEY ("local_instalacao_id") REFERENCES "public"."locais_instalacao"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."equipamentos"
    ADD CONSTRAINT "equipamentos_subtag_id_fkey" FOREIGN KEY ("subtag_id") REFERENCES "public"."subtags"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."equipamentos"
    ADD CONSTRAINT "equipamentos_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."estoque_saldos"
    ADD CONSTRAINT "estoque_saldos_estoque_id_fkey" FOREIGN KEY ("estoque_id") REFERENCES "public"."estoques"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."estoque_saldos"
    ADD CONSTRAINT "estoque_saldos_peca_id_fkey" FOREIGN KEY ("peca_id") REFERENCES "public"."pecas"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."eventos_ordem_servico"
    ADD CONSTRAINT "eventos_ordem_servico_ordem_servico_id_fkey" FOREIGN KEY ("ordem_servico_id") REFERENCES "public"."ordens_servico"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."gestman_usuarios"
    ADD CONSTRAINT "gestman_usuarios_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."gestman_empresas"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."gm_audit_log"
    ADD CONSTRAINT "gm_audit_log_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."gm_companies"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."gm_audit_log"
    ADD CONSTRAINT "gm_audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."gm_companies"
    ADD CONSTRAINT "gm_companies_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."gm_company_members"
    ADD CONSTRAINT "gm_company_members_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."gm_companies"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."gm_company_members"
    ADD CONSTRAINT "gm_company_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."gm_company_subscriptions"
    ADD CONSTRAINT "gm_company_subscriptions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."gm_companies"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."gm_company_units"
    ADD CONSTRAINT "gm_company_units_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."gm_companies"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."gm_platform_admins"
    ADD CONSTRAINT "gm_platform_admins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."gm_platform_audit_log"
    ADD CONSTRAINT "gm_platform_audit_log_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."gm_profiles"
    ADD CONSTRAINT "gm_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."gm_tenant_state"
    ADD CONSTRAINT "gm_tenant_state_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."gm_companies"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."gm_tenant_state"
    ADD CONSTRAINT "gm_tenant_state_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."gm_user_preferences"
    ADD CONSTRAINT "gm_user_preferences_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."gm_companies"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."gm_user_preferences"
    ADD CONSTRAINT "gm_user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."locais_instalacao"
    ADD CONSTRAINT "locais_instalacao_regiao_id_fkey" FOREIGN KEY ("regiao_id") REFERENCES "public"."regioes"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."movimentacoes_estoque"
    ADD CONSTRAINT "movimentacoes_estoque_estoque_id_fkey" FOREIGN KEY ("estoque_id") REFERENCES "public"."estoques"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."movimentacoes_estoque"
    ADD CONSTRAINT "movimentacoes_estoque_fornecedor_id_fkey" FOREIGN KEY ("fornecedor_id") REFERENCES "public"."fornecedores"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."movimentacoes_estoque_itens"
    ADD CONSTRAINT "movimentacoes_estoque_itens_movimentacao_id_fkey" FOREIGN KEY ("movimentacao_id") REFERENCES "public"."movimentacoes_estoque"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."movimentacoes_estoque_itens"
    ADD CONSTRAINT "movimentacoes_estoque_itens_peca_id_fkey" FOREIGN KEY ("peca_id") REFERENCES "public"."pecas"("id") ON DELETE RESTRICT;
ALTER TABLE ONLY "public"."movimentacoes_tags"
    ADD CONSTRAINT "movimentacoes_tags_de_local_id_fkey" FOREIGN KEY ("de_local_id") REFERENCES "public"."locais_instalacao"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."movimentacoes_tags"
    ADD CONSTRAINT "movimentacoes_tags_equipamento_id_fkey" FOREIGN KEY ("equipamento_id") REFERENCES "public"."equipamentos"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."movimentacoes_tags"
    ADD CONSTRAINT "movimentacoes_tags_para_local_id_fkey" FOREIGN KEY ("para_local_id") REFERENCES "public"."locais_instalacao"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."ordens_servico"
    ADD CONSTRAINT "ordens_servico_ativo_id_fkey" FOREIGN KEY ("ativo_id") REFERENCES "public"."ativos"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."ordens_servico"
    ADD CONSTRAINT "ordens_servico_equipamento_id_fkey" FOREIGN KEY ("equipamento_id") REFERENCES "public"."equipamentos"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."pecas"
    ADD CONSTRAINT "pecas_fornecedor_id_fkey" FOREIGN KEY ("fornecedor_id") REFERENCES "public"."fornecedores"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."perfil_permissoes"
    ADD CONSTRAINT "perfil_permissoes_perfil_id_fkey" FOREIGN KEY ("perfil_id") REFERENCES "public"."perfis_acesso"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."perfil_permissoes"
    ADD CONSTRAINT "perfil_permissoes_permissao_id_fkey" FOREIGN KEY ("permissao_id") REFERENCES "public"."permissoes"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."preventivas"
    ADD CONSTRAINT "preventivas_ativo_id_fkey" FOREIGN KEY ("ativo_id") REFERENCES "public"."ativos"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."requisicoes_materiais"
    ADD CONSTRAINT "requisicoes_materiais_estoque_id_fkey" FOREIGN KEY ("estoque_id") REFERENCES "public"."estoques"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."requisicoes_materiais_itens"
    ADD CONSTRAINT "requisicoes_materiais_itens_peca_id_fkey" FOREIGN KEY ("peca_id") REFERENCES "public"."pecas"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."requisicoes_materiais_itens"
    ADD CONSTRAINT "requisicoes_materiais_itens_requisicao_id_fkey" FOREIGN KEY ("requisicao_id") REFERENCES "public"."requisicoes_materiais"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."requisicoes_materiais"
    ADD CONSTRAINT "requisicoes_materiais_ordem_servico_id_fkey" FOREIGN KEY ("ordem_servico_id") REFERENCES "public"."ordens_servico"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."subtags_equipamento"
    ADD CONSTRAINT "subtags_equipamento_equipamento_id_fkey" FOREIGN KEY ("equipamento_id") REFERENCES "public"."equipamentos"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."subtags"
    ADD CONSTRAINT "subtags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."transferencias_estoque"
    ADD CONSTRAINT "transferencias_estoque_estoque_destino_id_fkey" FOREIGN KEY ("estoque_destino_id") REFERENCES "public"."estoques"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."transferencias_estoque"
    ADD CONSTRAINT "transferencias_estoque_estoque_origem_id_fkey" FOREIGN KEY ("estoque_origem_id") REFERENCES "public"."estoques"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."transferencias_estoque_itens"
    ADD CONSTRAINT "transferencias_estoque_itens_peca_id_fkey" FOREIGN KEY ("peca_id") REFERENCES "public"."pecas"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."transferencias_estoque_itens"
    ADD CONSTRAINT "transferencias_estoque_itens_transferencia_id_fkey" FOREIGN KEY ("transferencia_id") REFERENCES "public"."transferencias_estoque"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."usuarios_empresas"
    ADD CONSTRAINT "usuarios_empresas_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."usuarios_empresas"
    ADD CONSTRAINT "usuarios_empresas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."usuarios_empresas"
    ADD CONSTRAINT "usuarios_empresas_perfil_id_fkey" FOREIGN KEY ("perfil_id") REFERENCES "public"."perfis_acesso"("id") ON DELETE RESTRICT;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX "company_requests_open_cnpj_uidx" ON "public"."company_requests" USING "btree" ("cnpj") WHERE ("status" = ANY (ARRAY['pending'::"text", 'reviewing'::"text", 'approved'::"text", 'converted'::"text"]));

CREATE INDEX "company_requests_search_idx" ON "public"."company_requests" USING "btree" ("lower"("trade_name"), "lower"("responsible_email"));

CREATE INDEX "company_requests_status_created_idx" ON "public"."company_requests" USING "btree" ("status", "created_at" DESC);

CREATE INDEX "gestman_empresas_login_idx" ON "public"."gestman_empresas" USING "btree" ("login");

CREATE INDEX "gestman_usuarios_empresa_idx" ON "public"."gestman_usuarios" USING "btree" ("empresa_id");

CREATE INDEX "gm_audit_log_company_created_idx" ON "public"."gm_audit_log" USING "btree" ("company_id", "created_at" DESC);

CREATE UNIQUE INDEX "gm_companies_cnpj_uidx" ON "public"."gm_companies" USING "btree" ("cnpj") WHERE ("cnpj" IS NOT NULL);

CREATE UNIQUE INDEX "gm_company_members_company_username_uidx" ON "public"."gm_company_members" USING "btree" ("company_id", "lower"("access_username")) WHERE (("access_username" IS NOT NULL) AND (TRIM(BOTH FROM "access_username") <> ''::"text"));

CREATE INDEX "gm_company_members_user_idx" ON "public"."gm_company_members" USING "btree" ("user_id") WHERE "active";

CREATE UNIQUE INDEX "gm_company_units_one_main_uidx" ON "public"."gm_company_units" USING "btree" ("company_id") WHERE "is_main";

CREATE INDEX "gm_platform_audit_created_idx" ON "public"."gm_platform_audit_log" USING "btree" ("created_at" DESC);

CREATE INDEX "idx_equipamentos_subtag_id" ON "public"."equipamentos" USING "btree" ("subtag_id");

CREATE INDEX "idx_equipamentos_tag_id" ON "public"."equipamentos" USING "btree" ("tag_id");

CREATE INDEX "idx_ordens_servico_data_abertura" ON "public"."ordens_servico" USING "btree" ("data_abertura");

CREATE INDEX "idx_ordens_servico_equipamento_id" ON "public"."ordens_servico" USING "btree" ("equipamento_id");

CREATE INDEX "idx_ordens_servico_status" ON "public"."ordens_servico" USING "btree" ("status");

CREATE INDEX "idx_subtags_tag_id" ON "public"."subtags" USING "btree" ("tag_id");

CREATE INDEX "idx_usuarios_empresas_auth_user_id" ON "public"."usuarios_empresas" USING "btree" ("auth_user_id");

CREATE INDEX "idx_usuarios_empresas_empresa_id" ON "public"."usuarios_empresas" USING "btree" ("empresa_id");

CREATE INDEX "idx_usuarios_empresas_perfil_id" ON "public"."usuarios_empresas" USING "btree" ("perfil_id");

-- ---------------------------------------------------------------------------
-- Authorization helpers, functions and RPCs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION "public"."gestman365_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."gestman_login"("p_login" "text", "p_email" "text", "p_senha" "text") RETURNS TABLE("empresa_id" "uuid", "empresa_login" "text", "empresa_nome" "text", "empresa_plano" "text", "empresa_status" "text", "empresa_aprovado" boolean, "empresa_remote_sync" boolean, "usuario_id" "uuid", "usuario_nome" "text", "usuario_email" "text", "usuario_perfil" "text", "usuario_ativo" boolean, "usuario_permissoes" "jsonb", "usuario_foto_url" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select e.id, e.login, e.nome, e.plano, e.status, e.aprovado, e.remote_sync,
         u.id, u.nome, u.email, u.perfil, u.ativo, u.permissoes, u.foto_url
  from public.gestman_empresas e
  join public.gestman_usuarios u on u.empresa_id = e.id
  where lower(e.login) = lower(coalesce(p_login, ''))
    and lower(u.email) = lower(coalesce(p_email, ''))
    and lower(u.senha) = lower(coalesce(p_senha, ''))
    and e.ativo = true and u.ativo = true
  limit 1;
$$;

CREATE OR REPLACE FUNCTION "public"."gm365_insert_evento_os"("p_ordem_id" "uuid", "p_acao" "text", "p_usuario" "text", "p_dados" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.eventos_ordem_servico (ordem_servico_id, acao, usuario, dados)
  select p_ordem_id, p_acao, coalesce(nullif(p_usuario, ''), 'Sistema'), coalesce(p_dados, '{}'::jsonb)
  where not exists (
    select 1
    from public.eventos_ordem_servico e
    where e.ordem_servico_id = p_ordem_id
      and e.acao = p_acao
  );
end;
$$;

CREATE OR REPLACE FUNCTION "public"."gm365_registrar_evento_os"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_acao text;
  v_usuario text;
begin
  if tg_op = 'INSERT' then
    v_acao := 'CRIADA';
  elsif tg_op = 'UPDATE' then
    if old.data_inicio is null and new.data_inicio is not null then
      v_acao := 'INICIADA';
    elsif old.data_fim is null and new.data_fim is not null then
      v_acao := 'FINALIZADA';
    elsif lower(coalesce(old.status, '')) <> lower(coalesce(new.status, '')) then
      if lower(coalesce(new.status, '')) in ('em execucao', 'em execução') then
        v_acao := 'INICIADA';
      elsif lower(coalesce(new.status, '')) in ('concluida', 'concluída') then
        v_acao := 'FINALIZADA';
      else
        return new;
      end if;
    else
      return new;
    end if;
  else
    return new;
  end if;

  v_usuario := coalesce(nullif(new.executante, ''), nullif(new.tecnico, ''), nullif(new.solicitante, ''), 'Sistema');
  perform public.gm365_insert_evento_os(new.id, v_acao, v_usuario, jsonb_build_object(
    'numero', new.numero,
    'status', new.status,
    'solicitante', new.solicitante,
    'executante', coalesce(new.executante, new.tecnico),
    'data_abertura', coalesce(new.data_abertura, new.created_at),
    'data_inicio', new.data_inicio,
    'data_fim', new.data_fim
  ));
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."gm_access_level_rank"("p_level" "text") RETURNS integer
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select case lower(coalesce(p_level, 'none'))
    when 'view' then 1
    when 'operate' then 2
    when 'manage' then 3
    else 0
  end;
$$;

CREATE OR REPLACE FUNCTION "public"."gm_array_removes_records"("p_old" "jsonb", "p_new" "jsonb") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select case
    when jsonb_typeof(p_old) <> 'array' or jsonb_typeof(p_new) <> 'array' then false
    when jsonb_array_length(p_new) < jsonb_array_length(p_old) then true
    else exists (
      select 1
      from jsonb_array_elements(p_old) old_item
      where jsonb_typeof(old_item) = 'object'
        and nullif(old_item ->> 'id', '') is not null
        and not exists (
          select 1 from jsonb_array_elements(p_new) new_item
          where new_item ->> 'id' = old_item ->> 'id'
        )
    )
  end;
$$;

CREATE OR REPLACE FUNCTION "public"."gm_bootstrap_company"("p_name" "text", "p_slug" "text", "p_display_name" "text") RETURNS TABLE("company_id" "uuid", "company_name" "text", "company_slug" "text", "member_role" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  v_user_id uuid := auth.uid();
  v_company public.gm_companies%rowtype;
  v_slug text := lower(trim(p_slug));
begin
  if v_user_id is null then raise exception 'GM_AUTH_REQUIRED'; end if;
  if exists (select 1 from public.gm_company_members where user_id = v_user_id) then
    raise exception 'GM_USER_ALREADY_HAS_COMPANY';
  end if;
  if trim(coalesce(p_name, '')) = '' or trim(coalesce(p_display_name, '')) = '' then
    raise exception 'GM_REQUIRED_FIELDS';
  end if;
  if v_slug !~ '^[a-z0-9][a-z0-9-]{1,62}$' then raise exception 'GM_INVALID_SLUG'; end if;

  insert into public.gm_companies(name, slug, created_by)
  values (trim(p_name), v_slug, v_user_id)
  returning * into v_company;

  insert into public.gm_profiles(user_id, display_name)
  values (v_user_id, trim(p_display_name))
  on conflict (user_id) do update set display_name = excluded.display_name, active = true;

  insert into public.gm_company_members(company_id, user_id, role)
  values (v_company.id, v_user_id, 'administrator');

  insert into public.gm_tenant_state(company_id, state, updated_by)
  values (v_company.id, '{}'::jsonb, v_user_id);

  insert into public.gm_user_preferences(company_id, user_id)
  values (v_company.id, v_user_id);

  insert into public.gm_audit_log(company_id, user_id, action, entity, entity_id)
  values (v_company.id, v_user_id, 'company.bootstrap', 'company', v_company.id::text);

  return query select v_company.id, v_company.name, v_company.slug, 'administrator'::text;
end;
$_$;

CREATE OR REPLACE FUNCTION "public"."gm_company_slug"("p_name" "text", "p_cnpj" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  select left(trim(both '-' from regexp_replace(lower(translate(coalesce(p_name,'empresa'),
    'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc')), '[^a-z0-9]+','-','g')),48)
    || '-' || right(regexp_replace(coalesce(p_cnpj,''),'[^0-9]','','g'),6);
$$;

CREATE OR REPLACE FUNCTION "public"."gm_consume_public_rate_limit"("p_key_hash" "text", "p_limit" integer, "p_window_seconds" integer) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_row public.gm_public_rate_limits;
  v_now timestamptz := now();
begin
  if length(trim(coalesce(p_key_hash, ''))) < 32
     or p_limit < 1 or p_limit > 1000
     or p_window_seconds < 60 or p_window_seconds > 604800 then
    raise exception 'GM_INVALID_RATE_LIMIT';
  end if;

  insert into public.gm_public_rate_limits(key_hash, window_started_at, attempts, updated_at)
  values (p_key_hash, v_now, 0, v_now)
  on conflict (key_hash) do nothing;

  select * into v_row
  from public.gm_public_rate_limits
  where key_hash = p_key_hash
  for update;

  if v_row.window_started_at + make_interval(secs => p_window_seconds) <= v_now then
    update public.gm_public_rate_limits
    set window_started_at = v_now, attempts = 1, updated_at = v_now
    where key_hash = p_key_hash;
    return true;
  end if;

  if v_row.attempts >= p_limit then return false; end if;
  update public.gm_public_rate_limits
  set attempts = attempts + 1, updated_at = v_now
  where key_hash = p_key_hash;
  return true;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."gm_convert_company_request_internal"("p_request_id" "uuid", "p_actor_user_id" "uuid", "p_admin_user_id" "uuid", "p_plan_code" "text", "p_user_limit" integer, "p_unit_limit" integer, "p_storage_limit_mb" integer, "p_starts_on" "date", "p_trial_ends_on" "date", "p_initial_status" "text", "p_main_unit_name" "text", "p_admin_name" "text", "p_admin_email" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_req public.company_requests; v_company_id uuid; v_slug text;
begin
  if not public.gm_is_platform_admin(p_actor_user_id) then raise exception 'Acesso negado.' using errcode='42501'; end if;
  if p_initial_status not in ('trial','active','suspended') then raise exception 'Status inicial invalido.' using errcode='22023'; end if;
  if p_user_limit < 1 or p_unit_limit < 1 or p_storage_limit_mb < 1 then raise exception 'Limites invalidos.' using errcode='22023'; end if;
  select * into v_req from public.company_requests where id=p_request_id for update;
  if not found then raise exception 'Solicitacao nao encontrada.' using errcode='P0002'; end if;
  if v_req.status='converted' or v_req.converted_company_id is not null then raise exception 'Solicitacao ja convertida.' using errcode='23505'; end if;
  if v_req.status <> 'approved' then raise exception 'A solicitacao precisa estar aprovada.' using errcode='22023'; end if;
  if exists(select 1 from public.gm_companies where cnpj=v_req.cnpj) then raise exception 'Empresa ja cadastrada.' using errcode='23505'; end if;

  v_slug := public.gm_company_slug(v_req.trade_name,v_req.cnpj);
  insert into public.gm_companies(name,slug,status,created_by,trade_name,legal_name,cnpj,
    responsible_name,responsible_email,responsible_phone,city,state)
  values(v_req.trade_name,v_slug,p_initial_status,p_actor_user_id,v_req.trade_name,v_req.legal_name,v_req.cnpj,
    v_req.responsible_name,v_req.responsible_email,v_req.responsible_phone,v_req.city,v_req.state)
  returning id into v_company_id;

  insert into public.gm_company_units(company_id,name,is_main) values(v_company_id,trim(p_main_unit_name),true);
  insert into public.gm_company_subscriptions(company_id,plan_code,user_limit,unit_limit,storage_limit_mb,starts_on,trial_ends_on,status)
  values(v_company_id,trim(p_plan_code),p_user_limit,p_unit_limit,p_storage_limit_mb,p_starts_on,p_trial_ends_on,
    case when p_initial_status='trial' then 'trial' when p_initial_status='suspended' then 'suspended' else 'active' end);
  insert into public.gm_profiles(user_id,display_name,active) values(p_admin_user_id,trim(p_admin_name),true)
    on conflict(user_id) do update set display_name=excluded.display_name,active=true,updated_at=now();
  insert into public.gm_company_members(company_id,user_id,role,active)
    values(v_company_id,p_admin_user_id,'administrator',true);
  insert into public.gm_tenant_state(company_id,state,version,updated_by)
    values(v_company_id,'{}'::jsonb,0,p_actor_user_id) on conflict(company_id) do nothing;
  insert into public.gm_user_preferences(company_id,user_id,preferences)
    values(v_company_id,p_admin_user_id,'{}'::jsonb) on conflict(company_id,user_id) do nothing;

  update public.company_requests set status='converted',converted_company_id=v_company_id,
    converted_by=p_actor_user_id,converted_at=now(),reviewed_by=coalesce(reviewed_by,p_actor_user_id),
    reviewed_at=coalesce(reviewed_at,now()) where id=p_request_id;
  insert into public.gm_platform_audit_log(actor_user_id,action,entity,entity_id,metadata)
    values(p_actor_user_id,'company_request.converted','company',v_company_id::text,
      jsonb_build_object('request_id',p_request_id,'plan',p_plan_code,'admin_email',lower(trim(p_admin_email))));
  return v_company_id;
exception when unique_violation then
  raise exception 'Solicitacao ou empresa ja convertida.' using errcode='23505';
end;
$$;

CREATE OR REPLACE FUNCTION "public"."gm_convert_company_request_with_access_internal"("p_request_id" "uuid", "p_actor_user_id" "uuid", "p_admin_user_id" "uuid", "p_company_slug" "text", "p_plan_code" "text", "p_user_limit" integer, "p_unit_limit" integer, "p_storage_limit_mb" integer, "p_starts_on" "date", "p_trial_ends_on" "date", "p_initial_status" "text", "p_main_unit_name" "text", "p_admin_name" "text", "p_admin_email" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  v_req public.company_requests;
  v_company_id uuid;
  v_slug text := lower(trim(p_company_slug));
begin
  if not public.gm_is_platform_admin(p_actor_user_id) then
    raise exception 'Acesso negado.' using errcode='42501';
  end if;
  if v_slug !~ '^[a-z0-9][a-z0-9-]{2,47}$' then
    raise exception 'Dominio invalido.' using errcode='22023';
  end if;
  if p_initial_status not in ('trial','active','suspended') then
    raise exception 'Status inicial invalido.' using errcode='22023';
  end if;
  if p_user_limit < 1 or p_unit_limit < 1 or p_storage_limit_mb < 1 then
    raise exception 'Limites invalidos.' using errcode='22023';
  end if;

  select * into v_req
  from public.company_requests
  where id=p_request_id
  for update;
  if not found then
    raise exception 'Solicitacao nao encontrada.' using errcode='P0002';
  end if;
  if v_req.status='converted' or v_req.converted_company_id is not null then
    raise exception 'Solicitacao ja convertida.' using errcode='23505';
  end if;
  if v_req.status <> 'approved' then
    raise exception 'A solicitacao precisa estar aprovada.' using errcode='22023';
  end if;
  if exists(select 1 from public.gm_companies where cnpj=v_req.cnpj or slug=v_slug) then
    raise exception 'Empresa ou dominio ja cadastrado.' using errcode='23505';
  end if;

  insert into public.gm_companies(
    name,slug,status,created_by,trade_name,legal_name,cnpj,
    responsible_name,responsible_email,responsible_phone,city,state
  )
  values(
    v_req.trade_name,v_slug,p_initial_status,p_actor_user_id,v_req.trade_name,v_req.legal_name,v_req.cnpj,
    v_req.responsible_name,v_req.responsible_email,v_req.responsible_phone,v_req.city,v_req.state
  )
  returning id into v_company_id;

  insert into public.gm_company_units(company_id,name,is_main)
  values(v_company_id,trim(p_main_unit_name),true);

  insert into public.gm_company_subscriptions(
    company_id,plan_code,user_limit,unit_limit,storage_limit_mb,starts_on,trial_ends_on,status
  )
  values(
    v_company_id,trim(p_plan_code),p_user_limit,p_unit_limit,p_storage_limit_mb,p_starts_on,p_trial_ends_on,
    case when p_initial_status='trial' then 'trial'
         when p_initial_status='suspended' then 'suspended'
         else 'active' end
  );

  insert into public.gm_profiles(user_id,display_name,active)
  values(p_admin_user_id,trim(p_admin_name),true)
  on conflict(user_id) do update
    set display_name=excluded.display_name,active=true,updated_at=now();

  insert into public.gm_company_members(company_id,user_id,role,active)
  values(v_company_id,p_admin_user_id,'administrator',true);

  insert into public.gm_tenant_state(company_id,state,version,updated_by)
  values(v_company_id,'{}'::jsonb,0,p_actor_user_id)
  on conflict(company_id) do nothing;

  insert into public.gm_user_preferences(company_id,user_id,preferences)
  values(v_company_id,p_admin_user_id,'{}'::jsonb)
  on conflict(company_id,user_id) do nothing;

  update public.company_requests
  set status='converted',
      converted_company_id=v_company_id,
      converted_by=p_actor_user_id,
      converted_at=now(),
      reviewed_by=coalesce(reviewed_by,p_actor_user_id),
      reviewed_at=coalesce(reviewed_at,now())
  where id=p_request_id;

  insert into public.gm_platform_audit_log(actor_user_id,action,entity,entity_id,metadata)
  values(
    p_actor_user_id,
    'company_request.converted',
    'company',
    v_company_id::text,
    jsonb_build_object(
      'request_id',p_request_id,
      'plan',p_plan_code,
      'admin_email',lower(trim(p_admin_email)),
      'company_slug',v_slug,
      'email_sent',false
    )
  );

  return v_company_id;
exception when unique_violation then
  raise exception 'Solicitacao, empresa ou dominio ja convertido.' using errcode='23505';
end;
$_$;

CREATE OR REPLACE FUNCTION "public"."gm_current_context"() RETURNS TABLE("company_id" "uuid", "company_name" "text", "company_slug" "text", "company_status" "text", "user_id" "uuid", "user_email" "text", "display_name" "text", "member_role" "text", "access_username" "text", "access_profile" "text", "permission_levels" "jsonb", "region_id" "text", "executor" boolean, "contact_email" "text", "job_title" "text", "avatar_url" "text", "profile_details" "jsonb")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
  select c.id, c.name, c.slug, c.status, u.id, u.email,
         coalesce(p.display_name, u.email), m.role,
         coalesce(m.access_username, u.raw_user_meta_data->>'access_username'),
         case when m.role = 'administrator' then 'admin' else m.access_profile end,
         m.permission_levels, m.region_id, m.executor,
         p.contact_email, p.job_title, p.avatar_url, p.details
  from public.gm_company_members m
  join public.gm_companies c on c.id = m.company_id
  join auth.users u on u.id = m.user_id
  left join public.gm_profiles p on p.user_id = m.user_id
  where m.user_id = auth.uid() and m.active and coalesce(p.active, true) and c.status = 'active'
  order by m.created_at
  limit 1;
$$;

CREATE OR REPLACE FUNCTION "public"."gm_current_platform_role"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select a.role from public.gm_platform_admins a
  where a.user_id = auth.uid() and a.active limit 1;
$$;

CREATE OR REPLACE FUNCTION "public"."gm_is_company_admin"("p_company_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.gm_company_members m
    where m.company_id = p_company_id and m.user_id = auth.uid() and m.active
      and m.role = 'administrator'
  );
$$;

CREATE OR REPLACE FUNCTION "public"."gm_is_company_member"("p_company_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.gm_company_members m
    where m.company_id = p_company_id and m.user_id = auth.uid() and m.active
  );
$$;

CREATE OR REPLACE FUNCTION "public"."gm_is_platform_admin"("p_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.gm_platform_admins a
    where a.user_id = p_user_id and a.active and a.role in ('owner', 'superadmin')
  );
$$;

CREATE OR REPLACE FUNCTION "public"."gm_is_valid_cnpj"("p_value" "text") RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
declare
  v text := regexp_replace(coalesce(p_value, ''), '[^0-9]', '', 'g');
  s integer; i integer; d1 integer; d2 integer;
begin
  if length(v) <> 14 or length(replace(v, substring(v, 1, 1), '')) = 0 then return false; end if;
  s := 0;
  for i in 1..12 loop
    s := s + substring(v, i, 1)::integer * (array[5,4,3,2,9,8,7,6,5,4,3,2])[i];
  end loop;
  d1 := case when (s % 11) < 2 then 0 else 11 - (s % 11) end;
  s := 0;
  for i in 1..13 loop
    s := s + substring(v, i, 1)::integer * (array[6,5,4,3,2,9,8,7,6,5,4,3,2])[i];
  end loop;
  d2 := case when (s % 11) < 2 then 0 else 11 - (s % 11) end;
  return substring(v, 13, 1)::integer = d1 and substring(v, 14, 1)::integer = d2;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."gm_list_company_users"() RETURNS TABLE("user_id" "uuid", "auth_email" "text", "access_username" "text", "display_name" "text", "contact_email" "text", "job_title" "text", "avatar_url" "text", "member_role" "text", "access_profile" "text", "permission_levels" "jsonb", "region_id" "text", "executor" boolean, "active" boolean, "profile_details" "jsonb", "created_at" timestamp with time zone, "last_sign_in_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
  with mine as (
    select m.company_id
    from public.gm_company_members m
    where m.user_id = auth.uid() and m.active and m.role = 'administrator'
    limit 1
  )
  select u.id, u.email, m.access_username, coalesce(p.display_name, u.email),
         p.contact_email, p.job_title, p.avatar_url, m.role,
         case when m.role = 'administrator' then 'admin' else m.access_profile end,
         m.permission_levels, m.region_id, m.executor,
         (m.active and coalesce(p.active, true)), p.details,
         m.created_at, u.last_sign_in_at
  from mine
  join public.gm_company_members m on m.company_id = mine.company_id
  join auth.users u on u.id = m.user_id
  left join public.gm_profiles p on p.user_id = m.user_id
  order by case when m.role = 'administrator' then 0 else 1 end, coalesce(p.display_name, u.email);
$$;

CREATE OR REPLACE FUNCTION "public"."gm_load_tenant_state"() RETURNS TABLE("company_id" "uuid", "state" "jsonb", "version" bigint, "updated_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select s.company_id, s.state, s.version, s.updated_at
  from public.gm_tenant_state s
  where public.gm_is_company_member(s.company_id)
  limit 1;
$$;

CREATE OR REPLACE FUNCTION "public"."gm_manage_company"("p_company_id" "uuid", "p_action" "text", "p_payload" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_company public.gm_companies;
  v_subscription public.gm_company_subscriptions;
  v_member_count integer;
  v_unit_count integer;
  v_user_limit integer;
  v_unit_limit integer;
  v_before jsonb;
  v_after jsonb;
begin
  if not public.gm_is_platform_admin() then
    raise exception 'Acesso negado.' using errcode='42501';
  end if;

  select * into v_company from public.gm_companies where id=p_company_id for update;
  if not found then raise exception 'Empresa nao encontrada.' using errcode='P0002'; end if;
  select * into v_subscription from public.gm_company_subscriptions where company_id=p_company_id for update;

  select count(*) into v_member_count from public.gm_company_members
    where company_id=p_company_id and active is distinct from false;
  select count(*) into v_unit_count from public.gm_company_units
    where company_id=p_company_id and status='active';

  v_before := jsonb_build_object('company',to_jsonb(v_company),'subscription',to_jsonb(v_subscription));

  if p_action='suspend' then
    update public.gm_companies set status='suspended' where id=p_company_id;
    update public.gm_company_subscriptions set status='suspended' where company_id=p_company_id;
  elsif p_action='reactivate' then
    update public.gm_companies set status='active',archived_at=null where id=p_company_id;
    update public.gm_company_subscriptions set status='active' where company_id=p_company_id;
  elsif p_action='archive' then
    update public.gm_companies set status='archived',archived_at=now() where id=p_company_id;
    update public.gm_company_subscriptions set status='cancelled' where company_id=p_company_id;
  elsif p_action='update_registration' then
    if length(trim(coalesce(p_payload->>'trade_name',''))) < 2
      or length(trim(coalesce(p_payload->>'legal_name',''))) < 2
      or length(trim(coalesce(p_payload->>'responsible_name',''))) < 2
      or position('@' in coalesce(p_payload->>'responsible_email','')) < 2 then
      raise exception 'Revise os dados cadastrais obrigatorios.' using errcode='22023';
    end if;
    update public.gm_companies set
      trade_name=trim(p_payload->>'trade_name'),
      legal_name=trim(p_payload->>'legal_name'),
      responsible_name=trim(p_payload->>'responsible_name'),
      responsible_email=lower(trim(p_payload->>'responsible_email')),
      responsible_phone=nullif(regexp_replace(coalesce(p_payload->>'responsible_phone',''),'[^0-9]','','g'),''),
      city=nullif(trim(p_payload->>'city'),''),
      state=nullif(upper(trim(p_payload->>'state')),'')
    where id=p_company_id;
  elsif p_action in ('update_plan','update_limits') then
    v_user_limit := coalesce(nullif(p_payload->>'user_limit','')::integer,v_subscription.user_limit);
    v_unit_limit := coalesce(nullif(p_payload->>'unit_limit','')::integer,v_subscription.unit_limit);
    if v_user_limit < greatest(1,v_member_count) or v_user_limit > 100000 then
      raise exception 'O limite de usuarios nao pode ser menor que o uso atual.' using errcode='22023';
    end if;
    if v_unit_limit < greatest(1,v_unit_count) or v_unit_limit > 10000 then
      raise exception 'O limite de unidades nao pode ser menor que o uso atual.' using errcode='22023';
    end if;
    if coalesce(nullif(trim(p_payload->>'plan_code'),''),v_subscription.plan_code) is null then
      raise exception 'Informe o plano contratado.' using errcode='22023';
    end if;
    if nullif(p_payload->>'subscription_status','') is not null
      and (p_payload->>'subscription_status') not in ('trial','active','suspended','cancelled') then
      raise exception 'Status da assinatura invalido.' using errcode='22023';
    end if;
    update public.gm_company_subscriptions set
      plan_code=case when p_action='update_plan' then coalesce(nullif(trim(p_payload->>'plan_code'),''),plan_code) else plan_code end,
      user_limit=v_user_limit,
      unit_limit=v_unit_limit,
      starts_on=coalesce(nullif(p_payload->>'starts_on','')::date,starts_on),
      trial_ends_on=nullif(p_payload->>'trial_ends_on','')::date,
      status=coalesce(nullif(p_payload->>'subscription_status',''),status)
    where company_id=p_company_id;
  else
    raise exception 'Acao invalida.' using errcode='22023';
  end if;

  select jsonb_build_object(
    'company',to_jsonb(c),
    'subscription',to_jsonb(s)
  ) into v_after
  from public.gm_companies c
  left join public.gm_company_subscriptions s on s.company_id=c.id
  where c.id=p_company_id;

  insert into public.gm_platform_audit_log(actor_user_id,action,entity,entity_id,metadata)
    values(auth.uid(),'company.'||p_action,'company',p_company_id::text,
      jsonb_build_object('before',v_before,'after',v_after,'changes',p_payload));
  return v_after;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."gm_member_can"("p_company_id" "uuid", "p_module" "text", "p_required_level" "text" DEFAULT 'view'::"text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select public.gm_access_level_rank(public.gm_member_module_level(p_company_id, p_module))
    >= public.gm_access_level_rank(p_required_level);
$$;

CREATE OR REPLACE FUNCTION "public"."gm_member_module_level"("p_company_id" "uuid", "p_module" "text") RETURNS "text"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_role text;
  v_profile text;
  v_levels jsonb;
  v_level text;
begin
  select m.role, m.access_profile, coalesce(m.permission_levels, '{}'::jsonb)
    into v_role, v_profile, v_levels
  from public.gm_company_members m
  left join public.gm_profiles p on p.user_id = m.user_id
  where m.company_id = p_company_id
    and m.user_id = auth.uid()
    and m.active
    and coalesce(p.active, true)
  limit 1;

  if v_role is null then return 'none'; end if;
  if v_role = 'administrator' then return 'manage'; end if;

  v_level := coalesce(nullif(v_levels ->> p_module, ''),
    public.gm_profile_default_level(v_profile, p_module));
  if v_level not in ('none', 'view', 'operate', 'manage') then return 'none'; end if;
  return v_level;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."gm_permanently_delete_company"("p_company_id" "uuid") RETURNS "uuid"[]
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_company public.gm_companies;
  v_member_ids uuid[];
begin
  if not public.gm_is_platform_admin(auth.uid()) then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;

  select * into v_company from public.gm_companies where id = p_company_id for update;
  if not found then raise exception 'Empresa nao encontrada.' using errcode = 'P0002'; end if;
  if lower(coalesce(v_company.slug, '')) = 'gestman' then
    raise exception 'A empresa da plataforma nao pode ser excluida.' using errcode = '42501';
  end if;

  select coalesce(array_agg(m.user_id), '{}'::uuid[]) into v_member_ids
  from public.gm_company_members m where m.company_id = p_company_id;

  delete from public.company_requests where converted_company_id = p_company_id;
  delete from public.gm_platform_audit_log where entity = 'company' and entity_id = p_company_id::text;
  delete from public.gm_companies where id = p_company_id;
  return v_member_ids;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."gm_profile_default_level"("p_profile" "text", "p_module" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select case lower(coalesce(p_profile, 'viewer'))
    when 'admin' then 'manage'
    when 'supervisor' then case p_module
      when 'dashboard' then 'view' when 'map' then 'view' when 'assets' then 'view'
      when 'tags' then 'view' when 'locations' then 'view' when 'documents' then 'view'
      when 'orders' then 'manage' when 'preventivePlans' then 'manage'
      when 'checklists' then 'manage' when 'stock' then 'operate'
      when 'suppliers' then 'view' when 'resources' then 'manage'
      when 'reports' then 'view' when 'assistant' then 'view' else 'none' end
    when 'technician' then case p_module
      when 'dashboard' then 'view' when 'map' then 'view' when 'assets' then 'view'
      when 'documents' then 'view' when 'orders' then 'operate'
      when 'checklists' then 'operate' when 'reports' then 'view'
      when 'assistant' then 'view' else 'none' end
    when 'warehouse' then case p_module
      when 'dashboard' then 'view' when 'assets' then 'view' when 'orders' then 'view'
      when 'stock' then 'manage' when 'suppliers' then 'manage' else 'none' end
    when 'requester' then case p_module
      when 'dashboard' then 'view' when 'orders' then 'operate' else 'none' end
    when 'viewer' then case p_module
      when 'dashboard' then 'view' when 'map' then 'view' when 'assets' then 'view'
      when 'documents' then 'view' when 'orders' then 'view'
      when 'preventivePlans' then 'view' when 'reports' then 'view' else 'none' end
    else 'none'
  end;
$$;

CREATE OR REPLACE FUNCTION "public"."gm_protect_member_access_profile"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  if new.role = 'administrator' then new.access_profile := 'admin'; end if;
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."gm_review_company_request"("p_request_id" "uuid", "p_status" "text", "p_internal_notes" "text" DEFAULT NULL::"text") RETURNS "public"."company_requests"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_row public.company_requests; v_action text;
begin
  if not public.gm_is_platform_admin() then raise exception 'Acesso negado.' using errcode='42501'; end if;
  if p_status not in ('reviewing','approved','rejected') then raise exception 'Status invalido.' using errcode='22023'; end if;
  update public.company_requests set status=p_status, internal_notes=nullif(trim(p_internal_notes),''),
    reviewed_by=auth.uid(), reviewed_at=now()
  where id=p_request_id and status <> 'converted' returning * into v_row;
  if not found then raise exception 'Solicitacao nao encontrada ou ja convertida.' using errcode='P0002'; end if;
  v_action := case p_status when 'approved' then 'company_request.approved' when 'rejected' then 'company_request.rejected' else 'company_request.reviewing' end;
  insert into public.gm_platform_audit_log(actor_user_id,action,entity,entity_id,metadata)
    values(auth.uid(),v_action,'company_request',v_row.id::text,jsonb_build_object('status',p_status));
  return v_row;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."gm_save_tenant_state"("p_expected_version" bigint, "p_state" "jsonb") RETURNS TABLE("version" bigint, "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_company_id uuid;
  v_current_version bigint;
  v_current_state jsonb;
  v_persisted_state jsonb;
  v_updated_at timestamptz;
  v_key text;
  v_module text;
  v_level text;
  v_changed_keys text[] := '{}'::text[];
  v_changed_modules text[] := '{}'::text[];
begin
  if auth.uid() is null then raise exception 'GM_AUTH_REQUIRED'; end if;
  if jsonb_typeof(p_state) <> 'object' then raise exception 'GM_INVALID_STATE'; end if;

  select s.company_id, s.version, s.state
    into v_company_id, v_current_version, v_current_state
  from public.gm_tenant_state s
  where public.gm_is_company_member(s.company_id)
  order by s.updated_at desc
  limit 1
  for update;

  if v_company_id is null then raise exception 'GM_COMPANY_NOT_FOUND'; end if;
  if v_current_version <> p_expected_version then raise exception 'GM_STATE_CONFLICT'; end if;

  -- Perfil e preferencia individual nao pertencem ao estado compartilhado da empresa.
  -- Preserva o valor legado, sem permitir que um usuario sobrescreva o perfil de outro.
  v_persisted_state := p_state - 'profile';
  if coalesce(v_current_state, '{}'::jsonb) ? 'profile' then
    v_persisted_state := jsonb_set(v_persisted_state, '{profile}', v_current_state -> 'profile', true);
  end if;

  for v_key in
    select keys.key
    from (
      select jsonb_object_keys(coalesce(v_current_state, '{}'::jsonb)) as key
      union
      select jsonb_object_keys(v_persisted_state) as key
    ) keys
    where (coalesce(v_current_state, '{}'::jsonb) -> keys.key)
      is distinct from (v_persisted_state -> keys.key)
  loop
    v_module := public.gm_state_key_module(v_key);
    v_level := public.gm_member_module_level(v_company_id, v_module);
    if public.gm_access_level_rank(v_level) < public.gm_access_level_rank('operate') then
      raise exception 'GM_PERMISSION_DENIED:%:%', v_module, v_key;
    end if;
    if public.gm_array_removes_records(v_current_state -> v_key, v_persisted_state -> v_key)
       and public.gm_access_level_rank(v_level) < public.gm_access_level_rank('manage') then
      raise exception 'GM_DELETE_PERMISSION_DENIED:%:%', v_module, v_key;
    end if;
    v_changed_keys := array_append(v_changed_keys, v_key);
    if not v_module = any(v_changed_modules) then
      v_changed_modules := array_append(v_changed_modules, v_module);
    end if;
  end loop;

  update public.gm_tenant_state s
  set state = v_persisted_state, version = s.version + 1, updated_by = auth.uid()
  where s.company_id = v_company_id
  returning s.version, s.updated_at into v_current_version, v_updated_at;

  insert into public.gm_audit_log(company_id, user_id, action, entity, entity_id, metadata)
  values (v_company_id, auth.uid(), 'state.save', 'tenant_state', v_company_id::text,
    jsonb_build_object(
      'version', v_current_version,
      'changed_keys', to_jsonb(v_changed_keys),
      'changed_modules', to_jsonb(v_changed_modules)
    ));

  return query select v_current_version, v_updated_at;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."gm_set_company_user_active_internal"("p_actor_user_id" "uuid", "p_company_id" "uuid", "p_user_id" "uuid", "p_active" boolean) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_primary_admin uuid;
begin
  if not exists (
    select 1 from public.gm_company_members
    where company_id = p_company_id and user_id = p_actor_user_id
      and active and role = 'administrator'
  ) then raise exception 'GM_ADMIN_REQUIRED'; end if;
  if p_user_id = p_actor_user_id and not p_active then raise exception 'GM_SELF_DEACTIVATION_BLOCKED'; end if;
  select m.user_id into v_primary_admin from public.gm_company_members m
  where m.company_id = p_company_id and m.role = 'administrator'
  order by m.created_at asc limit 1;
  if p_user_id = v_primary_admin and not p_active then raise exception 'GM_PRIMARY_ADMIN_PROTECTED'; end if;

  update public.gm_company_members set active = p_active
  where company_id = p_company_id and user_id = p_user_id;
  if not found then raise exception 'GM_USER_NOT_FOUND'; end if;
  update public.gm_profiles set active = p_active where user_id = p_user_id;
  insert into public.gm_audit_log(company_id, user_id, action, entity, entity_id, metadata)
  values (p_company_id, p_actor_user_id, case when p_active then 'user.activate' else 'user.deactivate' end,
          'company_user', p_user_id::text, '{}'::jsonb);
  return true;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."gm_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."gm_state_key_module"("p_key" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select case p_key
    when 'regions' then 'locations'
    when 'locations' then 'locations'
    when 'operationalAreas' then 'locations'
    when 'sectorsLocations' then 'locations'
    when 'installationStructures' then 'map'
    when 'assets' then 'assets'
    when 'tags' then 'tags'
    when 'subtags' then 'tags'
    when 'movements' then 'tags'
    when 'documents' then 'documents'
    when 'orders' then 'orders'
    when 'pendingActions' then 'orders'
    when 'downtimes' then 'orders'
    when 'measurementPoints' then 'orders'
    when 'measurements' then 'orders'
    when 'maintenanceJournal' then 'orders'
    when 'preventivePlans' then 'preventivePlans'
    when 'checklists' then 'checklists'
    when 'checklistExecutions' then 'checklists'
    when 'stockLocations' then 'stock'
    when 'spareParts' then 'stock'
    when 'inventoryMovements' then 'stock'
    when 'materialRequests' then 'stock'
    when 'stockTransfers' then 'stock'
    when 'tools' then 'stock'
    when 'toolLoans' then 'stock'
    when 'suppliers' then 'suppliers'
    when 'resources' then 'resources'
    when 'teams' then 'resources'
    else '__admin__'
  end;
$$;

CREATE OR REPLACE FUNCTION "public"."gm_storage_company_id"("p_name" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $_$
declare
  v_part text;
begin
  v_part := (storage.foldername(p_name))[1];
  if v_part is null or v_part !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return null;
  end if;
  return v_part::uuid;
end;
$_$;

CREATE OR REPLACE FUNCTION "public"."gm_storage_module"("p_name" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select case lower(coalesce((storage.foldername(p_name))[2], 'documents'))
    when 'orders' then 'orders'
    when 'assets' then 'assets'
    when 'stock' then 'stock'
    when 'documents' then 'documents'
    else 'documents'
  end;
$$;

CREATE OR REPLACE FUNCTION "public"."gm_submit_company_request"("p_request" "jsonb") RETURNS TABLE("request_id" "uuid", "request_status" "text", "submitted_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
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
$_$;

CREATE OR REPLACE FUNCTION "public"."gm_touch_company_access"("p_company_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not public.gm_is_company_member(p_company_id) then raise exception 'Acesso negado.' using errcode='42501'; end if;
  update public.gm_companies set last_access_at=now() where id=p_company_id;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."gm_upsert_company_user_internal"("p_actor_user_id" "uuid", "p_company_id" "uuid", "p_user_id" "uuid", "p_display_name" "text", "p_contact_email" "text", "p_job_title" "text", "p_avatar_url" "text", "p_access_username" "text", "p_member_role" "text", "p_access_profile" "text", "p_permission_levels" "jsonb", "p_region_id" "text", "p_executor" boolean, "p_active" boolean, "p_details" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $_$
declare
  v_primary_admin uuid;
begin
  if not exists (
    select 1 from public.gm_company_members
    where company_id = p_company_id and user_id = p_actor_user_id
      and active and role = 'administrator'
  ) then raise exception 'GM_ADMIN_REQUIRED'; end if;

  if trim(coalesce(p_display_name, '')) = '' or trim(coalesce(p_access_username, '')) = '' then
    raise exception 'GM_REQUIRED_FIELDS';
  end if;
  if p_access_username !~ '^[a-z0-9][a-z0-9._-]{1,47}$' then raise exception 'GM_INVALID_USERNAME'; end if;
  if p_access_profile not in ('admin', 'supervisor', 'technician', 'warehouse', 'requester', 'viewer') then
    raise exception 'GM_INVALID_PROFILE';
  end if;

  select m.user_id into v_primary_admin
  from public.gm_company_members m
  where m.company_id = p_company_id and m.role = 'administrator'
  order by m.created_at asc limit 1;
  if p_user_id = v_primary_admin and (not p_active or p_access_profile <> 'admin') then
    raise exception 'GM_PRIMARY_ADMIN_PROTECTED';
  end if;

  insert into public.gm_profiles(user_id, display_name, contact_email, job_title, avatar_url, active, details)
  values (p_user_id, trim(p_display_name), nullif(trim(coalesce(p_contact_email, '')), ''),
          nullif(trim(coalesce(p_job_title, '')), ''), nullif(trim(coalesce(p_avatar_url, '')), ''),
          p_active, coalesce(p_details, '{}'::jsonb))
  on conflict (user_id) do update set
    display_name = excluded.display_name,
    contact_email = excluded.contact_email,
    job_title = excluded.job_title,
    avatar_url = excluded.avatar_url,
    active = excluded.active,
    details = excluded.details;

  insert into public.gm_company_members(
    company_id, user_id, role, active, access_username, access_profile,
    permission_levels, region_id, executor
  ) values (
    p_company_id, p_user_id, p_member_role, p_active, lower(trim(p_access_username)), p_access_profile,
    coalesce(p_permission_levels, '{}'::jsonb), nullif(trim(coalesce(p_region_id, '')), ''), p_executor
  )
  on conflict (company_id, user_id) do update set
    role = excluded.role,
    active = excluded.active,
    access_username = excluded.access_username,
    access_profile = excluded.access_profile,
    permission_levels = excluded.permission_levels,
    region_id = excluded.region_id,
    executor = excluded.executor;

  insert into public.gm_user_preferences(company_id, user_id)
  values (p_company_id, p_user_id)
  on conflict (company_id, user_id) do nothing;

  insert into public.gm_audit_log(company_id, user_id, action, entity, entity_id, metadata)
  values (p_company_id, p_actor_user_id, 'user.upsert', 'company_user', p_user_id::text,
          jsonb_build_object('access_username', p_access_username, 'access_profile', p_access_profile, 'active', p_active));
  return p_user_id;
end;
$_$;

CREATE OR REPLACE FUNCTION "public"."proxima_ordem_servico_numero"() RETURNS "text"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select 'O.S-' || lpad(nextval('public.ordens_servico_numero_seq')::text, 4, '0');
$$;

CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- Views
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW "public"."vw_ordens_servico_completa" AS
 SELECT "os"."id" AS "ordem_id",
    "os"."numero" AS "os_numero",
    "os"."status",
    "os"."prioridade",
    "os"."tipo_servico",
    "os"."tipo_manutencao",
    "os"."solicitante",
    COALESCE(NULLIF("os"."executante", ''::"text"), NULLIF("os"."tecnico", ''::"text"), 'Nao informado'::"text") AS "executante",
    "os"."descricao",
    "os"."comentario",
    "os"."categoria",
    "os"."equipamento_parado",
    "os"."pendente_execucao",
    COALESCE("os"."data_abertura", "os"."created_at") AS "data_abertura",
    "os"."data_inicio",
    "os"."data_fim",
        CASE
            WHEN (("os"."data_inicio" IS NOT NULL) AND ("os"."data_fim" IS NOT NULL)) THEN "round"((EXTRACT(epoch FROM ("os"."data_fim" - "os"."data_inicio")) / (3600)::numeric), 2)
            ELSE "os"."mttr_horas"
        END AS "mttr_horas",
    "os"."created_at",
    COALESCE(("os"."equipamento_id")::"text", ("os"."ativo_id")::"text") AS "equipamento_referencia",
    "eq"."id" AS "equipamento_id",
    "eq"."codigo" AS "equipamento_codigo",
    "eq"."nome" AS "equipamento_nome",
    "eq"."criticidade" AS "equipamento_criticidade",
    "eq"."status" AS "equipamento_status",
    "eq"."marca" AS "equipamento_marca",
    "eq"."modelo" AS "equipamento_modelo",
    "li"."id" AS "local_instalacao_id",
    "li"."nome" AS "local_instalacao_nome",
    "li"."tipo" AS "local_instalacao_tipo",
    "r"."id" AS "regiao_id",
    "r"."nome" AS "regiao_nome"
   FROM ((("public"."ordens_servico" "os"
     LEFT JOIN "public"."equipamentos" "eq" ON ((("eq"."id")::"text" = COALESCE(("os"."equipamento_id")::"text", ("os"."ativo_id")::"text"))))
     LEFT JOIN "public"."locais_instalacao" "li" ON (("li"."id" = "eq"."local_instalacao_id")))
     LEFT JOIN "public"."regioes" "r" ON (("r"."id" = "li"."regiao_id")));

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE TRIGGER "company_requests_updated_at" BEFORE UPDATE ON "public"."company_requests" FOR EACH ROW EXECUTE FUNCTION "public"."gm_set_updated_at"();

CREATE OR REPLACE TRIGGER "gm365_trg_eventos_os" AFTER INSERT OR UPDATE OF "status", "data_inicio", "data_fim" ON "public"."ordens_servico" FOR EACH ROW EXECUTE FUNCTION "public"."gm365_registrar_evento_os"();

CREATE OR REPLACE TRIGGER "gm_companies_updated_at" BEFORE UPDATE ON "public"."gm_companies" FOR EACH ROW EXECUTE FUNCTION "public"."gm_set_updated_at"();

CREATE OR REPLACE TRIGGER "gm_company_members_access_profile" BEFORE INSERT OR UPDATE ON "public"."gm_company_members" FOR EACH ROW EXECUTE FUNCTION "public"."gm_protect_member_access_profile"();

CREATE OR REPLACE TRIGGER "gm_company_members_updated_at" BEFORE UPDATE ON "public"."gm_company_members" FOR EACH ROW EXECUTE FUNCTION "public"."gm_set_updated_at"();

CREATE OR REPLACE TRIGGER "gm_company_subscriptions_updated_at" BEFORE UPDATE ON "public"."gm_company_subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."gm_set_updated_at"();

CREATE OR REPLACE TRIGGER "gm_company_units_updated_at" BEFORE UPDATE ON "public"."gm_company_units" FOR EACH ROW EXECUTE FUNCTION "public"."gm_set_updated_at"();

CREATE OR REPLACE TRIGGER "gm_platform_admins_updated_at" BEFORE UPDATE ON "public"."gm_platform_admins" FOR EACH ROW EXECUTE FUNCTION "public"."gm_set_updated_at"();

CREATE OR REPLACE TRIGGER "gm_profiles_updated_at" BEFORE UPDATE ON "public"."gm_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."gm_set_updated_at"();

CREATE OR REPLACE TRIGGER "gm_tenant_state_updated_at" BEFORE UPDATE ON "public"."gm_tenant_state" FOR EACH ROW EXECUTE FUNCTION "public"."gm_set_updated_at"();

CREATE OR REPLACE TRIGGER "gm_user_preferences_updated_at" BEFORE UPDATE ON "public"."gm_user_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."gm_set_updated_at"();

CREATE OR REPLACE TRIGGER "set_updated_at_empresas" BEFORE UPDATE ON "public"."empresas" FOR EACH ROW EXECUTE FUNCTION "public"."gestman365_set_updated_at"();

CREATE OR REPLACE TRIGGER "set_updated_at_perfis_acesso" BEFORE UPDATE ON "public"."perfis_acesso" FOR EACH ROW EXECUTE FUNCTION "public"."gestman365_set_updated_at"();

CREATE OR REPLACE TRIGGER "set_updated_at_usuarios_empresas" BEFORE UPDATE ON "public"."usuarios_empresas" FOR EACH ROW EXECUTE FUNCTION "public"."gestman365_set_updated_at"();

-- ---------------------------------------------------------------------------
-- Row-level security and restrictive policies
-- ---------------------------------------------------------------------------

ALTER TABLE "public"."ativos" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."chamados" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."checklists" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."company_requests" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_requests_platform_select" ON "public"."company_requests" FOR SELECT TO "authenticated" USING ("public"."gm_is_platform_admin"());

CREATE POLICY "company_requests_platform_update" ON "public"."company_requests" FOR UPDATE TO "authenticated" USING ("public"."gm_is_platform_admin"()) WITH CHECK ("public"."gm_is_platform_admin"());

ALTER TABLE "public"."empresas" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."equipamentos" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."estoque_saldos" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."estoques" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."eventos_ordem_servico" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."fornecedores" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gestman365_empresas_select_auth" ON "public"."empresas" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."usuarios_empresas" "ue"
  WHERE (("ue"."empresa_id" = "empresas"."id") AND ("ue"."auth_user_id" = "auth"."uid"()) AND ("ue"."ativo" = true)))));

CREATE POLICY "gestman365_usuarios_select_empresa" ON "public"."usuarios_empresas" FOR SELECT TO "authenticated" USING (("auth_user_id" = "auth"."uid"()));

ALTER TABLE "public"."gestman_empresas" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."gestman_usuarios" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gm_audit_company_select" ON "public"."gm_audit_log" FOR SELECT TO "authenticated" USING ("public"."gm_is_company_member"("company_id"));

ALTER TABLE "public"."gm_audit_log" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."gm_companies" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gm_companies_platform_select" ON "public"."gm_companies" FOR SELECT TO "authenticated" USING ("public"."gm_is_platform_admin"());

CREATE POLICY "gm_companies_platform_update" ON "public"."gm_companies" FOR UPDATE TO "authenticated" USING ("public"."gm_is_platform_admin"()) WITH CHECK ("public"."gm_is_platform_admin"());

CREATE POLICY "gm_companies_select_members" ON "public"."gm_companies" FOR SELECT TO "authenticated" USING ("public"."gm_is_company_member"("id"));

ALTER TABLE "public"."gm_company_members" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."gm_company_subscriptions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."gm_company_units" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gm_members_admin_manage" ON "public"."gm_company_members" TO "authenticated" USING ("public"."gm_is_company_admin"("company_id")) WITH CHECK ("public"."gm_is_company_admin"("company_id"));

CREATE POLICY "gm_members_platform_select" ON "public"."gm_company_members" FOR SELECT TO "authenticated" USING ("public"."gm_is_platform_admin"());

CREATE POLICY "gm_members_select_company" ON "public"."gm_company_members" FOR SELECT TO "authenticated" USING ("public"."gm_is_company_member"("company_id"));

ALTER TABLE "public"."gm_platform_admins" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gm_platform_admins_self_select" ON "public"."gm_platform_admins" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) AND "active"));

ALTER TABLE "public"."gm_platform_audit_log" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gm_platform_audit_select" ON "public"."gm_platform_audit_log" FOR SELECT TO "authenticated" USING ("public"."gm_is_platform_admin"());

CREATE POLICY "gm_preferences_own_access" ON "public"."gm_user_preferences" TO "authenticated" USING ((("user_id" = "auth"."uid"()) AND "public"."gm_is_company_member"("company_id"))) WITH CHECK ((("user_id" = "auth"."uid"()) AND "public"."gm_is_company_member"("company_id")));

ALTER TABLE "public"."gm_profiles" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gm_profiles_select_company" ON "public"."gm_profiles" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."gm_company_members" "mine"
     JOIN "public"."gm_company_members" "theirs" ON (("theirs"."company_id" = "mine"."company_id")))
  WHERE (("mine"."user_id" = "auth"."uid"()) AND "mine"."active" AND ("theirs"."user_id" = "gm_profiles"."user_id")))));

CREATE POLICY "gm_profiles_update_self" ON "public"."gm_profiles" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));

ALTER TABLE "public"."gm_public_rate_limits" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gm_state_company_access" ON "public"."gm_tenant_state" FOR SELECT TO "authenticated" USING ("public"."gm_is_company_member"("company_id"));

CREATE POLICY "gm_subscriptions_tenant_select" ON "public"."gm_company_subscriptions" FOR SELECT TO "authenticated" USING (("public"."gm_is_company_member"("company_id") OR "public"."gm_is_platform_admin"()));

ALTER TABLE "public"."gm_tenant_state" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gm_units_tenant_select" ON "public"."gm_company_units" FOR SELECT TO "authenticated" USING (("public"."gm_is_company_member"("company_id") OR "public"."gm_is_platform_admin"()));

ALTER TABLE "public"."gm_user_preferences" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."locais_instalacao" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."movimentacoes_estoque" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."movimentacoes_estoque_itens" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."movimentacoes_tags" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."ordens_servico" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."pecas" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."perfil_permissoes" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."perfis" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."perfis_acesso" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."permissoes" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."preventivas" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."regioes" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."requisicoes_materiais" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."requisicoes_materiais_itens" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."subtags" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."subtags_equipamento" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."tags" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."transferencias_estoque" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."transferencias_estoque_itens" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."usuarios_empresas" ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Legacy password containment
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION "public"."gm_block_legacy_password_writes"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.senha IS NOT NULL THEN
    RAISE EXCEPTION 'GM_LEGACY_PASSWORD_WRITE_BLOCKED'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.senha IS DISTINCT FROM OLD.senha THEN
    RAISE EXCEPTION 'GM_LEGACY_PASSWORD_WRITE_BLOCKED'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "gm_block_legacy_password_writes"
BEFORE INSERT OR UPDATE ON "public"."gestman_usuarios"
FOR EACH ROW
EXECUTE FUNCTION "public"."gm_block_legacy_password_writes"();

-- ---------------------------------------------------------------------------
-- Minimum grants
-- ---------------------------------------------------------------------------

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public
  FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public
  FROM PUBLIC, anon, authenticated;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT, UPDATE ON TABLE
  "public"."company_requests",
  "public"."gm_companies",
  "public"."gm_profiles"
TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  "public"."gm_company_members",
  "public"."gm_user_preferences"
TO authenticated;

GRANT SELECT ON TABLE
  "public"."gm_audit_log",
  "public"."gm_company_subscriptions",
  "public"."gm_company_units",
  "public"."gm_platform_admins",
  "public"."gm_platform_audit_log",
  "public"."gm_tenant_state"
TO authenticated;

GRANT EXECUTE ON FUNCTION "public"."gm_access_level_rank"(text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION "public"."gm_array_removes_records"(jsonb, jsonb)
  TO authenticated;
GRANT EXECUTE ON FUNCTION "public"."gm_current_context"()
  TO authenticated;
GRANT EXECUTE ON FUNCTION "public"."gm_current_platform_role"()
  TO authenticated;
GRANT EXECUTE ON FUNCTION "public"."gm_is_company_admin"(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION "public"."gm_is_company_member"(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION "public"."gm_is_platform_admin"(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION "public"."gm_list_company_users"()
  TO authenticated;
GRANT EXECUTE ON FUNCTION "public"."gm_load_tenant_state"()
  TO authenticated;
GRANT EXECUTE ON FUNCTION "public"."gm_manage_company"(uuid, text, jsonb)
  TO authenticated;
GRANT EXECUTE ON FUNCTION "public"."gm_member_can"(uuid, text, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION "public"."gm_member_module_level"(uuid, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION "public"."gm_permanently_delete_company"(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION "public"."gm_profile_default_level"(text, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION "public"."gm_review_company_request"(uuid, text, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION "public"."gm_save_tenant_state"(bigint, jsonb)
  TO authenticated;
GRANT EXECUTE ON FUNCTION "public"."gm_state_key_module"(text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION "public"."gm_storage_company_id"(text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION "public"."gm_storage_module"(text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION "public"."gm_touch_company_access"(uuid)
  TO authenticated;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

REVOKE ALL ON FUNCTION "public"."gestman_login"(text, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION "public"."gm_block_legacy_password_writes"()
  FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage customizations
-- ---------------------------------------------------------------------------
--
-- Supabase owns the storage schema and storage.objects table. Storage policies
-- are intentionally applied later by the dedicated hardening migration, after
-- the managed Storage service and the private bucket are confirmed. Keeping
-- managed Storage DDL out of the baseline also allows the application schema
-- to be reconstructed without requiring ownership of storage.objects.

commit;
