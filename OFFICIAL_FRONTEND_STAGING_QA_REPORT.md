# GestMan365 — QA do frontend oficial contra Staging

Data da execução original: 26/07/2026
Revalidação das correções: 28/07/2026
Branch: `codex/github-current-20260722`
Base das correções: `60e3aa2`
Escopo: monólito oficial (`index.html` e fallback `404.html`) conectado somente ao Supabase Staging.

## Resumo executivo

- O Staging é diferente da produção e foi usado por configuração local ignorada pelo Git.
- Nenhuma URL, project ref, senha, chave publishable de Staging ou chave `service_role` foi versionada.
- A produção não recebeu chamadas, dados, migrations ou alterações.
- A suíte oficial contém 22 testes Playwright e terminou com `22 aprovados`, `0 reprovados` e `0 ignorados`.
- As cinco falhas anteriormente esperadas foram removidas após a correção dos quatro defeitos conhecidos.
- Os 66 testes de segurança remota existentes também passaram (`10` de bootstrap e `56` de segurança).
- Os 91 checks de onboarding/JavaScript passaram.
- Todos os dados e anexos `QA-E2E-STAGING-` foram removidos; a conferência final retornou zero.
- As correções foram aplicadas e validadas somente no Staging; não houve promoção para produção.

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

Na revalidação de 28/07/2026 foram acrescentadas duas migrations de hardening, atualizada a Edge Function pública e corrigidos somente os blocos autorizados do frontend. Não houve redesign, refatoração ampla, alteração de produção ou deploy público.

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
| Console e rede | Nenhum erro JavaScript ou de rede inesperado |
| Chamadas à produção | Nenhuma detectada |

Resultado final do Playwright: `22 aprovados`, `0 reprovados`, `0 ignorados`.
As cinco falhas esperadas da execução anterior agora passam como regressões obrigatórias.

## Bugs corrigidos e revalidados

### 1. Rate limit server-side do onboarding público

- A Edge Function consome o helper atômico `gm_consume_public_rate_limit`.
- A origem é derivada no servidor e armazenada somente como hash.
- Rajadas retornam HTTP `429` com código estável, enquanto repetição idempotente de CNPJ continua retornando conflito.
- O frontend apresenta mensagem clara e restaura o botão de envio.

### 2. Canonicalização de caminhos do Storage

- A migration de hardening exige caminho canônico antes de resolver empresa e módulo.
- Foram bloqueadas variantes com traversal codificado, duplamente codificado, barra invertida, barra absoluta, controles, separadores Unicode, segmento longo e nome vazio.
- Upload, leitura e exclusão autorizados continuam funcionando no caminho canônico.

### 3. Separação entre membership e perfil global

- Remover acesso de uma empresa altera apenas `gm_company_members.active`.
- O perfil global e memberships de outras empresas permanecem ativos.
- A desativação global foi separada em RPC restrita ao administrador da plataforma.
- A interface diferencia “Remover acesso desta empresa” de “Desativar usuário globalmente”.

### 4. `orderDueState`

- A função foi implementada com estados determinísticos para concluída, sem data, inválida, atrasada, vence hoje, próxima e no prazo.
- Calendário, programação e módulos principais abriram sem `pageerror` ou erro de console.

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
- Nenhum erro inesperado de JavaScript foi reproduzido após a correção de `orderDueState`.
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

O diagnóstico original encontrou 5 vulnerabilidades: 3 moderadas e 2 altas. A auditoria específica de 28/07/2026 atualizou somente o PostCSS transitivo para uma versão corrigida; o resultado atual é 4 vulnerabilidades: 3 moderadas e 1 alta.

| Pacote | Severidade | Alcance | Versão corrigida/candidata | Breaking change | Testes necessários |
|---|---|---|---|---|---|
| `esbuild` | moderada | servidor de desenvolvimento via Vite; não é runtime do monólito publicado | `0.25.0+`; o audit propõe Vite `8.1.5` | sim, via major do Vite | build, preview, E2E completo |
| `postcss` | corrigida | cadeia de build; não integra o runtime publicado | atualizado para `8.5.24` | não | `npm ci`, TypeScript, build e checks locais aprovados |
| `react-router` | moderada | aplicação React paralela; não participa do runtime do HTML monolítico | `7.18.0+` | sim, major 6 → 7 | rotas, autenticação e E2E React |
| `react-router-dom` | moderada | dependência direta da aplicação React paralela | `7.18.0+`; não existe correção `6.30.5` publicada | sim, major 6 → 7 | rotas, links, redirects e E2E React |
| `vite` | alta | servidor/build local; não é biblioteca runtime do GitHub Pages | `6.4.3+` cobre os advisories listados; `npm audit` propõe `8.1.5` | possível/alto | TypeScript, build, preview e E2E completo |

Nenhuma atualização ampla ou forçada foi executada. Vite e React Router permanecem pendentes por exigirem mudança de versão principal.

## Limpeza

- Empresas, usuários Auth, profiles, memberships, solicitações, Ativos, O.S. e anexos com prefixo `QA-E2E-STAGING-` foram removidos.
- A validação final retornou zero registros QA remanescentes.
- Schema, migrations, Edge Functions, bucket, policies e dados não QA foram preservados.

## Recomendação

As quatro correções estão aptas para revisão local do commit. Antes de qualquer promoção futura, revisar separadamente:

1. as quatro vulnerabilidades npm pendentes, todas fora do bundle do monólito publicado;
2. o tamanho elevado do bundle;
3. funções/listeners duplicados do monólito em tarefa isolada.

Produção alterada: **Não**
Staging alterado: **somente as duas migrations e a Edge Function autorizadas; dados QA posteriormente removidos**
Frontend público implantado: **Não**
Push realizado: **Não**
