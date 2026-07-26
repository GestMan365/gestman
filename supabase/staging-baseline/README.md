# GestMan365 staging baseline

Captura realizada em 2026-07-26, a partir do commit Git `0c86d90`.

## Ambiente confirmado

- Projeto: `GestMan365 Staging`.
- Project ref mascarado: `ddab...acxe`.
- Região: `us-west-1`.
- Situação: `ACTIVE_HEALTHY`.
- Criado em 2026-07-26.
- Produção conhecida: `GestMan365 CMMS`, com project ref e URL diferentes.
- O frontend público continua apontando para o projeto de produção.

Nenhum token, chave, senha, usuário ou dado operacional foi exportado.

## Metadados observados antes de alterações

- Histórico remoto de migrations: vazio.
- Tabelas de aplicação visíveis em `public`: nenhuma.
- Edge Functions: nenhuma.
- Objetos/buckets listados pelo Storage CLI: nenhum.
- Branches de banco: nenhum.
- Estatísticas de tabelas: nenhuma tabela de aplicação retornada.
- Referência do staging em arquivos rastreados do repositório: nenhuma.

Esses resultados são compatíveis com um projeto Supabase recém-criado. Eles
não substituem uma consulta administrativa de `auth.users`; portanto, o
relatório não afirma uma contagem de usuários que não pôde ser consultada.

## Limitação da captura

O comando de dump estrutural não foi concluído porque o Supabase CLI exige
Docker Desktop para executar `pg_dump` neste computador. O arquivo
`schema.sql` registra essa limitação e não contém DDL inventado.

## Capacidade de reconstrução

O repositório não possui uma migration inicial completa para o esquema atual.
As migrations versionadas começam em `202607160004` e dependem de objetos que
já deveriam existir, incluindo:

- `public.gm_companies`;
- `public.gm_profiles`;
- `public.gm_company_members`;
- `public.gm_tenant_state`;
- `public.gm_user_preferences`;
- `public.gm_audit_log`;
- helpers de autorização, estado e Storage;
- tabelas operacionais legadas.

O diretório `supabase/snapshot-current` é uma referência de catálogo e declara
expressamente que não é um `CREATE TABLE` completo. Aplicar apenas as
migrations atuais no staging vazio produziria um esquema parcial e resultados
de segurança falsos.

## Próxima condição de desbloqueio

Obter um dump oficial somente de esquema, sem dados, ou migrations históricas
completas que permitam reconstruir o banco desde zero. Depois, revisar e
promover `202607150001_gestman_baseline.review.sql` para uma migration
executável.
