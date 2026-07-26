# GestMan365 — Relatório do baseline Supabase

Data: 26/07/2026

Branch: `codex/github-current-20260722`

## Resultado executivo

O arquivo `supabase/baseline/20260726_gestman_schema_baseline.sql` reconstrói
o esquema funcional do GestMan365 sem dados empresariais, usuários Auth,
objetos de Storage, credenciais, URLs ou identificadores de projeto.

- SHA-256: `AA0EB41C4BDF1BF562570AD8CC91FA14F4FE0248D6A03CD88667F518FDA4A65D`
- Tamanho: 107.162 bytes
- Linhas: 2.012
- Tabelas: 43
- Funções no baseline: 38
- Constraints: 140, todas validadas
- Índices não associados a constraints: 20, todos válidos
- Sequences: 3
- Views: 1
- Triggers: 15
- Policies no schema `public`: 19
- Tabelas com RLS: 43 de 43

O dump bruto usado como fonte permanece em `supabase/.temp/`, ignorado pelo
Git. Seu SHA-256 foi confirmado como
`325436B44ABEA12B89C26A623661925CC17B57DBA468FEE38A57377D0285B995`.

## Auditoria da fonte

O dump foi verificado antes da geração:

- zero `COPY ... FROM stdin`;
- zero `INSERT` de dados no nível superior;
- os `INSERT` encontrados pertencem somente a corpos de funções/RPCs;
- zero criação ou carga de `auth.users`;
- zero carga de `storage.objects`;
- nenhum token, chave, senha, URL de projeto, project ref ou string de conexão;
- nenhum dado empresarial identificado.

## Objetos incluídos

O baseline inclui as extensões de aplicação `pgcrypto` e `uuid-ossp`, as 43
tabelas do dump, seus tipos, sequences, constraints, chaves estrangeiras,
índices, helpers de autorização, funções, RPCs, triggers, a view
`vw_ordens_servico_completa`, RLS restritiva e grants mínimos.

As funções críticas de tenant, onboarding, administração, auditoria e estado
foram preservadas. A contenção da coluna textual legada
`public.gestman_usuarios.senha` também foi mantida:

- escrita de senha bloqueada;
- valor não retornado pela função legada;
- função legada sem execução para `PUBLIC`, `anon` ou `authenticated`;
- tabela sem acesso direto de clientes.

## Storage

O baseline não altera tabelas gerenciadas do schema `storage`, não tenta
habilitar RLS nelas e não cria bucket. A primeira aplicação em staging
demonstrou que o proprietário da conexão de migrations não é o proprietário de
`storage.objects`; por isso, o bloco condicional de policies foi removido do
baseline.

As quatro policies de Storage são aplicadas exclusivamente pela migration
`202607220003_security_storage_policies.sql`, depois da confirmação de que o
Storage gerenciado e o bucket privado existem:

- `gm_storage_select`;
- `gm_storage_insert`;
- `gm_storage_update`;
- `gm_storage_delete`.

## Objetos deliberadamente omitidos

- policies com `USING (true)` ou `WITH CHECK (true)`;
- grants amplos para `PUBLIC`, `anon` ou `authenticated`;
- owners fixos e `ALTER DEFAULT PRIVILEGES` permissivo;
- schemas e tabelas gerenciados automaticamente pelo Supabase;
- criação/carga de usuários Auth;
- buckets, metadados ou objetos de Storage;
- dados, tokens, chaves, URLs e project refs;
- dump bruto temporário;
- event trigger associado a `rls_auto_enable`, cuja definição autoritativa não
  existe nas fontes disponíveis.

## Validação local descartável

O baseline corrigido foi reaplicado do zero em PostgreSQL Supabase 17.6
descartável no Docker. A execução foi concluída sem erro e o catálogo resultou
em 43 tabelas, 38 funções, 140 constraints validadas, 20 índices válidos,
3 sequences, 1 view, 15 triggers, 19 policies públicas e RLS nas 43 tabelas.
O contêiner foi removido ao final.

Checks estáticos confirmaram:

- zero policies universalmente permissivas;
- zero funções retornando `senha`;
- zero grants de função para `PUBLIC` ou `anon`;
- zero funções `SECURITY DEFINER` sem `search_path`;
- zero índices inválidos;
- zero constraints não validadas;
- `git diff --check` sem erros.

## Aplicação controlada no staging

O baseline foi aplicado somente ao projeto GestMan365 Staging. A primeira
tentativa falhou de forma transacional ao tentar alterar
`storage.objects`; nenhuma alteração parcial permaneceu. Após separar o DDL
gerenciado de Storage, o baseline foi revalidado localmente e aplicado com
sucesso ao staging.

Produção não foi acessada para escrita e não recebeu migration, função, dado,
bucket ou configuração.

## Garantias

- Produção alterada: **Não**.
- Staging alterado: **Sim, somente reconstrução autorizada**.
- Dados de produção copiados: **Não**.
- Frontend de produção publicado: **Não**.
- Push realizado: **Não**.
- Deploy público realizado: **Não**.
