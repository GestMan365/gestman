# GestMan365 — Plano do sistema visual

## Escopo da fase

Esta primeira fase moderniza somente a identidade visual global, o menu lateral, o cabeçalho e a fundação do Dashboard oficial monolítico. IDs, eventos, regras de negócio, contratos com Supabase e seletores funcionais permanecem inalterados.

## Diagnóstico visual

- A identidade industrial já é reconhecível, mas sucessivas camadas de CSS criaram variações de cor, raio, sombra e densidade.
- O menu lateral é funcional, porém possui hierarquia visual comprimida, tipografia pequena e pouco contraste entre grupo, item e estado ativo.
- O cabeçalho concentra muitos controles na mesma faixa e perde prioridade visual em larguras intermediárias.
- Os seis indicadores do Dashboard ficam estreitos em 1366 px, truncando textos e reduzindo a leitura rápida.
- Cards, gráficos e listas usam densidade e peso visual muito semelhantes, dificultando reconhecer prioridades operacionais.
- No celular, a navegação precisa funcionar como drawer e o cabeçalho deve expor somente ações essenciais.
- O login já possui identidade própria consistente e não precisa ser redesenhado nesta etapa.
- Formulários, tabelas, modais, alertas, estados vazios e loading serão padronizados em incrementos posteriores.

## Identidade proposta

Direção visual: software industrial contemporâneo, sóbrio e legível, com superfícies azul-marinho, dados em alto contraste e cores semânticas usadas com moderação.

### Paleta

| Papel | Escuro | Claro |
| --- | --- | --- |
| Fundo principal | `#06101d` | `#eef3f8` |
| Menu/cabeçalho | `#081625` | `#ffffff` |
| Superfície | `#0d1b2c` | `#ffffff` |
| Superfície elevada | `#13263b` | `#f7fafc` |
| Borda | `rgba(140, 171, 205, .18)` | `#d4e0eb` |
| Texto principal | `#f4f8ff` | `#172b40` |
| Texto secundário | `#9cafc6` | `#526a82` |
| Ação primária | `#2f8fff` | `#1677d2` |
| Operação saudável | `#27d8bd` | `#0f967f` |
| Atenção | `#f7b84b` | `#a86409` |
| Crítico | `#f35b6a` | `#c73443` |

### Tipografia

- Manter a família já carregada pelo produto para evitar dependência nova.
- Títulos com peso 650–750 e espaçamento negativo discreto.
- Texto operacional com 13–15 px; metadados com no mínimo 11 px.
- Evitar textos inteiros em caixa alta, exceto rótulos curtos de contexto.

### Espaçamento, bordas e sombras

- Escala base: 4, 8, 12, 16, 20, 24 e 32 px.
- Controles: raio de 10 px.
- Cards: raio de 14–16 px.
- Bordas discretas para separar superfícies; sombras somente em elementos elevados.
- Foco de teclado com anel azul de 3 px e deslocamento visível.

## Componentes padronizados

1. Navegação: marca, grupos, item ativo, favoritos, alertas e estado do sistema.
2. Cabeçalho: contexto da página, busca, filtros, notificações, tema e usuário.
3. Cabeçalho de página: contexto, título, descrição e ações.
4. KPI: ícone semântico, rótulo, valor, variação e micrográfico.
5. Card de conteúdo: cabeçalho, ação secundária, corpo e estados.
6. Tabelas e filtros.
7. Formulários e validação.
8. Modais, confirmações e painéis laterais.
9. Alertas, toasts, estados vazios e carregamento.

## Comportamento responsivo

- `>= 1600 px`: seis KPIs em uma linha e dashboard amplo.
- `1024–1599 px`: três KPIs por linha e widgets em proporção 8/4.
- `768–1023 px`: dois KPIs por linha e widgets em uma coluna.
- `< 768 px`: menu em drawer, cabeçalho compacto e dashboard em uma coluna.
- Tabelas mantêm rolagem interna; a página não deve criar rolagem horizontal global.
- Controles interativos mantêm alvo mínimo próximo de 44 px no celular.

## Ordem recomendada do redesign

1. Identidade global, menu, cabeçalho e Dashboard.
2. Tabelas, filtros, paginação e estados vazios.
3. Formulários, validações, modais e confirmações.
4. Ordens de Serviço, Ativos e Estoque.
5. Planejamento, equipes, áreas e estruturas.
6. Relatórios, administração, login e acabamento de acessibilidade.

## Riscos e contenções

- O monólito possui várias camadas históricas de CSS. Esta fase adiciona uma camada final, identificada e restrita, sem reformatar o arquivo.
- O Dashboard usa widgets configuráveis e elementos gerados por JavaScript. O layout continua baseado nas classes existentes.
- O modo claro precisa acompanhar os mesmos tokens para não perder contraste.
- A navegação mobile depende das classes atuais de estado; nenhuma regra JavaScript foi alterada.
