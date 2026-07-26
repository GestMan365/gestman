# Supabase staging validation report

Data: 2026-07-26
Commit de origem: `0c86d90`

## Ambiente

- Homologação: `GestMan365 Staging`.
- Referência mascarada: `ddab...acxe`.
- Região: `us-west-1`.
- Status: saudável.
- Criado recentemente, em 2026-07-26.
- Produção: `GestMan365 CMMS`, com referência e URL diferentes.
- O site público permanece configurado para produção.

A cópia local foi vinculada somente ao staging. O vínculo foi comparado
localmente com as referências conhecidas antes de qualquer inspeção de banco.

## Prova disponível de isolamento

- nomes, referências e URLs de staging e produção são diferentes;
- staging não aparece em nenhum arquivo rastreado do frontend;
- não existem migrations remotas registradas no staging;
- não existem Edge Functions no staging;
- a inspeção de tabelas não retornou tabelas de aplicação;
- a listagem de Storage não retornou objetos;
- nenhum branch de banco foi listado;
- nenhuma alteração foi executada em produção.

O CLI não expõe o estado da integração GitHub no comando de listagem de
projetos. Não foi encontrado vínculo do staging no repositório ou em workflows,
mas a integração do painel Supabase permanece como item de confirmação manual.

## Baseline

O baseline vazio foi registrado em `supabase/staging-baseline`.

O dump SQL estrutural não foi produzido porque o Supabase CLI requer Docker
Desktop para executar `pg_dump` e o componente não está disponível neste
computador. O arquivo `schema.sql` contém somente a evidência da tentativa.

## Bloqueio de reconstrução

O staging está vazio, mas o repositório não contém a migration inicial completa.
A primeira migration disponível depende de tabelas, helpers, RPCs e constraints
anteriores ausentes. O snapshot versionado é parcial e proíbe seu uso como
`CREATE TABLE` completo.

Por esse motivo, as migrations abaixo não foram aplicadas:

- `202607220001_security_legacy_hardening.sql`;
- `202607220002_security_bootstrap_and_rpc_grants.sql`;
- `202607220003_security_storage_policies.sql`.

Aplicá-las isoladamente produziria sucesso parcial enganoso: a migration 001
ignora tabelas ausentes, a 002 ignora RPCs ausentes e a 003 não criaria policies
sem `storage.objects`.

## Bootstrap server-side

O fluxo existente foi revisado. A Edge Function ainda não atende integralmente
ao contrato exigido:

- não há idempotência persistida e transacional;
- o contrato exato de `gm_consume_public_rate_limit` não está versionado;
- faltam definições completas das tabelas e RPCs atômicas de bootstrap;
- não é possível provar rollback entre Supabase Auth, empresa e membership;
- a compatibilidade completa depende do esquema funcional ausente.

O código não foi modificado com contratos ou objetos inventados. A migration
de baseline revisável registra as dependências que precisam ser recuperadas.

## Testes

Executados:

- listagem dos projetos e comparação de produção/staging;
- confirmação do vínculo local exclusivo ao staging;
- listagem de migrations remotas;
- inspeção de estatísticas de tabelas;
- listagem de Edge Functions;
- listagem de Storage;
- listagem de branches;
- inspeção das migrations e snapshots locais.

Não executados:

- RLS;
- RPC;
- Storage;
- onboarding/bootstrap;
- testes de regressão;
- criação de dados `QA-SECURITY`.

Os testes não foram executados porque o esquema funcional não existe no
staging. Nenhum dado QA foi criado e, portanto, não houve limpeza.

## Resultado e recomendação

- Migrations aplicadas no staging: nenhuma.
- Edge Functions publicadas no staging: nenhuma.
- Rollback utilizado: não.
- Coluna legada `senha`: risco não validado no staging.
- Tabelas sem policies: risco não validado no staging.
- Storage: vazio; policies ainda não aplicadas.
- Rate limit: contrato remoto não reproduzível a partir do Git.
- Frontend: não alterado.

Recomendação: não promover nada para produção. Primeiro recuperar o dump oficial
somente de esquema ou o histórico completo de migrations, reconstruir o staging
desde zero, revisar o baseline, publicar as Edge Functions no staging e somente
então executar os testes de segurança.
