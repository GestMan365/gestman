# GestMan365 — Relatório da Correção Visual Fase 2.1

## Escopo

- Branch: `design/ui-ux-v1`
- Base da fase: `6281e2e`
- Aplicação oficial validada: monólito `index.html` / `404.html`
- Backend, Supabase, RLS, RPCs, Storage e Edge Functions: não alterados
- Produção: não alterada

## Diagnóstico e correções

### Temas

- O tema claro recebeu contraste mais consistente no menu, títulos de grupos, alertas, filtros do cabeçalho, banner, badges, cards e formulários.
- O tema escuro passou a usar quatro níveis visuais coerentes: canvas, superfície, superfície elevada e campos.
- O controle de tema atualiza texto, ícone, `aria-label`, `aria-pressed`, `color-scheme` e persistência local.
- Um bootstrap executado imediatamente após a abertura do `body` aplica o tema salvo antes da restauração da aplicação, reduzindo a exibição momentânea do tema incorreto.

### Navegação lateral

- A largura foi centralizada em `--sidebar-width`.
- Sidebar aberta: `256px`.
- Sidebar recolhida: `72px`.
- Cabeçalho e conteúdo acompanham a largura real da sidebar; não sobra faixa vazia.
- No estado recolhido permanecem logo compacto, ícones, estado ativo, indicador crítico e botão de reabertura.
- Textos, nomes de módulos, títulos de grupos, chevrons, favoritos, detalhes de alertas e texto do rodapé são ocultados no modo compacto.
- Os atalhos compactos recebem tooltip acessível por mouse e foco de teclado.
- O estado aberto/recolhido é persistido por usuário, com fallback local seguro.
- Em mobile a sidebar continua sendo um drawer sobreposto, sem virar trilho compacto.
- Foi corrigido um conflito em que o estado recolhido do desktop mantinha o drawer mobile em `display:none`.

### Dashboard e notificações

- Os cards principais mantêm separação visual nos dois temas.
- Entre `901px` e `1599px`, os minigráficos decorativos deixam de comprimir os textos dos indicadores.
- Toasts receberam margens seguras, limite de altura/largura, rolagem interna e duração reduzida de `4200ms` para `3400ms`.

## Arquivos alterados

- `index.html`
- `404.html`
- `DESIGN_PHASE_02_1_REPORT.md`

Os blocos da Fase 2.1, bootstrap de tema e funções diretamente ajustadas foram comparados entre `index.html` e `404.html` e permanecem funcionalmente equivalentes.

## Validação visual

| Cenário | Resultado |
|---|---|
| Claro, sidebar aberta, 1366×768 | Aprovado; sidebar 256px e conteúdo inicia em 256px |
| Claro, sidebar recolhida, 1366×768 | Aprovado; sidebar 72px e conteúdo inicia em 72px |
| Escuro, sidebar aberta, 1366×768 | Aprovado |
| Escuro, sidebar recolhida, 1366×768 | Aprovado |
| Mobile claro, drawer aberto, 390×844 | Aprovado; drawer 310px |
| Mobile escuro, drawer aberto, 390×844 | Aprovado; drawer 310px |

Não houve overflow horizontal global nas resoluções verificadas:

| Resolução | `innerWidth` | `scrollWidth` | Resultado |
|---|---:|---:|---|
| 360×800 | 360 | 349 | Aprovado |
| 390×844 | 390 | 379 | Aprovado |
| 768×1024 | 768 | 757 | Aprovado |
| 1366×768 | 1366 | 1355 | Aprovado |
| 1920×1080 | 1920 | 1909 | Aprovado |

## Capturas

- `gestman-02-1-claro-aberto.png`
- `gestman-02-1-claro-recolhido.png`
- `gestman-02-1-escuro-aberto.png`
- `gestman-02-1-escuro-recolhido.png`
- `gestman-02-1-mobile-claro.png`
- `gestman-02-1-mobile-escuro.png`

As capturas foram salvas na pasta de visualizações da tarefa.

## Testes executados

- Sintaxe dos 7 scripts JavaScript inline de cada HTML: aprovada.
- TypeScript (`tsc --noEmit` por meio de `npm run build`): aprovado.
- Build Vite: aprovado; 6 módulos transformados.
- Auditoria de IDs no DOM: 656 IDs, nenhuma duplicação.
- Blocos visuais e funcionais alterados em `index.html` e `404.html`: hashes equivalentes após normalização de fim de linha.
- Tooltips: 40 alvos com `aria-describedby`; foco por teclado exibiu o tooltip do controle compacto.
- Persistência do tema claro/escuro: aprovada após recarregar.
- Persistência da sidebar aberta/recolhida: aprovada após recarregar.
- Console da prévia: 0 erros e 0 warnings.
- Auditoria estática de segurança: aprovada.
- Auditoria de segredos no diff: 0 ocorrências dos padrões verificados.
- `git diff --check`: aprovado.

A suíte Playwright oficial não foi executada nesta fase visual porque o `global-setup` existente prepara dados e integrações no Staging. A validação visual foi realizada na prévia local sanitizada, sem acesso ao Supabase remoto.

## Auditoria de duplicações

- Nenhum ID HTML duplicado foi encontrado em runtime.
- As funções alteradas nesta fase (`applyTheme`, `setNavCollapsed`, `initNavCollapse` e tooltips) aparecem uma única vez.
- Nenhum novo `addEventListener` foi introduzido pela correção.
- A análise textual do monólito ainda encontra declarações de funções repetidas preexistentes em blocos antigos. Elas não foram criadas nem modificadas nesta fase e permanecem como dívida técnica fora do escopo visual.

## Prévia local

`http://127.0.0.1:5189/?phase=02-1-final`

A prévia usa uma cópia sanitizada e dados locais fictícios. Não aponta para produção.

## Riscos residuais e próxima etapa

- O monólito concentra grande volume de CSS e JavaScript, elevando o risco de conflito de especificidade em futuras fases.
- As declarações funcionais duplicadas preexistentes devem ser auditadas em uma tarefa técnica separada, sem misturar com redesign.
- A próxima etapa recomendada é padronizar tabelas, filtros, formulários e modais módulo a módulo, preservando IDs e contratos funcionais.
