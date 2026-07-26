# GestMan365 — Validação local do baseline Supabase

Data: 26/07/2026

Branch: `codex/github-current-20260722`

Escopo: execução local descartável, sem conexão com produção ou staging.

## Resultado executivo

O baseline `supabase/baseline/20260726_gestman_schema_baseline.sql` foi
executado com sucesso a partir de banco vazio. Foram necessárias três
tentativas controladas e duas correções comprovadas. A terceira tentativa
concluiu sem erro.

SHA-256 validado:
`DC78B41A5ABB7A3DC3062353C168638BFE244F92B2ECC594E9DBB45524BAABBA`

Tamanho: 109.104 bytes e 2.462 linhas.

## Ambiente descartável

- Docker Desktop: 4.83.0;
- Docker Client e Server: 29.6.2;
- Supabase CLI: 2.109.1;
- imagem PostgreSQL Supabase: PostgreSQL 17.6;
- pgTAP: 1.3.3;
- bind de rede: somente `127.0.0.1`;
- projeto remoto vinculado: nenhum;
- URL, project ref, token ou chave remota usada: nenhuma.

O diretório auxiliar ficou em `supabase/.temp/baseline-local-validation`, sob
regra de ignore existente. O contêiner foi removido ao final.

## Execução do baseline

### Tentativa 1

O DDL foi aplicado, porém a auditoria de catálogo confirmou que a função
legada `gestman_login` ainda declarava e selecionava a coluna `senha`.

Correção: remoção de `usuario_senha` do tipo de retorno e de `u.senha` do
`SELECT`. A comparação de credencial legada foi preservada e a função continua
sem grant para clientes.

### Tentativa 2

O DDL foi reaplicado em banco recriado. A auditoria encontrou a foreign key
`ordens_servico_equipamento_id_fkey` com `convalidated = false`, causada por
`NOT VALID`.

Correção: criação da constraint sem `NOT VALID`.

### Tentativa 3

O banco foi novamente recriado e o baseline foi aplicado integralmente.
Resultado final do catálogo:

| Objeto | Quantidade | Resultado |
|---|---:|---|
| Tabelas | 43 | aprovado |
| Funções | 38 | aprovado |
| Constraints | 140 | todas validadas |
| Índices fora de constraints | 20 | todos válidos |
| Sequences | 3 | aprovado |
| Views | 1 | aprovado |
| Triggers | 15 | aprovado |
| Policies `public` | 19 | aprovadas |
| Tabelas com RLS | 43 | 43/43 |
| Policies de Storage | 0 | bloqueadas pelo ambiente |

As 140 constraints do catálogo incluem 114 declarações `ADD CONSTRAINT` e 26
constraints definidas diretamente nas tabelas.

## Testes de segurança

Foram criadas fixtures locais fixas e fictícias com prefixo
`QA-LOCAL`/`QA-SECURITY`, duas empresas, usuários ativos de empresas
diferentes, usuário inativo e administrador da empresa A. Os e-mails usaram o
domínio reservado `example.invalid`.

As especificações de `tests/security/rls.spec.sql` e
`tests/security/rpc.spec.sql` foram exercitadas por um harness pgTAP com troca
controlada de roles e claims.

Resultado final: **26 aprovados, 0 reprovados**.

Cobertura comprovada:

- isolamento entre empresas A e B;
- leitura e gravação do estado somente no tenant autorizado;
- ausência de contexto para usuário inativo;
- bloqueio de operações anônimas;
- bloqueio de bootstrap ao papel `authenticated`;
- incremento de versão pela RPC de gravação;
- bloqueio da RPC legada de login para `anon` e `authenticated`;
- bloqueio de escrita na coluna textual `senha`;
- nenhuma função retornando `senha`;
- nenhum `EXECUTE` de função para `PUBLIC` ou `anon`;
- nenhuma policy com `USING (true)` ou `WITH CHECK (true)`;
- todas as funções `SECURITY DEFINER` com `search_path`;
- RLS habilitado nas 43 tabelas.

Uma primeira execução do harness mostrou seis `not ok` porque foi usada a
assinatura de dois argumentos de `throws_ok` como se o segundo argumento fosse
uma descrição. Os erros reais esperados ocorreram. A assinatura do teste foi
corrigida e a reexecução terminou em 26/26; não houve correção funcional
decorrente desse problema do harness.

## Migrations de segurança

Aplicadas somente no banco local e após o baseline:

1. `202607220001_security_legacy_hardening.sql` — aprovada;
2. `202607220002_security_bootstrap_and_rpc_grants.sql` — aprovada localmente;
3. `202607220003_security_storage_policies.sql` — transação aprovada.

A migration 002 permanece bloqueada para promoção remota até a implementação
do bootstrap server-side seguro.

A migration 003 executou o bloco condicional sem criar policies, pois o
contêiner somente de banco não possuía as tabelas gerenciadas
`storage.objects` e `storage.buckets`. Por isso, `storage.spec.sql` não foi
executado e Storage permanece **não validado funcionalmente**.

## Regressão após migrations

As contagens permaneceram:

- 43 tabelas;
- 38 funções;
- 140 constraints, zero não validadas;
- 20 índices fora de constraints, zero inválidos;
- 15 triggers;
- 19 policies no schema `public`;
- RLS em 43 tabelas;
- zero funções retornando `senha`;
- zero grants de função para `PUBLIC` ou `anon`;
- zero policies universalmente permissivas;
- zero funções `SECURITY DEFINER` sem `search_path`.

A view `vw_ordens_servico_completa` foi consultada sem erro.

## Limitações e bloqueios

- Storage completo precisa ser inicializado para testar bucket, upload,
  download e as quatro policies.
- O bootstrap server-side deve existir antes da promoção remota da migration
  002.
- A estratégia de baseline/squash no histórico de migrations ainda deve ser
  definida antes de aplicar no staging.
- O event trigger associado a `rls_auto_enable` não foi recriado porque o dump
  não contém sua definição autoritativa.
- Os arquivos `tests/security/*.spec.sql` são especificações e não configuram
  sozinhos roles/claims; RLS e RPC foram executados pelo harness local. Storage
  permaneceu bloqueado.

## Limpeza

Todas as fixtures QA criadas foram removidas por IDs fixos. A consulta final
retornou zero registros QA. O contêiner foi parado e removido, e nenhum serviço
local da validação permaneceu ativo.

## Garantias

- Produção alterada: **Não**.
- Staging alterado: **Não**.
- Frontend alterado: **Não**.
- Push realizado: **Não**.
- Deploy realizado: **Não**.
