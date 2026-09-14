# Fase 05 — Revisão global do sistema visual

## Escopo

A auditoria percorre os 30 módulos disponíveis no menu com dados fictícios e
persistência desativada. O fluxo local não acessa Supabase, não grava dados e não
modifica regras de negócio, autenticação, permissões, RLS, policies ou constraints.

Os padrões globais avaliados incluem dashboard, cabeçalhos, painéis, cards,
toolbars, filtros, buscas, formulários, tabelas, menus de linha, paginação,
estados vazios, alertas, modais, foco por teclado e comportamento responsivo.

## Diagnóstico

O design system já consolidava tipografia Inter, escala de radius, superfícies,
campos, botões, tabelas, modais, estados e navegação. Não foram encontradas
divergências globais de largura, tipografia ou rolagem horizontal. A correção foi
concentrada nos componentes-base que ainda divergiam:

- controles compactos do dashboard com altura entre 28 e 31 px;
- gatilhos de menus de linha com áreas clicáveis inconsistentes;
- summaries de menus contextuais ainda não cobertos pelo decorador de ícones;
- ícones de busca legados ainda não cobertos em todas as toolbars;
- foco por teclado sem um contrato final explícito em todos os controles do conteúdo.

## Implementação

- alvo mínimo compacto de 36 px em desktop e 40 px em mobile;
- camada previsível para menus contextuais e ações internas com 36 px;
- foco visível comum para botões, summaries, campos e elementos focáveis;
- extensão do decorador Flaticon para buscas e menus fora do sidebar;
- preservação explícita dos grupos e ícones do sidebar;
- fixture hermética e helper do navegador integrado para auditoria repetível.

## Matriz visual

As dimensões CSS obrigatórias são `951×535`, `1103×621`, `1366×768` e
`390×844`. A validação mede `window.innerWidth`/`window.innerHeight`, overflow
global, clipping, alvos compactos e símbolos Unicode interativos não decorados.

Resultado final no navegador integrado:

- 30 módulos em `1366×768`: aprovados;
- 30 módulos em `1103×621`: aprovados;
- 30 módulos em `951×535`: aprovados;
- 10 fluxos operacionais móveis disponíveis em `390×844`: aprovados;
- modal de O.S. em `390×844`: contido, com foco interno e sem overflow;
- filtro avançado de Documentos: fechado sem conteúdo residual e aberto dentro
  da viewport em desktop, notebook e mobile;
- menu de linha preventivo: alvo de 36 px, foco e abertura aprovados;
- geração preventiva em `1103×621` e `390×844`: cancelamento, pausa, rollback,
  geração única e duração `1 h` aprovados.

## Validação automatizada

- geração preventiva: 24/24;
- suíte unitária completa: 133/133;
- validadores estáticos locais aplicáveis: 23/23;
- validação específica da Fase 05: 5/5 testes e 17/17 checks estáticos;
- TypeScript e Vite build: aprovados;
- paridade `index.html` / `404.html`: aprovada;
- sintaxe dos scripts e `git diff --check`: aprovados.

O validador tipográfico legado baseado em Chromium externo foi substituído nesta
rodada pela inspeção tipográfica equivalente no navegador integrado. Os dois
validadores de staging não foram executados porque exigem credenciais e operações
remotas fora do escopo visual local.

## Pendência separada da Fase 04

Permanece aberta a identificação catalogal READ ONLY de uma constraint não
validada e três policies potencialmente universais. Esta Fase 05 não altera nem
depende desses objetos.
