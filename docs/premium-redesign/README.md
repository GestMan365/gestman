# GestMan365 — Redesign Precision

## Escopo e origem

Implementação local sobre a aplicação clássica oficial, não sobre o scaffold React da branch `feature/modulo-estoque`.

- Base: `c9f7c255f8d9c7b87cdecb71999ae818005f8f00` (`origin/main` na identificação).
- O HTML publicado e o blob `origin/main:index.html` eram idênticos, com SHA-256 `c70aa08d82ed9bf13584fdbab1c65e813d5008ca32377001ce7cbea31bda7f68`.
- Worktree isolado: `gestman-premium-redesign/GestMan365-Claude`.
- Branch local: `codex/premium-redesign`.
- Nenhum deploy, push, commit ou alteração de banco foi realizado nesta entrega.

## Direção visual

Foram consideradas três direções: minimalismo monocromático, painel industrial escuro e enterprise azul com superfícies neutras. A terceira foi escolhida por combinar legibilidade, identidade industrial e equivalência entre claro e escuro.

Precision usa Inter local, azul de ação, cores semânticas, bordas discretas, raios de 12 px, espaçamento consistente e sombras leves. Os tokens ficam em `assets/premium-ui.css`; a navegação compartilhada em `assets/premium-ui.js`.

## Implementação

- Navegação lateral independente, recolhível no desktop, com busca de módulos e indicador ativo.
- Drawer móvel com backdrop, Escape, contenção de foco e estado acessível do botão.
- Cabeçalho contextual com busca global existente, breadcrumb e ações da conta.
- Link para pular a navegação, foco visível, zoom liberado e movimento reduzido.
- Dashboard com nova hierarquia, cards de indicadores e superfícies de widgets.
- Padrões compartilhados para tabelas, filtros, formulários, botões, abas, chips e modais.
- Layouts estreitos corrigidos nos filtros, cronograma e detalhe do Mapa Industrial.
- Camada de visibilidade separada para não revelar controles ocultos por permissões.
- `index.html` e `404.html` sincronizados.

Não foram alterados cálculos industriais, contratos de dados, Auth, RLS, RPCs, migrations ou integrações. O monólito existente foi preservado; esta entrega não é uma migração para React nem uma reescrita individual dos 32 módulos.

## Cobertura de telas

Os 32 contêineres existentes receberam os componentes compartilhados e passaram pela matriz geométrica: Dashboard, Regiões, Calendários produtivos, Acessos rápidos, Áreas operacionais, Documentos, Medições, Paradas, Diário, Pendências, Ferramentas, Equipes, Indicadores, Mapa, Ativos, Fornecedores, Estoque, Peças, Movimentações, Requisições, Transferências, Locais, Tags, O.S., Agenda, Preventivas, Painel de O.S., Relatórios, Assistente, Checklists, Solicitações de plataforma e Empresas de plataforma.

Dimensões CSS da matriz: 1440×960, 1103×621, 951×535 e 390×844, nos dois temas (256 combinações). A matriz invoca os renderizadores locais para inspecionar superfícies; isso não comprova autorização real de contas de produção. As regras legítimas de módulos móveis foram mantidas.

## Como revisar localmente

```text
node scripts/serve-preventive-local-qa.mjs
http://127.0.0.1:4186/ui-audit
npx playwright test -c playwright.premium.config.ts
npx playwright test -c playwright.premium-regression.config.ts
npm run build
```

O servidor QA usa dados sintéticos e bloqueia conexões externas. O servidor de regressão usa a porta 4190 e respostas locais simuladas; sua adaptação de endpoint ocorre somente no HTML servido para testes, sem alterar a configuração de produção.

## Evidências

- [Antes — dashboard escuro](before-dashboard-dark.png)
- [Depois — dashboard escuro](dashboard-dark-1440.png)
- [Depois — dashboard claro](dashboard-light-1440.png)
- [O.S. — escuro](orders-dark-1440.png)
- [Documentos — móvel claro](documentsCenter-light-390.png)
- [Matriz de dimensões](geometry.json)

Todas as capturas são locais. Os números são de fixtures de QA, não dados empresariais. Na captura do dashboard o serviço de indicadores está indisponível por isolamento de rede: o estado de erro é intencional, sem números inventados. A suíte específica de gráficos usa contrato simulado para testar séries, lacunas, filtros e qualidade dos dados.

## Validação e limitações

Resultados locais em 08/10/2026:

| Verificação | Resultado |
|---|---|
| Unitários (`tests/*.test.mjs`) | 200/200 |
| Playwright de regressão (`tests/local-audit`) | 123/123 |
| Matriz premium | 256/256 combinações geométricas |
| Menu, teclado móvel e visibilidade de controles ocultos | Aprovados |
| Validadores estáticos locais | 25/25 |
| TypeScript + Vite build | Aprovados |
| Paridade index/404 | Aprovada, sem IDs duplicados |
| Sintaxe do novo JS e `git diff --check` | Aprovados |
| Tipografia (1366×768 e 390×844) | Inter carregada; sem texto quebrado ou overflow |
| Revalidação final de temas e Materiais/Estoque | 9/9 |
| Contraste de textos amostrados pela matriz de temas | Nenhum alerta remanescente |

A suíte completa passou antes do ajuste final de herança de cor dos textos de botões primários. A matriz de temas e os oito testes de Materiais/Estoque foram repetidos e aprovados especificamente após esse ajuste. A auditoria de cores aguarda o fim das transições, evitando medir estados intermediários. O relatório de cores está em [theme-summary.json](theme-summary.json).

Problemas encontrados e corrigidos durante QA: regras legadas sobrepondo o novo tema, backdrop móvel visível indevidamente, filtros cortados em largura reduzida, detalhe do mapa sem espaço e texto de ação primária com contraste insuficiente. Asserções exclusivas do antigo menu horizontal foram substituídas por verificações equivalentes da nova navegação lateral. Não foram removidas as verificações de fluxo de negócio.

- A validação é local, não um smoke autenticado pós-publicação.
- Verificações de foco, contraste e teclado não equivalem a certificação integral WCAG 2.2 AA ou ensaio com leitor de tela.
- Validadores dependentes de credenciais de staging não foram executados com acesso remoto.
- O build conserva avisos do Vite sobre scripts clássicos sem `type=module`; o plugin existente copia o runtime. Não foi convertida a arquitetura clássica em módulos.
- A arquitetura legada e as regras de acesso móveis continuam sendo limitações do produto existente.
- Limpeza: a ferramenta bloqueou a remoção de `dist`. Não foi usado mecanismo alternativo. O diretório de build permanece local e ignorado pelo Git; `test-results` mantém as evidências detalhadas de QA.

## Próxima etapa

Revisão visual do operador na prévia local, seguida de autorização explícita para publicação. Antes de publicar, rever o diff final, empacotamento e destino de hospedagem; depois da publicação, executar smoke autenticado somente leitura. Não executar migrations para este redesign.

## Arquivos da entrega

Produto/build: `index.html`, `404.html`, `assets/premium-ui.css`, `assets/premium-ui.js`, `vite.config.ts`.

QA: `scripts/serve-preventive-local-qa.mjs`, `scripts/validate-typography-ui.mjs`, `playwright.premium.config.ts`, `playwright.premium-regression.config.ts`, `tests/premium/visual.spec.ts`, `tests/local-audit/header-button-contrast.spec.ts`, `tests/local-audit/tenant-login-route.spec.ts`, `tests/local-audit/theme-matrix.spec.ts`, `tests/local-audit/ui-regression.spec.ts`.

Documentação/evidências: esta pasta. O worktree contém as alterações locais ainda não commitadas. As modificações preexistentes no checkout original não foram alteradas.
