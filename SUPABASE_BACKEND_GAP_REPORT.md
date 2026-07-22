# GestMan365 — Supabase Backend Gap Report

Data da inspeção: 2026-07-22  
Projeto: `GestMan365 CMMS`  
Referência: `zkkyiqtzmimcoderjrrm`  
Região: `us-west-1` (West US / North California)  
PostgreSQL: `17.6`  
Fonte: catálogo PostgreSQL e painel Supabase, consultados somente por leitura.

## Limites e garantias

- Nenhuma linha empresarial foi consultada ou exportada.
- Nenhuma migration, função de escrita ou alteração foi executada.
- Nenhum usuário, bucket, política, secret ou Edge Function foi alterado.
- O snapshot em `supabase/snapshot-current` é referência técnica, não migration aplicável.
- Não existe `supabase/config.toml`, vínculo local do CLI ou histórico de migrations registrado no painel.

## Inventário remoto confirmado

| Objeto | Quantidade | Observação |
|---|---:|---|
| Tabelas em `public` | 43 | Todas com RLS habilitado |
| Views | 1 | `vw_ordens_servico_completa` |
| Materialized views | 0 | — |
| Sequences | 3 | Auditoria de empresa, auditoria da plataforma e numeração de O.S. |
| Enums/domains próprios em `public` | 0 | Tipos nativos utilizados |
| Funções/procedures em `public` | 37 | Predominantemente funções SQL/PLpgSQL |
| Triggers de aplicação | 14 | Atualização, auditoria e proteção de perfil |
| Políticas RLS em `public` | 39 | 20 tabelas têm RLS sem política |
| Buckets | 1 | `gestman-attachments`, privado |
| Políticas de Storage | 4 | SELECT/INSERT/UPDATE/DELETE para `authenticated` |
| Edge Functions implantadas | 4 | Correspondem nominalmente às quatro pastas no Git |

Schemas observados: `auth`, `extensions`, `graphql`, `graphql_public`, `information_schema`, `pg_catalog`, `pgbouncer`, `public`, `realtime`, `storage` e `vault`.

Extensões observadas: `pg_stat_statements 1.11`, `pgcrypto 1.3`, `plpgsql 1.0`, `supabase_vault 0.3.1` e `uuid-ossp 1.1`.

Não foram observadas as extensões `pg_cron` ou `pg_net`; cron jobs e webhooks de banco não foram confirmados.

## Tabelas remotas

`ativos`, `chamados`, `checklists`, `company_requests`, `empresas`, `equipamentos`, `estoque_saldos`, `estoques`, `eventos_ordem_servico`, `fornecedores`, `gestman_empresas`, `gestman_usuarios`, `gm_audit_log`, `gm_companies`, `gm_company_members`, `gm_company_subscriptions`, `gm_company_units`, `gm_platform_admins`, `gm_platform_audit_log`, `gm_profiles`, `gm_public_rate_limits`, `gm_tenant_state`, `gm_user_preferences`, `locais_instalacao`, `movimentacoes_estoque`, `movimentacoes_estoque_itens`, `movimentacoes_tags`, `ordens_servico`, `pecas`, `perfil_permissoes`, `perfis`, `perfis_acesso`, `permissoes`, `preventivas`, `regioes`, `requisicoes_materiais`, `requisicoes_materiais_itens`, `subtags`, `subtags_equipamento`, `tags`, `transferencias_estoque`, `transferencias_estoque_itens`, `usuarios_empresas`.

### Núcleo multiempresa relevante

| Tabela | Metadados confirmados | RLS/políticas |
|---|---|---|
| `gm_companies` | UUID, nome, slug, status, criador, cadastro e dados cadastrais da empresa | RLS; 3 políticas por membro/plataforma |
| `gm_company_members` | empresa, usuário Auth, papel, ativo, usuário de acesso, perfil, níveis de permissão, região e executor | RLS; 3 políticas |
| `gm_profiles` | usuário Auth, exibição, contato, cargo, avatar, ativo e detalhes | RLS; 2 políticas |
| `gm_tenant_state` | empresa, estado JSONB, versão, atualizador e data | RLS; 1 política SELECT; escrita feita por RPC |
| `gm_user_preferences` | empresa, usuário, preferências JSONB e atualização | RLS; 1 política ALL própria |
| `gm_audit_log` | id bigint, empresa, usuário, ação, entidade, registro, metadata e data | RLS; 1 política SELECT por membro |
| `gm_platform_admins` | usuário Auth, papel, ativo e datas | RLS; 1 política do próprio administrador |
| `company_requests` | dados da solicitação, status, revisão, conversão e notificação | RLS; 2 políticas para administrador da plataforma |
| `gm_company_units` | empresa, nome, principal, ativo e datas | RLS; 1 política SELECT |
| `gm_company_subscriptions` | empresa, plano, limites, datas e status | RLS; 1 política SELECT |
| `gm_platform_audit_log` | ator, ação, entidade, registro, payload e data | RLS; 1 política SELECT da plataforma |
| `gm_public_rate_limits` | estrutura usada por `gm_consume_public_rate_limit` | RLS sem política; definição ausente no Git |

## RPCs críticas

| RPC | Retorno | Segurança | `search_path` | Acesso remoto observado | Situação no Git |
|---|---|---|---|---|---|
| `gm_bootstrap_company(text,text,text)` | dados da empresa criada | `SECURITY DEFINER` | `public` | `service_role` | Ausente como definição; chamada no frontend |
| `gm_load_tenant_state()` | empresa, JSONB, versão, data | `SECURITY DEFINER`, `STABLE` | `public` | PUBLIC/authenticated | Ausente como definição; chamada no frontend |
| `gm_save_tenant_state(bigint,jsonb)` | versão e data | `SECURITY DEFINER` | `public` | authenticated | Ausente como definição; chamada no frontend |

`gm_load_tenant_state` restringe o estado com `gm_is_company_member`. `gm_save_tenant_state` valida `auth.uid()`, empresa, versão otimista e nível por módulo antes de gravar. A implementação completa das três RPCs confirmadas está preservada em `supabase/snapshot-current/006_functions.sql` somente para referência.

## Classificação remoto x Git

### Versionado e nominalmente equivalente

- Edge Functions: `convert-company-request`, `manage-company-access`, `manage-company-user`, `submit-company-request`.
- Tabelas de onboarding: `company_requests`, `gm_company_units`, `gm_company_subscriptions`, `gm_platform_admins`, `gm_platform_audit_log`.
- Funções de onboarding, administração e usuários presentes nas migrations de 2026-07-16 a 2026-07-19.

A equivalência byte a byte das Edge Functions implantadas não pôde ser confirmada pelo painel; apenas nomes, presença e datas de implantação foram confirmados.

### Versionado, mas divergente

- `supabase-setup.sql` descreve um protótipo antigo com `locais` e `sub_tags`; o remoto usa `locais_instalacao`, `subtags` e estruturas adicionais.
- As tabelas `ativos`, `ordens_servico`, `pecas`, `preventivas` e `chamados` possuem colunas/índices remotos além do esquema inicial.
- A migration concede `gm_submit_company_request` a `anon, authenticated`; o catálogo remoto mostrou execução efetiva somente para `postgres/service_role`.
- Algumas funções foram redefinidas por migrations posteriores; somente a última definição deve ser considerada.

### Existente somente no remoto

- Núcleo: `gm_companies`, `gm_company_members`, `gm_profiles`, `gm_tenant_state`, `gm_user_preferences`, `gm_audit_log`, `gm_public_rate_limits`.
- Domínio CMMS complementar: checklists, equipamentos, estoques, fornecedores, movimentos, regiões, requisições, subtags, transferências e usuários empresariais.
- View `vw_ordens_servico_completa`.
- Sequences `gm_audit_log_id_seq`, `gm_platform_audit_log_id_seq`, `ordens_servico_numero_seq`.
- Funções auxiliares de estado, permissões, Storage, login legado, auditoria de O.S. e auto-RLS listadas no snapshot.
- Bucket e políticas de Storage.

### Existente somente no repositório

- Tabelas legadas `locais` e `sub_tags` de `supabase-setup.sql` não foram encontradas com esses nomes no remoto.
- `supabase/config.toml` não existe.

### Definição incompleta

- O repositório chama `gm_bootstrap_company`, `gm_load_tenant_state` e `gm_save_tenant_state`, mas não contém suas migrations.
- O repositório referencia várias tabelas básicas sem definir sua criação.
- Não há migration do bucket nem das quatro políticas de Storage.
- Não há migration da view e de várias sequences/triggers.

## Achados de segurança

### Crítico

1. Políticas `prototipo_*` usam `USING (true)`/`WITH CHECK (true)` para `public` em `ativos`, `chamados`, `ordens_servico`, `pecas` e `preventivas`. Isso permite acesso sem isolamento multiempresa conforme os grants efetivos da tabela.
2. `gestman_empresas_insert_public` e `gestman_usuarios_insert_public` permitem INSERT para `anon` e `authenticated` com `WITH CHECK (true)`. A tabela `gestman_usuarios` possui coluna `senha text`; o desenho é incompatível com Supabase Auth e exige retirada controlada.

### Alto

1. O estado operacional inteiro reside em um JSONB por empresa. Erro de mapeamento de módulo em `gm_state_key_module` pode ampliar escrita indevida.
2. Vinte tabelas têm RLS habilitado e nenhuma política. O padrão é negar acesso REST, mas funções `SECURITY DEFINER` ou grants diretos podem contornar esse bloqueio.
3. O núcleo multiempresa não é reproduzível a partir do Git; uma perda do projeto remoto impediria reconstrução confiável.
4. Há várias funções `SECURITY DEFINER` concedidas a PUBLIC; as verificações internas precisam permanecer cobertas por testes de autorização.

### Médio

1. `gm_load_tenant_state` está concedida a PUBLIC, embora a condição interna limite por associação.
2. O frontend contém caminhos legados de REST/localStorage além da implementação final baseada em estado remoto, dificultando provar qual implementação é efetiva.
3. O bucket existe, mas o frontend não chama `storage/v1`; anexos continuam no JSONB/base64.
4. Não há migrations registradas no painel, apesar de existirem arquivos locais.

### Baixo/informativo

- Todas as 43 tabelas públicas têm RLS habilitado.
- As quatro políticas do bucket usam associação à empresa e nível por módulo.
- As Edge Functions locais usam `service_role` somente no servidor e verificam usuário/escopo.

## Bloqueadores de reconstrução

1. Ausência das sete tabelas centrais e respectivas constraints.
2. Ausência das RPCs de bootstrap, estado e permissão.
3. Ausência da view, sequences e triggers complementares.
4. Ausência do Storage e suas políticas.
5. Ausência de um baseline ordenado que anteceda as migrations atuais.
6. Ausência de teste automatizado em banco vazio.

