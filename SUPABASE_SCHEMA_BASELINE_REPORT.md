# GestMan365 — Relatório do baseline Supabase

Data: 26/07/2026

Branch: `codex/github-current-20260722`

Commit de origem: `fe1cbe1`

## Resultado executivo

Foi criado um baseline SQL reproduzível do esquema de aplicação observado no
dump estrutural de produção. Nenhum comando foi executado contra produção ou
staging. O dump bruto permanece ignorado pelo Git.

Arquivo criado:

`supabase/baseline/20260726_gestman_schema_baseline.sql`

SHA-256 do baseline:
`A3087AF1059E3A86B3A1C5A03AC4575AAD740D7C52013D11424A3E16F17C10FA`
(109.147 bytes, 2.462 linhas).

O baseline contém o esquema `public`, as dependências declarativas da aplicação,
RLS restritiva, grants mínimos e as quatro políticas de Storage. Não contém
linhas empresariais, usuários, credenciais, URLs, project refs ou objetos
gerenciados dos schemas `auth` e `storage`.

## Proveniência e auditoria do dump

- SHA-256 confirmado:
  `325436B44ABEA12B89C26A623661925CC17B57DBA468FEE38A57377D0285B995`.
- Tamanho: 127.231 bytes.
- `COPY ... FROM stdin`: 0 ocorrência.
- `INSERT` no nível superior: 0 ocorrência.
- `INSERT` em corpos de funções/RPCs: 33 ocorrências.
- Criação ou carga de `auth.users`: 0 ocorrência.
- Carga de `storage.objects`: 0 ocorrência.
- Dados empresariais exportados: nenhum indício encontrado.
- Tokens JWT, chaves, URLs de projeto, strings de conexão ou chaves privadas:
  nenhum indício encontrado.
- A única ocorrência textual de “segredo” é um comentário de coluna que
  descreve erro de notificação sem dados secretos.

O arquivo bruto está protegido pela regra `supabase/.temp/` do `.gitignore` e
não foi adicionado ao baseline nem ao commit.

## Comparação das fontes

### `supabase/snapshot-current`

O snapshot confirmou o inventário remoto — 43 tabelas, 37 funções, uma view,
três sequences lógicas, 14 triggers e políticas multiempresa — mas continha
apenas definições completas das três RPCs críticas. Ele continua sendo
referência de catálogo, não migration executável.

### `supabase/staging-baseline`

O staging estava vazio e o arquivo de revisão bloqueava execução de propósito.
O novo baseline substitui a lacuna documental com DDL derivado do dump
schema-only, sem aplicar nada remotamente.

### `supabase/migrations`

As migrations de 16 a 19/07 contêm onboarding, administração empresarial,
exclusão permanente e gestão de usuários. As migrations de 22/07 contêm:

- remoção das policies legadas permissivas;
- contenção da coluna textual `senha`;
- redução dos grants de RPC;
- políticas do bucket privado.

O baseline representa o estado terminal observado no dump e incorpora a
contenção de segurança. As migrations históricas não devem ser reaplicadas
cegamente após o baseline sem antes definir uma estratégia de marcação/squash,
pois várias delas redefinem objetos já presentes.

## Objetos incluídos

### Extensões da aplicação

- `pgcrypto`;
- `uuid-ossp`.

`pg_stat_statements` e `supabase_vault` foram omitidas por serem extensões
administradas pela plataforma e não requisitos DDL próprios da aplicação.

### Tabelas

Foram incluídas as 43 tabelas do dump:

`ativos`, `chamados`, `checklists`, `company_requests`, `empresas`,
`equipamentos`, `estoque_saldos`, `estoques`, `eventos_ordem_servico`,
`fornecedores`, `gestman_empresas`, `gestman_usuarios`, `gm_audit_log`,
`gm_companies`, `gm_company_members`, `gm_company_subscriptions`,
`gm_company_units`, `gm_platform_admins`, `gm_platform_audit_log`,
`gm_profiles`, `gm_public_rate_limits`, `gm_tenant_state`,
`gm_user_preferences`, `locais_instalacao`, `movimentacoes_estoque`,
`movimentacoes_estoque_itens`, `movimentacoes_tags`, `ordens_servico`,
`pecas`, `perfil_permissoes`, `perfis`, `perfis_acesso`, `permissoes`,
`preventivas`, `regioes`, `requisicoes_materiais`,
`requisicoes_materiais_itens`, `subtags`, `subtags_equipamento`, `tags`,
`transferencias_estoque`, `transferencias_estoque_itens` e
`usuarios_empresas`.

Foram preservadas constraints, chaves estrangeiras, defaults, identidades,
índices e referências legítimas a `auth.users`. O baseline não cria nem
preenche `auth.users`.

### Sequences, view e triggers

- `gm_audit_log_id_seq` e `gm_platform_audit_log_id_seq`, criadas pelas
  identidades;
- `ordens_servico_numero_seq`;
- view `vw_ordens_servico_completa`;
- 14 triggers observados no dump;
- trigger adicional `gm_block_legacy_password_writes`.

### Funções e RPCs

As 37 funções do dump foram preservadas:

`gestman365_set_updated_at`, `gestman_login`, `gm365_insert_evento_os`,
`gm365_registrar_evento_os`, `gm_access_level_rank`,
`gm_array_removes_records`, `gm_bootstrap_company`, `gm_company_slug`,
`gm_consume_public_rate_limit`, `gm_convert_company_request_internal`,
`gm_convert_company_request_with_access_internal`, `gm_current_context`,
`gm_current_platform_role`, `gm_is_company_admin`, `gm_is_company_member`,
`gm_is_platform_admin`, `gm_is_valid_cnpj`, `gm_list_company_users`,
`gm_load_tenant_state`, `gm_manage_company`, `gm_member_can`,
`gm_member_module_level`, `gm_permanently_delete_company`,
`gm_profile_default_level`, `gm_protect_member_access_profile`,
`gm_review_company_request`, `gm_save_tenant_state`,
`gm_set_company_user_active_internal`, `gm_set_updated_at`,
`gm_state_key_module`, `gm_storage_company_id`, `gm_storage_module`,
`gm_submit_company_request`, `gm_touch_company_access`,
`gm_upsert_company_user_internal`, `proxima_ordem_servico_numero` e
`rls_auto_enable`.

Foi adicionada `gm_block_legacy_password_writes`, já preparada na migration de
hardening, totalizando 38 funções. As 26 funções `SECURITY DEFINER` possuem
`search_path` explícito. O privilégio `CREATE` do schema `public` é revogado de
`PUBLIC`.

### RLS

Todas as 43 tabelas permanecem com RLS habilitado. Foram incluídas 19 policies
restritivas:

`company_requests_platform_select`, `company_requests_platform_update`,
`gestman365_empresas_select_auth`, `gestman365_usuarios_select_empresa`,
`gm_audit_company_select`, `gm_companies_platform_select`,
`gm_companies_platform_update`, `gm_companies_select_members`,
`gm_members_admin_manage`, `gm_members_platform_select`,
`gm_members_select_company`, `gm_platform_admins_self_select`,
`gm_platform_audit_select`, `gm_preferences_own_access`,
`gm_profiles_select_company`, `gm_profiles_update_self`,
`gm_state_company_access`, `gm_subscriptions_tenant_select` e
`gm_units_tenant_select`.

As tabelas sem policy segura permanecem em default deny para clientes
`anon`/`authenticated`.

### Storage

Foram incluídas, de forma condicionada à existência de `storage.objects`, as
policies:

- `gm_storage_select`;
- `gm_storage_insert`;
- `gm_storage_update`;
- `gm_storage_delete`.

O baseline não cria tabelas do schema `storage` e não insere metadados no
bucket. O bucket privado `gestman-attachments` deverá ser provisionado pela API
ou CLI do Storage antes dos testes de upload.

## Objetos deliberadamente omitidos

- policies com `USING (true)` ou `WITH CHECK (true)`;
- policies públicas de inserção em `gestman_empresas` e `gestman_usuarios`;
- grants amplos do dump para `PUBLIC`, `anon` e `authenticated`;
- `ALTER DEFAULT PRIVILEGES` permissivo;
- owners fixos em `postgres`;
- publicação `supabase_realtime`;
- schemas e tabelas gerenciados por Supabase;
- criação/carga de usuários Auth;
- metadados e objetos de Storage;
- dados, senhas, tokens, chaves, URLs e project refs;
- dump bruto temporário.

As 20 policies inseguras omitidas foram:

`gestman_empresas_insert_public`, `gestman_usuarios_insert_public`,
`gestman365_perfil_permissoes_select_auth`,
`gestman365_perfis_select_auth`, `gestman365_permissoes_select_auth` e as
15 policies `prototipo_*` de ativos, chamados, ordens, peças e preventivas.

## Contenção da coluna `senha`

A coluna textual `public.gestman_usuarios.senha` foi mantida, conforme escopo.
O baseline:

- bloqueia INSERT com senha;
- bloqueia alteração da senha existente;
- remove execução de `gestman_login` de `PUBLIC`, `anon` e `authenticated`;
- não concede acesso direto à tabela para clientes.

Nenhuma remoção ou transformação de valores existentes foi executada.

## Grants

- `anon`: somente `USAGE` no schema `public`; nenhuma tabela ou RPC de
  aplicação foi concedida diretamente.
- `authenticated`: acesso apenas às tabelas protegidas por policies
  multiempresa e às RPCs necessárias.
- `service_role`: acesso administrativo às tabelas, sequences e funções para
  Edge Functions server-side.
- `PUBLIC`: sem `CREATE` no schema e sem execução automática das funções.

## Validações executadas

- confirmação de pasta, branch, remoto e commit inicial;
- confirmação do SHA-256 do dump;
- auditoria de dados e segredos no dump;
- comparação de objetos entre dump e baseline;
- 43/43 tabelas preservadas;
- 37/37 funções do dump preservadas;
- uma função de contenção adicionada;
- 19 policies públicas seguras preservadas;
- 20 policies permissivas omitidas;
- quatro policies de Storage incluídas;
- 14/14 triggers preservados e um trigger de contenção adicionado;
- view preservada;
- parênteses balanceados;
- tags dollar-quote balanceadas;
- uma transação `BEGIN`/`COMMIT`;
- zero `USING (true)` e zero `WITH CHECK (true)`;
- zero INSERT/COPY de dados no nível superior;
- zero grants públicos inseguros detectados;
- `git diff --check` sem erro.

## Validação local e bloqueios

O cliente Docker 29.6.2 está instalado, mas o daemon Docker Desktop não estava
em execução e o named pipe `docker_engine` não existia. Também não há `psql`
local. Por isso, não foi possível executar o baseline em PostgreSQL descartável
nesta tarefa. Nenhum resultado de execução de banco foi presumido.

O snapshot registra um event trigger chamado `rls_auto_enable`, porém o dump
schema-only contém apenas a função associada e não contém o `CREATE EVENT
TRIGGER` exato. A função foi preservada, mas o vínculo do event trigger não foi
inventado e permanece bloqueado até uma definição autoritativa.

Antes de aplicar no staging, ainda é obrigatório:

1. validar o baseline em Supabase local/Docker com schemas e roles gerenciados;
2. provisionar o bucket privado por API/CLI;
3. definir como registrar o baseline no histórico para não reaplicar migrations
   históricas equivalentes;
4. executar os testes negativos de RLS, RPC e Storage.

## Garantias da tarefa

- Produção alterada: **Não**.
- Staging alterado: **Não**.
- Frontend alterado: **Não**.
- Migration remota aplicada: **Não**.
- Push realizado: **Não**.
- Deploy realizado: **Não**.
