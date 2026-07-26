# GestMan365 — Validação local do baseline Supabase

Data: 26/07/2026

Branch: `codex/github-current-20260722`

Escopo: banco Docker descartável, sem conexão com produção ou staging.

## Artefato validado

- Arquivo: `supabase/baseline/20260726_gestman_schema_baseline.sql`
- SHA-256: `AA0EB41C4BDF1BF562570AD8CC91FA14F4FE0248D6A03CD88667F518FDA4A65D`
- Tamanho: 107.162 bytes
- Linhas: 2.012

## Ambiente

- Docker Desktop: 4.83.0
- Docker Client e Server: 29.6.2
- Supabase CLI: 2.109.1
- PostgreSQL Supabase: 17.6
- Rede publicada somente em `127.0.0.1`
- Projeto remoto usado: nenhum

## Resultado

O baseline corrigido foi executado do zero e terminou sem erro:

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

O baseline não executa DDL nas tabelas gerenciadas de Storage. As policies de
Storage permanecem na migration dedicada e foram testadas no staging real,
onde o serviço gerenciado está disponível.

## Bootstrap server-side

O baseline e a migration de hardening com
`gm_bootstrap_company_server` também foram executados em banco descartável.
Duas identidades Auth fictícias foram criadas apenas para o teste.

Resultado:

- primeira chamada criou empresa e vínculo;
- repetição com a mesma chave retornou o mesmo resultado sem duplicar;
- exatamente uma empresa, um membro, um estado, uma preferência e um evento
  de auditoria foram criados;
- a chave de idempotência em texto puro não foi persistida;
- a transação de teste foi revertida;
- o contêiner foi removido.

## Correções comprovadas durante a validação

1. `gestman_login` deixou de retornar a coluna textual `senha`.
2. A foreign key `ordens_servico_equipamento_id_fkey` passou a ser criada já
   validada.
3. A função server-side deixou de depender de uma coluna opcional
   `auth.users.deleted_at`, aumentando a portabilidade.
4. O DDL de policies de Storage foi retirado do baseline e mantido apenas na
   migration dedicada, pois `storage.objects` é uma tabela gerenciada por
   outro proprietário.

## Checks de segurança

- zero funções retornando `senha`;
- zero grants de função para `PUBLIC` ou `anon`;
- zero policies com `USING (true)` ou `WITH CHECK (true)`;
- zero funções `SECURITY DEFINER` sem `search_path`;
- zero constraints não validadas;
- zero índices inválidos;
- RLS habilitado nas 43 tabelas;
- nenhuma credencial ou referência remota usada.

## Limitações conhecidas

- O event trigger associado à função `rls_auto_enable` não foi recriado porque
  a definição autoritativa não existe no dump.
- O teste local isolado não sobe o serviço completo de Storage; a validação
  funcional de Storage foi feita exclusivamente no staging.

## Limpeza e garantias

Todas as fixtures locais foram revertidas e o contêiner foi removido.

- Produção alterada: **Não**.
- Staging alterado por esta validação local: **Não**.
- Frontend alterado por esta validação local: **Não**.
- Push realizado: **Não**.
- Deploy realizado: **Não**.
