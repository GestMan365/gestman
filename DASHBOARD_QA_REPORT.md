# GestMan365 — Relatorio de QA do Dashboard

**Data:** 21/07/2026  
**Projeto validado:** `C:\Users\andsa\Desktop\GestMan365-Claude`  
**Ambiente:** local, `VITE_AUTH_MODE=demo`, Chromium, um worker  
**Deploy/publicacao:** Nao realizado  
**Supabase remoto:** Nao alterado e nao acessado pelos testes

## Resumo executivo

A fundacao React do Dashboard foi auditada, recebeu pequenas correcoes semanticas e ganhou uma suite E2E propria. A build passou e os 18 testes da aplicacao foram aprovados. Nao houve falha, teste ignorado, erro de console ou falha de rede no fluxo principal em modo demo.

O Dashboard atual ainda nao e um painel operacional completo. Ele exibe tres cards de preparacao, mas nao consulta nem calcula MTTR, MTBF, disponibilidade ou backlog. Portanto, esses indicadores nao estao homologados. A ausencia foi mantida explicita como `Estrutura base`, sem inventar valores.

## Resultado rastreavel

| Verificacao | Total | Aprovados | Reprovados | Ignorados | Resultado |
|---|---:|---:|---:|---:|---|
| Build TypeScript + Vite | 1 | 1 | 0 | 0 | Aprovada |
| Listagem Playwright | 18 | 18 listados | 0 | 0 | Aprovada |
| Autenticacao E2E | 6 | 6 | 0 | 0 | Aprovada |
| Dashboard E2E isolado | 12 | 12 | 0 | 0 | Aprovada |
| Suite E2E completa | 18 | 18 | 0 | 0 | Aprovada |
| `npm run qa` | 18 | 18 | 0 | 0 | Aprovada |

## Baseline Git

- Repositorio local confirmado no projeto oficial.
- Commit baseline: `48ef4815aefdf2a860c25b99a18ea27df84b88c1`.
- Mensagem: `chore: establish React authentication and Playwright QA baseline`.
- Tag local: `gestman365-react-qa-baseline-v0.1.0`.
- A tag aponta para o mesmo commit baseline.
- Nenhum `push`, deploy ou publicacao foi executado.
- `.env`, dependencias, build, relatorios, traces, videos, screenshots, caches, backup legado e ZIPs estao ignorados.

## Mapa funcional auditado

### Estrutura visivel

- Cabecalho de pagina com titulo `Dashboard` e descricao.
- Menu lateral protegido por permissao.
- Topbar com empresa ativa, usuario, perfil e logout.
- Resumo com tres areas: Indicadores CMMS, Backlog e Confiabilidade.
- Cada area informa corretamente o estado `Estrutura base`.

### Rotas e atalhos disponiveis

O Dashboard nao possui botoes de acao rapida internos. A navegacao disponivel e o menu lateral para:

- Dashboard;
- Ativos;
- Solicitacoes;
- Ordens de Servico;
- PCM;
- Relatorios;
- Administracao, conforme permissao.

Todos esses links foram testados com um administrador. Tambem foi validado que o perfil Tecnico acessa Dashboard, Ativos e Ordens de Servico, mas nao recebe o link de Administracao.

### Filtros

O unico filtro compartilhado atual e `Empresa ativa`, alimentado pelo `TenantContext`. Em modo demo, ele seleciona `GestMan365 Demo`. Nao ha ainda filtro de periodo, unidade, ativo ou status no Dashboard.

### Dados e servicos

- Autenticacao: `authService` em modo demo ou Supabase conforme ambiente.
- Empresa ativa: `tenantService`; retorno local controlado no modo demo.
- Dashboard: sem hook, servico, query Supabase, agregador ou cache proprio.
- Dados operacionais: nenhum registro criado ou alterado durante os testes.

## Validacao dos indicadores

### Situacao encontrada

| Indicador | Origem implementada | Formula implementada | Estado atual | Homologado |
|---|---|---|---|---|
| MTTR | Nao | Nao | Texto de preparacao | Nao |
| MTBF | Nao | Nao | Texto de preparacao | Nao |
| Disponibilidade | Nao | Nao | Texto de preparacao | Nao |
| Backlog | Nao | Nao | Texto de preparacao | Nao |

### Regras obrigatorias antes da implementacao

- Isolamento por empresa e, quando aplicavel, unidade.
- Definicao dos status e tipos incluidos em cada calculo.
- Datas normalizadas, timezone e fronteiras do periodo documentadas.
- Eliminacao de duplicidades e tratamento de registros cancelados/incompletos.
- Bloqueio de duracoes negativas e datas invalidas.
- Protecao contra divisao por zero.
- Unidade, precisao e arredondamento definidos.
- Estado `Sem dados` distinto do valor numerico zero.
- Testes de integracao com dados conhecidos e reconciliacao com consulta de origem.

## Testes do Dashboard executados

1. Protecao da rota sem autenticacao.
2. Estrutura autenticada, titulo, descricao e cards.
3. Estado vazio explicito dos indicadores.
4. Ausencia de `NaN`, `undefined`, `null` e `Infinity` na interface.
5. Empresa ativa vinculada ao contexto autenticado.
6. Navegacao por todos os modulos permitidos ao administrador.
7. Persistencia de sessao apos recarregar.
8. Recuperacao segura de sessao local corrompida.
9. Ausencia de erros de console, excecoes e falhas de rede.
10. Responsividade em desktop 1920x1080.
11. Responsividade em tablet 768x1024.
12. Responsividade em celular 390x844.
13. Navegacao basica por teclado.
14. Restricao visual de Administracao para perfil Tecnico.

Os itens de estado de carregamento e erro foram avaliados no limite da implementacao atual: o loading de rota termina corretamente e uma sessao corrompida retorna ao login sem travar. Nao existe consulta de Dashboard para testar loading, erro, retry ou timeout de dados.

## Correcoes objetivas aplicadas

- `PageHeader` passou a usar o elemento semantico `header`.
- `ModuleCard` passou a ser uma regiao acessivel nomeada pelo proprio titulo.
- O seletor da empresa ativa recebeu nome acessivel estavel.
- O resumo do Dashboard passou a ser uma secao acessivel nomeada.
- Nenhum `data-testid` foi necessario.
- Nenhuma regra de negocio ou aparencia visual foi alterada.

## Auditoria de UX

### Critico

Nenhum defeito critico reproduzido na fundacao atual.

### Alto

1. **Indicadores sem implementacao:** MTTR, MTBF, disponibilidade e backlog nao possuem origem ou formula. O Dashboard nao deve ser tratado como operacional ate essa camada existir.
2. **Falha de consulta da empresa sem mensagem:** em modo Supabase, `tenantService` converte erro ou lista vazia em `[]`; a Topbar nao diferencia “sem empresa” de “falha ao carregar”.
3. **Sem garantia de reconciliacao multiempresa no Dashboard:** ainda nao ha consultas operacionais para provar RLS, filtro por tenant e ausencia de vazamento entre empresas.

### Medio

1. Nao ha estado proprio de loading, erro e retry para dados do Dashboard.
2. Nao ha filtro de periodo ou unidade para os futuros indicadores.
3. Nao ha atalhos operacionais internos no Dashboard; o usuario depende do menu lateral.
4. No mobile, a barra lateral fica acima do conteudo e pode aumentar a distancia ate os cards conforme o menu crescer.
5. Nao ha teste com leitor de tela ou auditor automatizado WCAG; somente semantica e teclado basicos foram validados.

### Baixo

1. Icones do menu sao abreviacoes textuais, nao iconografia final.
2. Textos ainda usam portugues sem acentuacao em partes da fundacao.

## Riscos e cobertura pendente

- Dashboard operacional real: pendente de modelo de dados, consultas e regras de calculo.
- Supabase/RLS: nao exercitado nesta rodada para respeitar a proibicao de alterar ou acessar o ambiente remoto.
- Perfis Supervisor, Planejador e Solicitante: nao possuem cenarios E2E especificos do Dashboard.
- Cross-browser: somente Chromium, conforme configuracao aprovada.
- Dashboard visual completo: sem comparacao por screenshot porque a pagina atual e apenas a fundacao React.
- Os modulos Ativos, Solicitacoes, Ordens de Servico, PCM, Relatorios e Administracao ainda nao possuem cobertura E2E funcional completa. O teste atual valida apenas a navegacao e a presenca dos respectivos titulos.

## Arquivos alterados nesta rodada

- `src/components/common/ModuleCard.tsx`
- `src/components/common/PageHeader.tsx`
- `src/components/layout/Topbar.tsx`
- `src/pages/DashboardPage.tsx`

## Arquivos criados nesta rodada

- `tests/dashboard/dashboard.spec.ts`
- `DASHBOARD_TEST_PLAN.md`
- `DASHBOARD_QA_REPORT.md`

## Comandos executados

```powershell
npm run build
npx playwright test --list
npx playwright test tests/dashboard/dashboard.spec.ts --project=chromium
npx playwright test --project=chromium
npm run qa
```

## Conclusao

A base tecnica e a navegacao do Dashboard estao estaveis para continuar o desenvolvimento: build aprovada, 18/18 testes aprovados, zero falhas, zero ignorados e nenhuma regressao identificada na autenticacao. A proxima etapa segura e definir as fontes e formulas dos indicadores antes de implementar o painel operacional real.
