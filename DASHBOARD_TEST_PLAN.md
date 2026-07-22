# GestMan365 — Plano de Testes do Dashboard

## Escopo auditado

- Pagina: `src/pages/DashboardPage.tsx`.
- Estrutura compartilhada: `AppShell`, `Sidebar`, `Topbar`, `PageHeader` e `ModuleCard`.
- Autenticacao, sessao, empresa ativa e permissoes: `AuthContext`, `TenantContext`, `authService`, `tenantService` e utilitarios de permissoes.
- Rotas relacionadas: Dashboard, Ativos, Solicitacoes, Ordens de Servico, PCM, Relatorios e Administracao.
- Estilos e responsividade: `src/styles/global.css`.

## Estado funcional confirmado

O Dashboard React atual e uma fundacao funcional, nao o painel operacional completo. Ele apresenta cabecalho, menu protegido, seletor da empresa ativa e tres cards com estado `Estrutura base`: Indicadores CMMS, Backlog e Confiabilidade. Nao existem ainda consultas de indicadores, formulas, graficos, tabelas, atalhos internos, filtro de periodo, loading de dados, mensagem de falha de dados ou atualizacao automatica. Esses itens nao devem ser simulados com valores fixos.

## Matriz de testes

| ID | Fluxo | Pre-condicao | Acao | Resultado esperado | Prioridade | Tipo | Risco coberto |
|---|---|---|---|---|---|---|---|
| DB-001 | Acesso autenticado | Usuario demo valido | Entrar e abrir `/dashboard` | Dashboard e estrutura principal visiveis | P0 | E2E/Funcional | Dashboard indisponivel apos login |
| DB-002 | Protecao sem sessao | Sem sessao local | Abrir `/dashboard` | Redirecionar para `/login` | P0 | E2E/Seguranca | Exposicao de area autenticada |
| DB-003 | Titulo e descricao | Usuario autenticado | Ler cabecalho da pagina | Titulo unico e descricao operacional visiveis | P1 | E2E/UI | Hierarquia ou contexto ausente |
| DB-004 | Cards estruturais | Usuario autenticado | Inspecionar resumo | Tres regioes nomeadas e em estado `Estrutura base` | P0 | E2E/Estado vazio | Placeholder enganoso ou ausente |
| DB-005 | Valores invalidos | Usuario autenticado | Inspecionar texto renderizado | Nao apresentar `NaN`, `undefined`, `null` ou `Infinity` | P0 | E2E/Integridade | Falha de calculo ou serializacao |
| DB-006 | Empresa ativa | Usuario autenticado | Inspecionar seletor da Topbar | Empresa vinculada ao contexto selecionada | P0 | E2E/Multiempresa | Dados no tenant incorreto |
| DB-007 | Navegacao lateral | Administrador autenticado | Abrir cada modulo pelo menu | Rota e titulo correspondentes | P0 | E2E/Integracao | Link quebrado ou rota divergente |
| DB-008 | Persistencia | Usuario autenticado no Dashboard | Atualizar a pagina | Permanecer autenticado no Dashboard | P0 | E2E/Sessao | Flash de login ou perda de sessao |
| DB-009 | Sessao corrompida | LocalStorage com JSON invalido | Abrir Dashboard | Limpar sessao e voltar ao login sem travar | P0 | E2E/Resiliencia | Tela branca ou loop de rota |
| DB-010 | Console | Fluxo principal | Entrar e aguardar Dashboard | Nenhum erro de console ou excecao da pagina | P0 | E2E/Tecnico | Regressao silenciosa |
| DB-011 | Rede | Modo demo | Entrar e abrir Dashboard | Nenhuma requisicao local falha | P1 | E2E/Tecnico | Recurso ausente ou bundle quebrado |
| DB-012 | Desktop | Viewport 1920x1080 | Abrir Dashboard | Conteudo essencial visivel e navegavel | P1 | E2E/Responsivo | Layout desktop quebrado |
| DB-013 | Tablet | Viewport 768x1024 | Abrir Dashboard | Menu, resumo e logout acessiveis | P1 | E2E/Responsivo | Quebra no ponto de corte |
| DB-014 | Celular | Viewport 390x844 | Abrir Dashboard | Conteudo essencial visivel e sem valores invalidos | P1 | E2E/Responsivo | Conteudo inacessivel no mobile |
| DB-015 | Teclado | Usuario autenticado | Focar link e pressionar Enter | Navegar ao modulo escolhido | P1 | E2E/Acessibilidade | Operacao dependente de mouse |
| DB-016 | Perfil tecnico | Sessao demo valida com perfil Tecnico | Abrir Dashboard e menu | Dashboard permitido; Administracao oculta | P0 | E2E/Permissao | Escalada de privilegio visual |
| DB-017 | Loading da rota | Sessao valida | Atualizar Dashboard | Loading transitorio e removido ao concluir | P1 | E2E/Estado | Travamento permanente |
| DB-018 | Falha do Supabase | `VITE_AUTH_MODE=supabase` sem configuracao | Tentar autenticar | Mensagem clara, sem chamar dados do Dashboard | P0 | Integracao | Falha insegura de configuracao |
| DB-019 | Formula MTTR | Historico real disponivel | Calcular media de reparo | Somatorio do tempo de reparo / falhas concluidas, com unidade e arredondamento definidos | P0 | Futuro/Regra | Indicador incorreto |
| DB-020 | Formula MTBF | Historico real disponivel | Calcular intervalo medio | Tempo operacional / quantidade de falhas, sem divisao por zero | P0 | Futuro/Regra | Indicador incorreto |
| DB-021 | Disponibilidade | MTTR e MTBF validos | Calcular disponibilidade | `MTBF / (MTBF + MTTR) * 100`, limitada e formatada | P0 | Futuro/Regra | Percentual impossivel |
| DB-022 | Backlog | O.S. reais do tenant | Consolidar carteira | Considerar somente registros do tenant e status definidos, sem duplicidade | P0 | Futuro/Integracao | Vazamento multiempresa ou contagem dupla |
| DB-023 | Datas e periodo | Dados em limites de periodo | Aplicar filtro | Datas com timezone consistente e fronteiras documentadas | P0 | Futuro/Regra | Registros omitidos/duplicados |
| DB-024 | Estado sem dados | Tenant sem registros | Abrir Dashboard | Exibir `Sem dados`, nunca zero fabricado | P0 | Futuro/UX | Decisao operacional enganosa |

## Origem e validacao dos indicadores

No codigo atual nao ha servico, hook, consulta Supabase ou funcao de calculo do Dashboard. Por isso, MTTR, MTBF, disponibilidade e backlog ainda nao podem ser tecnicamente homologados. Antes de liberar valores reais, cada indicador deve declarar:

1. tabelas e campos de origem;
2. filtro obrigatorio por `empresaId` e, quando aplicavel, unidade;
3. status e tipos incluidos/excluidos;
4. timezone e limites do periodo;
5. regra para registros incompletos, cancelados e duplicados;
6. unidade, precisao e arredondamento;
7. tratamento de denominador zero, datas invalidas e duracoes negativas;
8. estado explicito `Sem dados`.

## Criterios de automacao

- Seletores priorizam `getByRole` e `getByLabel`.
- Nao ha seletor baseado em posicao, classe visual ou `div` generica para interacao.
- Nenhum `data-testid` foi necessario.
- Testes que alteram sessao usam contexto isolado do Playwright.
- A execucao permanece no Chromium e com um worker.
- O teste nao cria registros, nao chama Supabase remoto e nao realiza deploy.

## Lacunas fora do escopo desta fundacao

- Graficos e tabelas operacionais.
- Filtro de periodo/unidade no Dashboard.
- Atalhos rapidos dentro do Dashboard.
- Atualizacao automatica ou manual de indicadores.
- Loading, erro e retry de consultas do Dashboard.
- Formulas e agregacoes com dados reais.
- Cobertura visual por screenshot de referencia.

Essas lacunas devem ser implementadas somente junto das regras de negocio, do modelo Supabase e da garantia multiempresa correspondentes.
