# GestMan365 - escopo da correção de segurança

Data da análise: 2026-07-22. Este documento usa apenas o snapshot de catálogo e o código
versionado. Nenhuma linha empresarial, segredo ou valor da coluna `senha` foi consultado.

## Identidade multiempresa confirmada

O modelo de autorização relevante no remoto é:

`auth.uid()` -> `gm_company_members.user_id` -> `gm_companies.id`

O acesso empresarial só é válido quando:

1. o membro está ativo;
2. o perfil do usuário não está inativo;
3. a empresa está ativa;
4. a ação está dentro do papel/permissão do membro;
5. o administrador global está ativo em `gm_platform_admins`.

Metadados de `auth.users`, `company_id` vindo do navegador, campos JSONB e qualquer valor
do frontend não são fonte de autorização.

## Políticas permissivas confirmadas

| Tabela | Política | Problema | Decisão |
|---|---|---|---|
| `ativos` | `prototipo_select_ativos`, `prototipo_insert_ativos`, `prototipo_update_ativos` | `USING (true)` / `WITH CHECK (true)` | remover e bloquear acesso direto legado |
| `chamados` | policies `prototipo_*` equivalentes | filtros verdadeiros | remover e bloquear acesso direto legado |
| `ordens_servico` | policies `prototipo_*` equivalentes | filtros verdadeiros | remover e bloquear acesso direto legado |
| `pecas` | policies `prototipo_*` equivalentes | filtros verdadeiros | remover e bloquear acesso direto legado |
| `preventivas` | policies `prototipo_*` equivalentes | filtros verdadeiros | remover e bloquear acesso direto legado |
| `gestman_empresas` | `gestman_empresas_insert_public` | INSERT público com `WITH CHECK (true)` | revogar e impedir escrita direta |
| `gestman_usuarios` | `gestman_usuarios_insert_public` | INSERT público com `WITH CHECK (true)` | revogar e impedir escrita direta |

## Coluna textual de senha

`public.gestman_usuarios.senha` existe como `text`. A análise confirmou:

- o frontend legado chama `gestman_login(p_login, p_email, p_senha)`;
- o frontend moderno usa Supabase Auth;
- a coluna não pode ser removida nesta tarefa;
- novas gravações devem ser bloqueadas;
- não é aceitável restaurar políticas públicas inseguras.

Estratégia adotada nesta sessão:

1. conter novas escritas na coluna com trigger;
2. revogar acesso direto legado;
3. manter a remoção da coluna para uma etapa futura, após telemetria e dump oficial;
4. não consultar valores;
5. não criar view genérica com `SELECT *`.

## gm_bootstrap_company

`gm_bootstrap_company(text,text,text)` foi confirmado no snapshot como `SECURITY DEFINER`
com `search_path` fixo em `public` e execução observada para `service_role`.

Decisão preparada, mas ainda bloqueada para implantação:

- manter a superfície restrita a `service_role`;
- criar futuramente uma Edge Function autenticada para uso server-side;
- não conceder acesso público/autenticado;
- reutilizar a transação de `gm_bootstrap_company`, que cria empresa, perfil, vínculo,
  estado vazio, preferências e auditoria;
- não expor senha, token ou metadado sensível.

A Edge Function de bootstrap e a troca da chamada direta no frontend não fazem parte desta
entrega. Portanto, `202607220002` não pode ser promovida isoladamente: a revogação do acesso
direto ao bootstrap interromperia o cadastro inicial até que o fluxo server-side fosse
implementado e homologado.

## Migrations preparadas

As migrations abaixo podem ser preparadas localmente com o esquema capturado:

1. `202607220001_security_legacy_hardening.sql` - remove políticas permissivas conhecidas e bloqueia escrita direta da coluna `senha`.
2. `202607220002_security_bootstrap_and_rpc_grants.sql` - restringe o bootstrap existente e os grants de funções críticas.
3. `202607220003_security_storage_policies.sql` - materializa as políticas do bucket privado `gestman-attachments`.

Não existe quarta migration nesta entrega. A definição de uma migration adicional está
bloqueada até existir dump oficial `--schema-only`, ambiente isolado e dependências
confirmadas. Nenhuma migration vazia foi criada.

## Migrations marcadas como bloqueadas

As seguintes migrações não foram preparadas como incremento aplicável nesta sessão:

1. normalização das 20 tabelas sem política própria;
2. remoção definitiva da coluna `senha`;
3. qualquer política multiempresa para tabelas legadas sem coluna `company_id` confirmada;
4. qualquer reintrodução de acesso público a tabelas legadas;
5. qualquer rollback que restaure políticas públicas inseguras.
6. Edge Function de bootstrap e alteração correspondente do frontend.

## Funções revisadas

- `gm_bootstrap_company`
- `gm_load_tenant_state`
- `gm_save_tenant_state`
- `gm_current_context`
- `gm_list_company_users`
- `gm_upsert_company_user_internal`
- `gm_set_company_user_active_internal`
- `gm_manage_company`
- `gm_review_company_request`
- `gm_touch_company_access`
- `gm_submit_company_request`
- `gm_convert_company_request_internal`
- `gm_convert_company_request_with_access_internal`
- `gm_storage_company_id`
- `gm_storage_module`
- `gm_state_key_module`
- `gm_member_can`
- `gm_member_module_level`
- `gm_profile_default_level`
