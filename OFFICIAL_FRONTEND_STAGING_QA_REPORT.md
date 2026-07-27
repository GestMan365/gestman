# GestMan365 — QA do frontend oficial contra Staging

Data da execução: 26/07/2026
Branch: `codex/github-current-20260722`
Base validada: `13225af`
Escopo: monólito oficial (`index.html` e fallback `404.html`) conectado somente ao Supabase Staging.

## Resumo executivo

- O Staging é diferente da produção e foi usado por configuração local ignorada pelo Git.
- Nenhuma URL, project ref, senha, chave publishable de Staging ou chave `service_role` foi versionada.
- A produção não recebeu chamadas, dados, migrations ou alterações.
- A suíte oficial contém 22 testes Playwright e terminou sem falhas inesperadas.
- Dos 22 testes, 17 passaram integralmente e 5 foram falhas esperadas que reproduzem quatro defeitos conhecidos.
- Os 66 testes de segurança remota existentes também passaram (`10` de bootstrap e `56` de segurança).
- Os 91 checks de onboarding/JavaScript passaram.
- Todos os dados e anexos `QA-E2E-STAGING-` foram removidos; a conferência final retornou zero.
- A publicação em produção não é recomendada antes do tratamento dos quatro bugs confirmados.

## Ambiente e execução

- Servidor local: Node HTTP em `127.0.0.1:4173`.
- Navegador: Chromium controlado pelo Playwright `1.62.0`.
- Comando principal: `npm run test:e2e:official`.
- Resoluções: `360 × 800`, `390 × 844`, `768 × 1024`, `1366 × 768` e `1920 × 1080`.
- O servidor cria artefatos temporários ignorados pelo Git, injetando apenas a URL e a chave publishable de Staging.
- A chave `service_role` é usada somente pelos helpers Node de preparação/limpeza e nunca é entregue ao navegador.

## Alterações realizadas durante o QA

1. Configuração mínima do Playwright para o monólito oficial.
2. Preparação e servidor local isolados para Staging.
3. Helpers de criação, autenticação e limpeza de dados QA.
4. Suíte E2E cobrindo segurança estática, autenticação, onboarding, RLS, Storage, Ativos, O.S., usuários, administração da plataforma e responsividade.
5. Correção cirúrgica no `404.html`: o fallback ainda chamava diretamente `gm_submit_company_request`; agora usa a mesma Edge Function `submit-company-request` do `index.html`.
6. Inclusão dos diretórios de saída do Playwright no `.gitignore`.

Não houve redesign, refatoração ampla, alteração de schema, migration, Edge Function, produção ou deploy.

## Resultados dos testes

| Área | Resultado |
|---|---|
| Contrato `index.html` × `404.html` | Aprovado após correção do fallback |
| Segredos versionados | Nenhum encontrado |
| IDs duplicados no DOM inicial | Nenhum |
| Labels `for` órfãos no DOM inicial | Nenhum |
| Login inválido | Rejeitado com mensagem controlada |
| Login válido e sessão após recarga | Aprovado |
| Logout | Aprovado |
| Usuário inativo e login cruzado | Bloqueados |
| Falha de rede no login | Mensagem controlada, sem token exposto |
| Onboarding público | Envio, validação, duplicidade, duplo clique e fallback aprovados |
| Conversão administrativa | Empresa, acesso e auditoria criados uma única vez |
| Estado empresarial | Load/save, versionamento, conflito e isolamento aprovados |
| Ativos | Criação, edição, recarga e não duplicação aprovadas |
| Ordens de Serviço | Criação, vínculo com ativo, recarga e não duplicação aprovadas |
| Usuários da empresa | Listagem isolada e desativação do membership aprovadas |
| Storage | Upload, leitura, isolamento, anon/inativo, exclusão e limpeza aprovados |
| Responsividade | Cinco resoluções sem overflow horizontal global |
| Console e rede | Nenhum erro inesperado além do bug `orderDueState` |
| Chamadas à produção | Nenhuma detectada |

Resultado final do Playwright: `22 concluídos`, `0 falhas inesperadas`, `0 ignorados`.
Composição: `17 aprovados integrais` e `5 falhas esperadas`, usadas para registrar quatro bugs confirmados.

## Bugs confirmados

### 1. Onboarding público sem rate limit server-side

- Severidade recomendada: alta.
- Evidência estática: a Edge Function não consome helper de rate limit.
- Evidência dinâmica: oito solicitações consecutivas válidas foram aceitas sem resposta HTTP `429`.
- Impacto: spam, abuso do endpoint, consumo de banco e eventual consumo do provedor de e-mail.
- Recomendação: aplicar rate limit por IP/identificador derivado no servidor, com chave hash, janela curta e resposta `429`.

### 2. Storage aceita traversal com barra codificada

- Severidade recomendada: alta.
- Evidência: upload com segmento `..%2F` retornou HTTP `200`.
- O teste de segurança anterior bloqueia outra forma de traversal, mas não cobre esta variante codificada.
- Isolamento entre empresas permaneceu ativo no cenário testado.
- Recomendação: normalizar e rejeitar segmentos codificados antes da autorização; adicionar o caso à regressão de Storage.

### 3. Desativação da empresa altera perfil global

- Severidade recomendada: média/alta em ambiente multiempresa.
- O membership da empresa foi desativado corretamente.
- A mesma operação também definiu `gm_profiles.active = false`.
- Impacto: um usuário que participe de mais de uma empresa pode ser bloqueado globalmente ao ser desativado em apenas uma.
- Recomendação: manter o estado de acesso por membership e alterar o perfil global somente em operação administrativa global explícita.

### 4. `orderDueState is not defined`

- Severidade recomendada: média.
- Reproduzido ao navegar pelos módulos de calendário/programação.
- Existem chamadas a `orderDueState`, mas não existe declaração correspondente; o código possui `orderIsLate`.
- Impacto: `pageerror` e risco de renderização incompleta de calendário/planos.
- Recomendação: corrigir cirurgicamente as duas chamadas e executar novamente a suíte completa.

## Dívida técnica observada

A análise textual do monólito encontrou:

- 53 nomes de funções declarados mais de uma vez;
- 3 assinaturas de listeners registradas mais de uma vez;
- 37 nomes de IDs repetidos no arquivo-fonte, principalmente em templates dinâmicos.

O DOM inicial real não apresentou IDs duplicados, mas as redefinições de funções e listeners aumentam o risco de comportamento dependente da ordem do script. Não foram refatoradas nesta tarefa.

## Console, rede e segurança

- Nenhuma chamada a outro projeto Supabase foi detectada durante a regressão autenticada.
- Nenhum token, senha ou chave privada apareceu na interface ou nos logs de teste.
- Respostas negativas previstas: login inválido, CNPJ duplicado, conflito de versão, acesso anônimo/inativo/cross-tenant e arquivo inexistente.
- Erro inesperado reproduzido: `orderDueState is not defined`.
- O bootstrap do navegador usa somente a Edge Function autenticada.
- O onboarding corrigido usa somente a Edge Function pública.
- O `gm_bootstrap_company` não é chamado diretamente pelo navegador.

## Responsividade e acessibilidade básica

- `scrollWidth <= innerWidth` nas cinco resoluções.
- Formulário de Ativos permaneceu dentro da viewport.
- Tabelas conservaram rolagem interna e os principais botões permaneceram acessíveis.
- Campos de login/onboarding possuem labels.
- Nenhum label `for` órfão foi encontrado no DOM inicial.
- A desativação de usuário exige confirmação.
- Não foi executada auditoria WCAG completa com leitor de tela; contraste foi avaliado apenas de forma visual durante a automação.

## Validações adicionais

- TypeScript: aprovado.
- Build Vite: aprovado; 3 módulos transformados.
- Artefato: aproximadamente `6,17 MB` (`3,26 MB` gzip).
- Onboarding e JavaScript inline: 91 checks aprovados.
- Segurança estática: aprovada.
- Bootstrap em Staging: 10 aprovados, 0 falhas.
- Segurança/RLS/RPC/Storage em Staging: 56 aprovados, 0 falhas.
- `git diff --check`: aprovado.
- Auditoria de segredos exatos: aprovada.

## Vulnerabilidades npm

`npm audit` encontrou 5 vulnerabilidades: 3 moderadas e 2 altas.

| Pacote | Severidade | Alcance | Versão corrigida/candidata | Breaking change | Testes necessários |
|---|---|---|---|---|---|
| `esbuild` | moderada | servidor de desenvolvimento via Vite; não é runtime do monólito publicado | `0.25.0+`; o audit propõe Vite `8.1.5` | sim, via major do Vite | build, preview, E2E completo |
| `postcss` | alta | cadeia de build; risco ao processar source maps não confiáveis | `8.5.18+` | baixo se atualização transitiva compatível | build e inspeção de CSS |
| `react-router` | moderada | aplicação React paralela; não participa do runtime do HTML monolítico | `7.18.0+` | sim, major 6 → 7 | rotas, autenticação e E2E React |
| `react-router-dom` | moderada | dependência direta da aplicação React paralela | `7.18.0+`; não existe correção `6.30.5` publicada | sim, major 6 → 7 | rotas, links, redirects e E2E React |
| `vite` | alta | servidor/build local; não é biblioteca runtime do GitHub Pages | `6.4.3+` cobre os advisories listados; `npm audit` propõe `8.1.5` | possível/alto | TypeScript, build, preview e E2E completo |

Nenhuma dependência foi atualizada automaticamente nesta tarefa.

## Limpeza

- Empresas, usuários Auth, profiles, memberships, solicitações, Ativos, O.S. e anexos com prefixo `QA-E2E-STAGING-` foram removidos.
- A validação final retornou zero registros QA remanescentes.
- Schema, migrations, Edge Functions, bucket, policies e dados não QA foram preservados.

## Recomendação

Não promover esta revisão para produção ainda. Prioridade sugerida:

1. rate limit do onboarding;
2. normalização de path no Storage;
3. separar ativação global de perfil da ativação por membership;
4. corrigir `orderDueState`;
5. reduzir funções/listeners duplicados em tarefa isolada;
6. atualizar Vite/PostCSS e planejar a migração do React Router separadamente.

Produção alterada: **Não**
Staging alterado: **somente dados QA temporários, posteriormente removidos**
Frontend público implantado: **Não**
Push realizado: **Não**
