# GestMan365 — manifesto da release candidata de produção

## Identificação

- Release candidata: `gestman365-rc-20260728-fdb8582`
- Branch de origem: `codex/github-current-20260722`
- Commit funcional auditado: `fdb8582`
- Base remota observada em 28/07/2026: `origin/main`
- Divergência após `git fetch --prune origin`: 9 commits locais à frente e 0 commits remotos ausentes localmente
- Estado: candidata preparada; **não autorizada para produção até a checklist GO/NO-GO ser integralmente aprovada**
- Início da implantação: `________________`
- Término da implantação: `________________`
- Release manager: `________________`
- DBA/Supabase responsável: `________________`
- Responsável pelo rollback: `________________`
- Aprovação técnica: `________________`
- Aprovação de negócio: `________________`
- Evidências: `________________`

Este documento não contém URLs completas, project refs, chaves, tokens ou senhas.

## Commits incluídos

Em ordem cronológica, relativamente a `origin/main`:

1. `8cad5c6` — documentação da arquitetura Supabase atual;
2. `0c86d90` — preparação da remediação RLS multiempresa;
3. `fe1cbe1` — validação do bootstrap seguro no staging;
4. `972c250` — baseline reproduzível do esquema Supabase;
5. `8a9ba32` — validação local do baseline;
6. `13225af` — reconstrução e validação do staging;
7. `60e3aa2` — validação do frontend oficial no staging;
8. `18031ed` — correções de segurança e runtime;
9. `fdb8582` — remediação segura de dependências.

Não há commit remoto novo em `origin/main` ausente nesta branch na data da preparação.

## Conteúdo destinado à produção

### Migrations incrementais

Somente estas cinco migrations são candidatas. O baseline e migrations históricas não devem ser reaplicados em uma produção existente.

| Ordem | Arquivo | Finalidade principal |
|---:|---|---|
| 1 | `202607220001_security_legacy_hardening.sql` | Remover acessos legados permissivos, bloquear escrita de senha textual e criar a RPC interna de bootstrap |
| 2 | `202607220002_security_bootstrap_and_rpc_grants.sql` | Restringir grants das RPCs conforme o consumidor autorizado |
| 3 | `202607220003_security_storage_policies.sql` | Estabelecer as quatro policies privadas do bucket de anexos |
| 4 | `202607280001_storage_path_canonicalization.sql` | Validar paths de Storage e substituir as policies pelas versões canônicas |
| 5 | `202607280002_membership_profile_separation.sql` | Separar ativação do membership empresarial da ativação global do perfil |

A migration 002 somente pode entrar depois de `bootstrap-company` estar publicada e o fluxo server-side estar validado. Como ela revoga a RPC antiga do navegador, o corte do frontend deve ser coordenado na mesma janela.

### Funções PostgreSQL e RPCs novas ou alteradas

- `gm_block_legacy_password_writes()` — nova;
- `gm_bootstrap_company_server(uuid,text,text,text,text)` — nova, exclusiva de `service_role`;
- `gm_storage_path_is_canonical(text)` — nova;
- `gm_storage_company_id(text)` — substituída pela versão canônica;
- `gm_storage_module(text)` — substituída pela versão canônica;
- `gm_upsert_company_user_internal(...)` — substituída para preservar o perfil global;
- `gm_set_company_user_active_internal(uuid,uuid,uuid,boolean)` — substituída para atuar somente no membership;
- `gm_set_global_user_active_internal(uuid,uuid,boolean)` — nova, exclusiva de administração da plataforma;
- grants revistos para as RPCs de contexto, estado, usuários, plataforma, bootstrap, onboarding, Storage e rate limit listadas na migration 002.

### RLS e Storage

- Remoção condicional de policies legadas `prototipo_*` em ativos, chamados, ordens, peças e preventivas;
- remoção de policies públicas legadas nas tabelas `gestman_empresas` e `gestman_usuarios`;
- RLS habilitada em `gestman_usuarios`, quando a tabela existir;
- policies `gm_storage_select`, `gm_storage_insert`, `gm_storage_update` e `gm_storage_delete`;
- bucket esperado: privado, com identidade operacional previamente validada e sem exposição pública;
- paths aceitos: `<company_uuid>/<module>/<arquivo...>`, com módulos `orders`, `assets`, `stock` ou `documents`.

### Edge Functions destinadas à produção

| Função | Situação | Dependências |
|---|---|---|
| `bootstrap-company` | Nova | Auth válido, `gm_consume_public_rate_limit` e `gm_bootstrap_company_server` |
| `submit-company-request` | Alterada | `gm_consume_public_rate_limit`, `gm_submit_company_request`, tabelas de solicitação/empresa e secrets já administrados no ambiente |

As funções `convert-company-request`, `manage-company-access` e `manage-company-user` não tiveram código alterado nesta release; devem ser verificadas, mas não republicadas sem necessidade.

### Frontend destinado à produção

- `index.html`;
- `404.html`.

Os dois arquivos devem ser publicados juntos. As mudanças cobrem:

- bootstrap pelo endpoint server-side autenticado;
- tratamento da resposta 429 do onboarding;
- separação textual entre remover acesso empresarial e desativar perfil global;
- definição e uso seguro de `orderDueState`.

### Build, testes e configuração

- `package.json` e `package-lock.json`;
- configuração Playwright oficial;
- scripts de preparação/validação do staging;
- testes E2E oficiais e testes estáticos de segurança;
- relatórios de arquitetura, baseline, staging, segurança, runtime e dependências.

O lockfile é parte da fonte reproduzível, não um arquivo servido ao navegador.

## Hashes SHA-256

| Artefato | SHA-256 |
|---|---|
| Baseline `20260726_gestman_schema_baseline.sql` | `aa0eb41c4bdf1bf562570ad8cc91fa14f4fe0248d6a03cd88667f518fda4a65d` |
| Migration `202607220001_security_legacy_hardening.sql` | `1d2e1ed31cd5a3e18c09bee15df4903334779cdc4640684b8f465080d4c4a9b9` |
| Migration `202607220002_security_bootstrap_and_rpc_grants.sql` | `78904108e839d5f59e71e76716068c292114566241e092f6472d8baa4206aa9f` |
| Migration `202607220003_security_storage_policies.sql` | `d0d89c905b40c1a9eb1fe9d91d82092eab7457a02338ee6527fcc38d51829907` |
| Migration `202607280001_storage_path_canonicalization.sql` | `8de0c830a180e63d2f9b260d10aeba47e1ce2b29328b87dea26fc3fb01aeb358` |
| Migration `202607280002_membership_profile_separation.sql` | `c36b8675393ec2241b5352e0bcf318ec1673490e2e97a09e29df6ad8ee70843d` |
| Edge Function `bootstrap-company/index.ts` | `cd038fc94f21e2ed751066b7e979bbd0009bd7eaaedfb8a30a50f0958eb9f70c` |
| Edge Function `submit-company-request/index.ts` | `f4d9ac8fd99ea71df905ff8c9ec5a74d8ab02bdb6f15e1da9b0fd889f36792bc` |
| `index.html` | `33bd9edfbcb4180c1bfc3d60218e46df496f9179e1fd62a8094f3263d366daf7` |
| `404.html` | `7e1b8d18e91f277eecb5b8414ab9a1c000adf49020223cbacc7b5509de3ebc96` |
| `package-lock.json` | `02865de9cb25b7ec00712aee632eb9d88f13333278fd6bb3b02769ce62ccd75c` |

`index.html` e `404.html` têm hashes diferentes porque já possuem diferenças estruturais próprias do fallback 404; os blocos funcionais críticos alterados devem permanecer sincronizados.

## Objetos que não devem ser publicados ou aplicados

- `supabase/baseline/20260726_gestman_schema_baseline.sql` em produção existente;
- `supabase/snapshot-current/` e `supabase/staging-baseline/`;
- dumps, `.env`, arquivos temporários, logs, dados ou usuários QA;
- relatórios e scripts de teste como artefatos públicos da aplicação;
- `tests/` e configuração Playwright no hosting público;
- aplicação React paralela em `src/`;
- servidor Vite;
- `service_role` ou qualquer secret no frontend;
- migrations históricas já registradas em produção;
- qualquer objeto não inventariado neste manifesto.

## Estado de validação conhecido

- Staging: 22/22 E2E oficiais, 10/10 bootstrap, 56/56 segurança integrada e 91/91 validações de onboarding/JavaScript;
- QA residual registrado após a última validação: zero;
- TypeScript da aplicação e da configuração Node: aprovados novamente na preparação desta release;
- build Vite local: aprovado novamente, com 3 módulos transformados e artefato principal de aproximadamente 6,18 MB (3,26 MB gzip);
- validações locais de onboarding/JavaScript: 91/91;
- checks estáticos locais de segurança: aprovados;
- suíte E2E oficial: 22 testes inventariados; não executada nesta preparação porque depende do staging, cujo uso foi proibido nesta tarefa;
- blocos críticos alterados em `index.html` e `404.html`: ocorrências equivalentes para bootstrap, onboarding, rate limit, membership e `orderDueState`;
- hashes do manifesto: recalculados e conferidos localmente;
- Deno `check` e `lint`: aprovados;
- PostCSS corrigido e Nano ID transitivo atualizado;
- Vite/esbuild: risco residual somente de desenvolvimento;
- React Router: risco residual restrito à aplicação React paralela não autorizada para publicação;
- formatação Deno preexistente: dívida não bloqueante;
- bundle estático grande: risco de desempenho não bloqueante.

## Riscos e pendências para GO

Bloqueadores até comprovação em produção:

- identificação inequívoca do projeto;
- backup completo concluído e restauração verificável;
- catálogo e migration history atuais capturados;
- drift entre produção e baseline/migrations analisado;
- bucket privado, policies e objetos gerenciados confirmados;
- versões atuais das Edge Functions preservadas para rollback;
- responsáveis, janela e autoridade de rollback definidos;
- estratégia de aplicação unitária da migration 001 e corte coordenado antes da migration 002 aprovada.

Não bloqueadores conhecidos:

- bundle estático superior a 500 kB;
- quatro advisories sem impacto no bundle publicado, desde que Vite e a aplicação React paralela não sejam expostos/publicados;
- `deno fmt --check` aponta formatação preexistente.
