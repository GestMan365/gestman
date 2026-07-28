# GestMan365 — runbook de implantação controlada em produção

## Controle da execução

- Release candidata: `gestman365-rc-20260728-fdb8582`
- Manifesto: `PRODUCTION_RELEASE_MANIFEST.md`
- Início: `________________`
- Término: `________________`
- Release manager: `________________`
- Operador Supabase/DBA: `________________`
- Operador frontend: `________________`
- Responsável pelo rollback: `________________`
- Aprovador técnico: `________________`
- Evidências centralizadas em: `________________`

Este runbook é um plano. Nenhuma etapa remota foi executada durante sua criação.

## Regras de segurança

1. Identificar produção por nome, organização e fingerprint parcial aprovado; nunca escolher projeto somente pela posição na lista.
2. Não registrar URLs completas, project refs, tokens, chaves, senhas ou dados pessoais nas evidências.
3. Não usar `service_role` no frontend, no navegador ou em logs.
4. Não executar o baseline em produção existente.
5. Não reaplicar migrations históricas.
6. Não usar `migration repair`, `IF EXISTS` improvisado ou edição manual do histórico para ocultar drift.
7. Não publicar a aplicação React paralela nem expor o servidor Vite.
8. Parar imediatamente diante de ambiente ambíguo, hash divergente, backup não verificável, schema drift não explicado ou teste crítico falhando.

## Fase A — pré-janela e backup obrigatório

### A1. Confirmar artefatos e pessoas

- [ ] Commit funcional é `fdb8582`.
- [ ] Hashes coincidem com o manifesto.
- [ ] Árvore da release está limpa.
- [ ] Projeto de produção foi identificado sem ambiguidade.
- [ ] Staging continua aprovado e sem dados QA.
- [ ] Janela de manutenção e comunicação foram definidas.
- [ ] Responsável pelo rollback está presente.
- [ ] Versão pública atual do frontend foi arquivada de forma imutável.
- [ ] Código e configuração das Edge Functions atuais foram arquivados.

Evidência: `________________`

### A2. Capturar backup e baseline operacional de produção

Capturar com ferramentas aprovadas da plataforma:

- backup lógico do schema;
- backup dos dados;
- snapshot/backup gerenciado da instância;
- `supabase_migrations.schema_migrations`, com versão, nome e checksums disponíveis;
- catálogo de tabelas, colunas, constraints, índices, sequences e views;
- definições de funções, owners, `SECURITY DEFINER` e `search_path`;
- triggers e event triggers;
- RLS habilitada por tabela e texto integral das policies;
- grants de schemas, tabelas, sequences e funções;
- configuração do Storage, lista de buckets, privacidade, limites e MIME types;
- contagem de objetos por bucket, sem nomes pessoais nos relatórios;
- lista e versão atualmente implantada das Edge Functions;
- configuração necessária das funções, registrando somente nomes dos secrets;
- versão pública atual de `index.html` e `404.html`.

Verificar o backup por checksum, tamanho não zero, leitura do catálogo e procedimento de restauração documentado. Para Auth e Storage gerenciados, usar o mecanismo suportado pela plataforma; não presumir que um `pg_dump` parcial restaure toda a camada gerenciada.

- Início do backup: `________________`
- Fim do backup: `________________`
- Identificador interno do backup: `________________`
- Verificação: `________________`
- Aprovador: `________________`

### A3. Preflight de drift

Comparar produção com:

- migration history esperada;
- snapshot de catálogo capturado;
- cinco migrations incrementais do manifesto;
- funções e policies esperadas;
- bucket privado de anexos;
- dependências `auth` e `storage` gerenciadas.

Confirmar especificamente que `gm_consume_public_rate_limit` já existe com assinatura compatível, pois as duas Edge Functions dependem dela. Confirmar que as tabelas e helpers referenciados nas migrations existem. Se qualquer dependência estiver ausente, declarar NO-GO; não aplicar o baseline e não inventar objetos.

Resultado do drift: `________________`

## Fase B — preparação do corte

1. Colocar o onboarding/criação inicial em janela controlada ou comunicar uma indisponibilidade breve.
2. Publicar antecipadamente `bootstrap-company` e `submit-company-request` com os hashes do manifesto, sem alterar o frontend ainda.
3. Confirmar CORS, nomes dos secrets e ausência de segredo no pacote publicado.
4. Executar apenas um preflight não destrutivo das funções. Antes da migration 001, `bootstrap-company` pode ainda não concluir; isso é esperado e não autoriza avançar sem a RPC.
5. Arquivar o identificador da versão implantada de cada função.

Evidências das Edge Functions: `________________`

## Fase C — migrations e corte coordenado

As migrations devem ser aplicadas individualmente, na ordem abaixo, com verificação do histórico após cada uma. O mecanismo escolhido deve preservar o histórico oficial. Se a ferramenta só aplicar todas as pendências de uma vez, preparar artefatos de release progressivos revisados; não editar os SQLs e não usar reparo de histórico para mascarar execução.

### C1. `202607220001_security_legacy_hardening.sql`

Aplicar e validar:

- policies legadas permissivas ausentes;
- grants diretos legados revogados;
- trigger de bloqueio de senha presente, quando a tabela legada existir;
- `gm_bootstrap_company_server` presente e executável somente por `service_role`;
- transação registrada no migration history.

Então testar `bootstrap-company` com conta autorizada de produção e dado descartável, confirmando idempotência e ausência de dados sensíveis na resposta.

Evidência: `________________`

### C2. Publicar o frontend compatível

Publicar `index.html` e `404.html` juntos, usando exatamente os hashes do manifesto. Confirmar:

- cadastro inicial chama `bootstrap-company`;
- onboarding público chama `submit-company-request`;
- resposta 429 é apresentada corretamente;
- console não contém `orderDueState is not defined`;
- remoção de acesso empresarial tem texto distinto de desativação global.

O frontend antigo chama RPCs que a migration 002 revoga. Não aplicar a migration 002 antes deste corte e de um smoke test mínimo.

Evidência: `________________`

### C3. `202607220002_security_bootstrap_and_rpc_grants.sql`

Somente após C1 e C2:

- aplicar a migration;
- confirmar `gm_bootstrap_company` e `gm_bootstrap_company_server` restritas a `service_role`;
- confirmar RPCs internas de onboarding/gestão restritas a `service_role`;
- confirmar RPCs de contexto/estado autorizadas apenas a `authenticated`;
- verificar que o frontend não chama a RPC antiga;
- registrar migration history.

Evidência: `________________`

### C4. `202607220003_security_storage_policies.sql`

Pré-requisitos:

- schemas/tabelas gerenciados de Storage presentes;
- bucket `gestman-attachments` existente e privado;
- helpers de membership e módulo presentes.

Aplicar e confirmar exatamente quatro policies `gm_storage_*`. Esta migration será endurecida pela próxima, mas precisa permanecer no histórico.

Evidência: `________________`

### C5. `202607280001_storage_path_canonicalization.sql`

Aplicar e confirmar:

- três helpers canônicos presentes;
- quatro policies recriadas com validação canônica;
- path válido do próprio tenant funciona;
- traversal, backslash, path absoluto, UUID inválido, módulo inválido e acesso cruzado falham;
- bucket continua privado;
- migration history atualizado.

Evidência: `________________`

### C6. `202607280002_membership_profile_separation.sql`

Aplicar e confirmar:

- remoção/restauração do acesso altera somente `gm_company_members.active`;
- `gm_profiles.active` permanece inalterado no fluxo empresarial;
- memberships de outras empresas permanecem intactos;
- operação global é exclusiva de administrador da plataforma;
- auditorias diferenciam membership e perfil global;
- migration history atualizado.

Evidência: `________________`

## Auditoria por migration

| Migration | Dependências e objetos | Reexecução | Locks/tempo | Dados/indisponibilidade | Verificação/rollback |
|---|---|---|---|---|---|
| `202607220001` | Tabelas legadas opcionais; `auth.users`; tabelas multiempresa; `extensions.digest`. Remove policies/grants, cria trigger e duas funções | Em geral repetível por `DROP ... IF EXISTS` e `CREATE OR REPLACE`, mas recria trigger e não deve ser reaplicada fora do histórico | Locks DDL breves nas tabelas/policies e catálogos; tempo baixo | Não apaga linhas; pode interromper imediatamente consumidores legados inseguros | Consultar policies, grants, trigger e assinatura; rollback por correção revisada, sem reabrir acesso inseguro |
| `202607220002` | RPCs existentes e Edge bootstrap já disponível | Grants/revokes são repetíveis, mas a migration não deve ser reaplicada | Locks de catálogo de funções; tempo baixo | Sem alteração de linhas; pode quebrar frontend antigo | Comparar ACLs e testar contexto/bootstrap; restaurar ACLs somente a partir do snapshot aprovado |
| `202607220003` | `storage.objects`, bucket privado e helpers | Policies são removidas e recriadas; não tratar como no-op | Lock DDL breve em `storage.objects`; tempo baixo | Janela curta de autorização do Storage; sem apagar objetos | Listar policies e testar tenant/anon; restaurar policies capturadas ou manter default deny |
| `202607280001` | Helpers de membership, `storage.objects`, policies anteriores | Substitui funções e policies; não reaplicar rotineiramente | Lock DDL breve em funções e `storage.objects`; tempo baixo | Upload/leitura podem sofrer durante troca; sem alterar arquivos | Testes de path e ACL; restaurar definições anteriores ou aplicar migration corretiva |
| `202607280002` | Tabelas de perfis, memberships, preferências e auditoria | `CREATE OR REPLACE` e grants repetíveis, mas o histórico deve impedir repetição | Locks de catálogo de funções; tempo baixo | Sem transformação de linhas; muda comportamento de futuras operações | Testar membership/perfil em dois tenants; restaurar definições anteriores por migration corretiva |

Estimativas são qualitativas e devem ser revisadas contra tamanho/carga reais. Todas as migrations usam transação explícita, mas integrações externas e publicação de funções/frontend não fazem parte da mesma transação.

## Fase D — smoke tests de produção

Usar conta autorizada e prefixo de teste aprovado. Registrar IDs em uma folha de limpeza, sem dados reais.

1. Abrir aplicação e validar carregamento estático.
2. Login, carregamento de sessão, empresa e estado.
3. Logout e novo login.
4. Criar, ler e remover um registro operacional de teste.
5. Criar, reabrir e remover uma O.S. de teste.
6. Executar onboarding público válido e remover a solicitação de teste.
7. Exercitar rate limit de modo controlado sem atingir usuários reais.
8. Confirmar isolamento entre duas empresas de teste autorizadas.
9. Confirmar que membership inativo perde acesso sem desativar o perfil global.
10. Upload, leitura e exclusão de anexo em path canônico.
11. Confirmar bloqueio de traversal e acesso cruzado.
12. Validar calendário/programação.
13. Confirmar ausência de `orderDueState` e outros `pageerror`.
14. Confirmar ausência de chamada à RPC antiga de bootstrap/onboarding.
15. Confirmar ausência de 5xx inesperados.

### Limpeza

- excluir primeiro anexos;
- excluir O.S. e registros operacionais de teste;
- remover memberships/empresas de teste na ordem suportada;
- remover solicitação pública de teste;
- confirmar por contagem que o prefixo QA autorizado ficou em zero;
- preservar trilhas de auditoria conforme a política de retenção, anonimizando apenas pelo procedimento aprovado.

Resultado dos smoke tests: `________________`

## Fase E — monitoramento inicial

Nas primeiras 2 horas, revisar a cada 15 minutos; nas 22 horas seguintes, revisar a cada hora:

- erros e latência das Edge Functions;
- respostas 401, 403, 409, 429 e 500;
- erros de RPC e violações de RLS;
- falhas de upload, leitura, URL assinada e exclusão;
- volume e origem agregada de onboarding;
- duplicidades de empresa/solicitação;
- erros JavaScript e `pageerror`;
- disponibilidade e latência do login;
- consumo do rate limit;
- filas ou aumento de suporte.

Logs não devem conter CNPJ completo, e-mail completo, telefone, senha, token, conteúdo de anexos ou `service_role`.

Critério de estabilidade: `________________`

## Encerramento

- [ ] Smoke tests aprovados.
- [ ] Dados temporários removidos.
- [ ] Monitoramento ativo.
- [ ] Evidências anexadas.
- [ ] Horário final registrado.
- [ ] Aprovação pós-implantação registrada.

Decisão final: `GO / ROLLBACK / CORREÇÃO AVANÇADA`
