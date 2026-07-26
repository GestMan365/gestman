# GestMan365 — Reconstrução e validação do Supabase Staging

Data: 26/07/2026

Branch: `codex/github-current-20260722`

## Resumo executivo

O projeto **GestMan365 Staging** foi reconstruído a partir do baseline
reproduzível do repositório, sem copiar dados, usuários ou segredos de
produção. As três migrations de segurança foram aplicadas em ordem controlada,
o bootstrap server-side foi implantado e RLS, RPCs, Storage, onboarding e Edge
Functions foram testados com dados QA descartáveis.

Resultado final das três suítes automatizadas:

- precheck do bootstrap: **10 aprovados, 0 reprovados**;
- segurança integrada no staging: **56 aprovados, 0 reprovados**;
- validação estática de onboarding: **91 aprovados, 0 reprovados**;
- total registrado: **157 aprovados, 0 reprovados**.

Há sobreposição intencional entre algumas asserções das suítes. Nenhum teste
final permaneceu reprovado.

## Identificação e isolamento do ambiente

O Supabase CLI autenticado listou dois projetos distintos:

- **GestMan365 CMMS**: produção;
- **GestMan365 Staging**: homologação, criado recentemente.

Foram confirmados project refs e URLs diferentes sem registrá-los neste
relatório. O staging estava saudável, sem migrations, sem tabelas de aplicação,
sem usuários, sem objetos de Storage, sem Edge Functions, sem integração com
GitHub e sem dados reais. O site público continuou referenciando produção.

Esta cópia local foi vinculada somente ao staging. O vínculo foi reconfirmado
antes de qualquer comando de banco.

## Baseline inicial do staging

Antes das alterações:

| Item | Quantidade |
|---|---:|
| Usuários Auth | 0 |
| Tabelas `public` | 0 |
| Policies `public` | 0 |
| Triggers de aplicação | 0 |
| Buckets | 0 |
| Objetos de Storage | 0 |
| Migrations registradas | 0 |
| Edge Functions | 0 |

Existia apenas a função auxiliar automática `rls_auto_enable`, sem esquema
funcional do GestMan365.

## Reconstrução do esquema

O baseline aplicado foi:

`supabase/baseline/20260726_gestman_schema_baseline.sql`

SHA-256:
`AA0EB41C4BDF1BF562570AD8CC91FA14F4FE0248D6A03CD88667F518FDA4A65D`

A primeira tentativa falhou de forma transacional porque o baseline tentava
alterar a tabela gerenciada `storage.objects`, pertencente ao serviço de
Storage. O rollback foi confirmado e o staging permaneceu vazio.

A correção separou responsabilidades:

- baseline: somente objetos de aplicação;
- migration 003: policies de Storage;
- RLS da tabela gerenciada: preservada como configurada pelo Supabase.

O baseline corrigido foi validado novamente em Docker e aplicado com sucesso
ao staging.

## Bootstrap server-side seguro

Foram implementados:

- RPC interna `gm_bootstrap_company_server`;
- Edge Function autenticada `bootstrap-company`;
- chamada do frontend por Edge Function, sem acesso direto à RPC interna.

Controles confirmados:

- identidade obtida por `auth.getUser`, nunca pelo corpo;
- `service_role` somente no servidor;
- campos permitidos estritamente limitados;
- payload limitado a 8 KiB;
- origem CORS restrita;
- JWT e chave de idempotência obrigatórios;
- limite de 10 tentativas por hora por usuário;
- lock transacional por usuário;
- criação atômica de empresa, perfil, membro administrador, estado,
  preferências e auditoria;
- idempotência natural por usuário e slug;
- chave de idempotência armazenada somente como SHA-256;
- resposta sem UUID interno, e-mail, senha, token ou metadados Auth;
- erros genéricos e logs sem dados pessoais ou credenciais;
- execução das RPCs de bootstrap somente por `service_role`.

## Migrations aplicadas

Depois do baseline e do precheck do bootstrap, foram aplicadas em ordem:

1. `202607220001_security_legacy_hardening.sql`;
2. `202607220002_security_bootstrap_and_rpc_grants.sql`;
3. `202607220003_security_storage_policies.sql`.

As sete migrations históricas representadas pelo baseline e as três migrations
de segurança foram registradas de forma coerente no histórico. O CLI passou a
mostrar as dez versões locais e remotas alinhadas.

## Storage

Foi criado no staging o bucket privado `gestman-attachments`:

- público: não;
- limite: 10 MiB;
- MIME types: PDF, JPEG, PNG, WebP e texto.

Foram aplicadas exatamente quatro policies:

- `gm_storage_select`;
- `gm_storage_insert`;
- `gm_storage_update`;
- `gm_storage_delete`.

Testes aprovados:

- upload, leitura e exclusão pelo próprio tenant;
- leitura e exclusão cruzadas bloqueadas;
- acesso anônimo bloqueado;
- usuário inativo bloqueado;
- path traversal bloqueado;
- criação de URL assinada para outro tenant bloqueada.

## Edge Functions implantadas somente no staging

- `bootstrap-company`;
- `submit-company-request`;
- `convert-company-request`;
- `manage-company-access`;
- `manage-company-user`.

Nenhuma função foi implantada em produção.

## Testes integrados

A suíte real usou cinco usuários Auth fictícios e dois tenants
`QA-SECURITY`. A cobertura incluiu:

- bootstrap válido, repetido e concorrente;
- idempotência e ausência de duplicação;
- isolamento entre tenants;
- bloqueio anônimo de tabelas, inserts e RPCs administrativas;
- bloqueio de inserção e transferência cross-tenant;
- bloqueio de autoelevação de papel;
- bloqueio de criação de administrador global;
- usuário inativo sem acesso a dados ou Storage;
- leitura e gravação isoladas de estado;
- persistência de ativo e ordem QA dentro do tenant correto;
- rejeição de tenant arbitrário;
- RPCs de bootstrap indisponíveis ao navegador;
- enforcement de papel administrativo;
- fluxo público de solicitação com e-mail válido, inválido e duplicado;
- ausência de senha no fluxo público;
- aprovação pela plataforma;
- conversão da solicitação em empresa;
- listagem server-side de usuários da empresa;
- bucket permanentemente privado.

Uma primeira execução da suíte integrada apresentou três falhas causadas pela
ordem das próprias fixtures: um usuário recebeu papel de plataforma cedo demais
e a expectativa para usuário inativo não aceitava resposta vazia segura. O
harness foi corrigido sem enfraquecer controles. A execução final terminou em
56/56.

## Catálogo final do staging

| Item | Quantidade |
|---|---:|
| Tabelas `public` | 43 |
| Funções de aplicação | 39 |
| Constraints | 140 |
| Constraints não validadas | 0 |
| Índices fora de constraints | 20 |
| Índices inválidos | 0 |
| Sequences | 3 |
| Views | 1 |
| Triggers | 15 |
| Policies `public` | 19 |
| Policies de Storage | 4 |
| Tabelas com RLS | 43 |
| Migrations registradas | 10 |
| Edge Functions | 5 |

Auditoria final:

- funções retornando `senha`: 0;
- execução de função por `PUBLIC`: 0;
- execução de função por `anon`: 0;
- `SECURITY DEFINER` sem `search_path`: 0;
- policies permissivas com `USING (true)`: 0;
- policies permissivas com `WITH CHECK (true)`: 0;
- bucket público: não.

## Limpeza QA

A limpeza removeu somente slugs, CNPJ, usuários, objetos e hashes de rate
limit criados pela suíte. A consulta final confirmou:

- usuários QA: 0;
- empresas QA: 0;
- perfis QA: 0;
- solicitações QA: 0;
- objetos QA no Storage: 0;
- hashes QA de rate limit: 0.

Nenhum dado real foi usado ou removido.

## Frontend e build

`index.html` e `404.html` passaram a chamar a Edge Function autenticada para
o bootstrap. O formulário e o layout não foram alterados.

- validação de onboarding: 91/91;
- checks estáticos de segurança: aprovados;
- build Vite 5.4.21: aprovado, 3 módulos transformados;
- saída principal: aproximadamente 6,17 MB, gzip 3,25 MB.

`npm audit` reportou 5 vulnerabilidades em dependências, sendo 3 moderadas e 2
altas. Nenhuma correção automática foi aplicada para evitar alteração de
dependências sem escopo e sem revisão.

## Limitações e riscos restantes

- Não houve publicação pública nem teste visual do frontend contra staging.
  A validação do frontend foi estática, de sintaxe, contrato e build.
- O monólito continua com bundle grande, o que afeta desempenho e manutenção.
- As vulnerabilidades apontadas por `npm audit` precisam de triagem separada.
- A definição autoritativa do event trigger ligado a `rls_auto_enable` continua
  ausente e não foi inventada.
- O baseline é um squash estrutural; sua estratégia de promoção futura deve
  preservar o histórico de migrations já alinhado no staging.

## Garantias finais

- Produção alterada: **Não**.
- Staging alterado: **Sim, somente o staging autorizado**.
- Dados de produção copiados: **Não**.
- Usuários reais copiados: **Não**.
- Segredos versionados: **Não**.
- Frontend publicado: **Não**.
- Push realizado: **Não**.
- Deploy público realizado: **Não**.
