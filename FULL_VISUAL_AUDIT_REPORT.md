# GestMan365 — Auditoria visual e de interação

Data da validação: 2026-08-09
Branch local: `qa/full-system-nadir-validation-v1`
Ambiente validado: aplicação oficial monolítica em servidor local, sem publicação e sem gravações de teste.

## Escopo executado

- Varredura visual das 30 rotas operacionais disponíveis no menu.
- Verificação dos temas claro e escuro em Dashboard, Ativos, Materiais, Medições, Ações Pendentes, Paradas, Estrutura de Instalação, Calendário e formulários representativos.
- Abertura segura dos formulários principais sem salvar registros.
- Teste de abas, filtros, menus de ação, pesquisa global, notificações, ajuda, configurações, perfil e expansão/recolhimento do menu.
- Auditoria de logos, imagens quebradas, IDs duplicados, labels órfãos, botões sem nome e erros de console.
- Validação de build, TypeScript, sintaxe dos scripts inline e sincronismo entre `index.html` e `404.html`.

## Rotas verificadas

Visão Geral, Acessos Rápidos, Ordens de Serviço, O.S. em Execução, Planos de Manutenção, Checklists, Medições, Ações Pendentes, Paradas, Diário de Manutenção, Ativos e Equipamentos, Identificadores de Ativos, Áreas Operacionais, Regiões, Setores e Locais, Estrutura de Instalação, Documentos, Catálogo de Peças, Almoxarifado de Peças, Movimentações de Estoque, Transferências de Estoque, Solicitações de Materiais, Fornecedores e Parceiros, Ferramentas, Recursos e Equipes, Calendário Operacional, Calendários Produtivos, Indicadores, Relatórios e IA GestMan365.

## Interações verificadas

Abriram corretamente, sem submissão ou alteração de dados:

- Nova O.S.;
- Novo Plano;
- Novo Checklist;
- Novo Ponto de Medição;
- Nova Ação;
- Registrar Parada;
- Novo Registro do Diário;
- Novo Ativo;
- Novo Identificador;
- Nova Área;
- Nova Região;
- Novo Setor;
- Nova Estrutura;
- Novo Documento;
- Nova Peça;
- Novo Almoxarifado;
- Novo Fornecedor;
- Nova Ferramenta;
- Adicionar Recurso;
- Nova Equipe;
- Registrar Indisponibilidade.

Também foram exercitadas as abas de O.S., Checklists, Medições, Recursos e Equipes, Calendário e Materiais, além de um menu de ações de Ações Pendentes.

## Problemas comprovados e corrigidos

1. **Medições, Ações Pendentes e Paradas excediam a área útil com o menu lateral aberto.**
   - Causa: filhos de grids mantinham largura mínima intrínseca maior que o espaço restante, e o breakpoint considerava somente o viewport total.
   - Correção: contenção dos workspaces, grids de três colunas no desktop intermediário, controles em duas linhas e rolagem interna das tabelas.

2. **Cartões do Calendário Operacional exibiam texto letra por letra.**
   - Causa: a injeção automática de ícones transformava os botões de evento em `inline-flex` e comprimida os textos.
   - Correção: restauração do layout em bloco, remoção do ícone automático nesse componente e truncamento em múltiplas linhas com detalhes completos acessíveis ao abrir o evento.

3. **Não havia controle visível para reabrir o menu lateral recolhido no desktop.**
   - Correção: o botão do cabeçalho permanece visível quando o menu está recolhido. Recolher e expandir foram testados em sequência.

4. **Logo completo era cortado quando o menu lateral estava expandido.**
   - Antes: imagem com cerca de 174 px dentro de contêiner de 158 px.
   - Depois: imagem dimensionada ao contêiner, sem overflow e com proporção preservada.

5. **Estrutura de Instalação possuía nome divergente, abas quebradas e baixo contraste no tema claro.**
   - Correção: título e ação principal padronizados, abas em uma linha com rolagem interna, cartões de informação claros e seleção da árvore com contraste adequado.

6. **Rodapé dos formulários de Ações/Medições permanecia escuro no tema claro.**
   - Correção: fundo e borda adaptados ao tema claro.

7. **Nomes inconsistentes entre menu e conteúdo.**
   - Padronizados: `Recursos e Equipes`, `Diário de Manutenção` e `Estrutura de Instalação`.
   - Corrigido o rótulo corrompido `Solicitações` na navegação administrativa.

8. **Filtros do Calendário não possuíam nomes acessíveis.**
   - Correção: rótulos `aria-label` aplicados aos dez campos do filtro.

## Temas claro e escuro

- Dashboard: aprovado nos dois temas.
- Cabeçalho e navegação: aprovados nos dois temas.
- Tabelas e filtros: aprovados nas telas verificadas.
- Modais: aprovados após correção do rodapé claro.
- Estrutura de Instalação: contraste corrigido no tema claro.
- Calendário: cartões corrigidos e legíveis nos dois temas.

## Validações estruturais

- IDs duplicados no DOM: **0**.
- Labels `for` órfãos: **0**.
- Botões visíveis sem nome acessível: **0**.
- Imagens quebradas: **0**.
- Logo: arquivo carregado, dimensão natural válida e sem corte no menu expandido.
- Console: **0 erros e 0 warnings relevantes** durante a auditoria.
- Sintaxe JavaScript inline: **6 blocos válidos em cada HTML**.
- `index.html` e `404.html`: hashes binários idênticos.
- TypeScript e build Vite: aprovados.
- `git diff --check`: aprovado.

## Dívida técnica observada e não alterada

- O monólito contém declarações JavaScript repetidas em camadas antigas e de hardening. Elas não produziram erro funcional nos fluxos verificados, mas tornam refatorações amplas arriscadas.
- O build mantém aviso não bloqueante para `icon-registry.js` sem `type="module"`; o arquivo é copiado e funciona como script clássico.
- A aplicação oficial continua sendo um HTML monolítico grande. Separação estrutural deve ser tratada em tarefa própria, com regressão completa.
- Mobile e tablet não foram incluídos nesta rodada porque o escopo definido pelo usuário prioriza computadores nesta fase.

## Segurança e publicação

- Nenhuma regra de negócio foi alterada.
- Nenhum registro foi criado, editado ou excluído.
- Supabase não foi alterado.
- Nenhum commit foi criado.
- Nenhum push ou deploy foi realizado.

## Arquivos desta auditoria

- `index.html`
- `404.html`
- `FULL_VISUAL_AUDIT_REPORT.md`

As alterações anteriores já presentes em `FULL_SYSTEM_FIX_IMPLEMENTATION_REPORT.md` foram preservadas e não foram descartadas.

## Validação final de integração antes da publicação

- Login real no domínio de teste Nadir aprovado, sem erro de console.
- Corrigida a sobreposição do rodapé de suporte sobre o botão `Entrar` em janelas desktop de pouca altura; o formulário permanece acessível e a tela passa a ter rolagem interna controlada.
- Corrigida a máscara CSS dos 117 ícones Flaticon locais; os ícones deixaram de aparecer como superfícies vazias.
- Corrigida a duplicação automática de ícones em cabeçalho, notificações e atalhos; somente o seletor de tema mantém intencionalmente os ícones de sol e lua.
- Corrigida a sobreposição entre pesquisa e ações do cabeçalho no desktop intermediário; a pesquisa passa a abrir em painel compacto entre 901 e 1180 px.
- Corrigido o ícone do botão `Fechar busca`, preservando um único ícone semântico.
- Ocultada a atribuição textual da Flaticon apenas enquanto o menu está recolhido, evitando texto cortado; a atribuição continua disponível com o menu expandido.
- Modo claro e modo escuro verificados, sem imagens quebradas e sem overflow horizontal global.
- Smoke test de navegação aprovado em 28 módulos acessíveis, incluindo Ordens, Ativos, Mapa Industrial, Materiais, Estoque, Recursos e Equipes, Calendários, Indicadores, Relatórios e IA.
- Administração de usuários abriu corretamente e diferenciou acesso empresarial de status global.
- Mapa Industrial preservou Região, dois Locais, 21 máquinas, fotos válidas e a hierarquia Região → Local → Máquina.
- Nenhum dado foi criado, editado ou excluído nesta validação final.
