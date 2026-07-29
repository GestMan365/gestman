# GestMan365 — Relatório de Engenharia de Design Fase 3

## Escopo

- Branch: `design/ui-ux-v1`
- Base da fase: `fd1d946`
- Aplicação oficial: monólito `index.html` / `404.html`
- Preview: cópia local sanitizada, sem acesso ao Supabase remoto
- Backend, Supabase, RLS, RPCs, Storage e Edge Functions: não alterados
- Produção: não alterada

Esta fase padronizou visualmente os módulos internos sem alterar regras de negócio, permissões, contratos de API, IDs funcionais preexistentes ou persistência.

## Diagnóstico visual

- Os módulos possuíam implementações funcionais completas, mas usavam variações de espaçamento, superfícies, métricas, filtros, tabelas e estados vazios.
- Estoque, Preventivas, Checklists e Medições já possuíam versões desktop e mobile. A intervenção foi de padronização e hierarquia, não de reconstrução.
- O calendário operacional mais recente é renderizado pelo bloco `stage19`; o calendário legado permanece no arquivo por compatibilidade.
- Usuários e perfil compartilhavam um modal extenso, sem navegação interna clara para configurações.
- O status de vínculo empresarial e o status global do usuário não tinham colunas visualmente distintas.
- O monólito possui dívida técnica preexistente de funções declaradas mais de uma vez. Nenhuma nova duplicação funcional foi introduzida.

## Sistema visual aplicado

Foi criado o bloco sustentável `#design-phase-03`, baseado nos tokens das fases anteriores:

- superfícies e bordas coerentes nos temas claro e escuro;
- raios, sombras e espaçamentos unificados;
- cabeçalhos de módulo com hierarquia editorial;
- métricas compactas e legíveis;
- filtros e buscas com a mesma estrutura visual;
- tabelas com cabeçalhos fixos dentro da rolagem controlada;
- cartões mobile e paginação padronizados;
- foco de teclado visível;
- estados vazio, erro, sucesso e carregamento;
- modais com cabeçalho fixo, conteúdo rolável e ações persistentes;
- respeito a `prefers-reduced-motion`.

## Módulos redesenhados

### Materiais e Estoque

- Cabeçalho, abas, métricas, busca, filtros, alerta e tabela foram padronizados.
- Os indicadores passaram a usar somente dados reais:
  - itens cadastrados;
  - itens abaixo do mínimo;
  - itens sem movimentação;
  - valor estimado, exibido apenas quando há valor de referência;
  - movimentações dos últimos 30 dias.
- Em mobile, as abas usam rolagem horizontal interna e não quebram os títulos em várias linhas.
- A tabela permanece com rolagem interna e os cartões mobile existentes foram preservados.

### Planos Preventivos e Calendário

- Cabeçalhos, métricas, filtros, listagem e paginação receberam a mesma hierarquia visual.
- O calendário operacional `stage19` ganhou painel, filtros e timeline com superfícies padronizadas.
- Eventos passaram a permitir texto em múltiplas linhas, preservando tipo, status e prioridade como texto, sem depender somente de cor.
- A grade usa rolagem interna quando não cabe na largura disponível.
- A legenda do calendário legado foi adicionada sem alterar eventos ou regras.

### Checklists

- Métricas, abas, filtros, listagem, cartões mobile e estados vazios foram alinhados ao sistema visual.
- Controles de execução, progresso e evidências existentes foram preservados.
- Nenhuma validação, resposta ou regra de execução foi alterada.

### Medições

- Pontos de medição, histórico, alertas, filtros, cards e gráficos passaram a compartilhar as mesmas superfícies e tokens.
- O estado sem pontos cadastrados foi mantido com explicação e ação principal.
- O modal de novo ponto foi validado com foco inicial, fechamento por `Escape` e layout mobile.

### Usuários e acessos

- O modal passou a distinguir visualmente:
  - `Acesso ativo nesta empresa` / `Acesso removido desta empresa`;
  - `Usuário global ativo` / `Usuário global desativado` / `Status global não informado`.
- Nenhuma ação global nova foi criada.
- A ação existente de remover acesso continua afetando somente o vínculo com a empresa.
- A tabela mantém perfil, região, último acesso e ações existentes.

### Configurações

O conteúdo de perfil e administração foi organizado em uma navegação interna acessível:

- Empresa e perfil;
- Usuários e acessos;
- Manutenção;
- Ordens de Serviço;
- Estoque;
- Notificações;
- Aparência;
- Integrações;
- Segurança.

Grupos sem configuração real mostram uma mensagem honesta e não criam opções fictícias. O painel Aparência reutiliza o controle de tema existente. O painel Segurança reutiliza o conteúdo administrativo já implementado.

## Acessibilidade e estados

- Tabelas roláveis recebem `tabindex` e rótulo acessível.
- Estados vazios recebem `role="status"` e `aria-live="polite"`.
- Elementos em carregamento recebem `aria-busy`.
- Modais mantêm `role="dialog"`, `aria-modal`, foco inicial, armadilha de foco, fechamento por `Escape` e restauração do foco.
- Tabs de configurações usam `role="tablist"`, `role="tab"`, `role="tabpanel"` e `aria-selected`.
- Status continuam acompanhados de texto; cor não é a única forma de comunicação.

## Arquivos alterados

- `index.html`
- `404.html`
- `DESIGN_PHASE_03_REPORT.md`

Os blocos criados ou alterados nesta fase foram aplicados de forma equivalente em `index.html` e `404.html`. Existe uma divergência funcional anterior, fora do escopo visual, no bloco final de sincronização e tratamento de conflitos: `404.html` já não continha todo o bloco presente em `index.html` antes desta fase. Essa dívida foi registrada e não foi ampliada nem corrigida para evitar uma mudança funcional não autorizada.

## Validação visual

| Resolução | Estoque | Calendário | Modal | Configurações | Overflow global |
|---|---|---|---|---|---|
| 360 × 800 | Aprovado | Aprovado | Aprovado | Aprovado | 0 px |
| 390 × 844 | Aprovado | Aprovado | Aprovado | Aprovado | 0 px |
| 768 × 1024 | Aprovado | Aprovado | Aprovado | Aprovado | 0 px |
| 1024 × 768 | Aprovado | Aprovado | Aprovado | Aprovado | 0 px |
| 1366 × 768 | Aprovado | Aprovado | Aprovado | Aprovado | 0 px |
| 1920 × 1080 | Aprovado | Aprovado | Aprovado | Aprovado | 0 px |

Resultados adicionais:

- menu mobile abriu corretamente em 360 e 390 px;
- cinco métricas reais do Estoque renderizadas em todas as resoluções;
- calendário `stage19` renderizado em todas as resoluções;
- foco inicial permaneceu dentro do modal;
- fechamento do modal por `Escape` aprovado;
- painel Usuários e acessos abriu selecionado pelo menu administrativo;
- nenhum ID duplicado em runtime;
- nenhum erro de console ou `pageerror`;
- nenhuma requisição local falhou.

## Capturas

Antes:

- `gestman-03-before-estoque.png`
- `gestman-03-before-preventivas.png`
- `gestman-03-before-usuarios.png`
- `gestman-03-before-configuracoes.png`

Depois:

- `gestman-03-after-estoque-light.png`
- `gestman-03-after-estoque-dark.png`
- `gestman-03-after-estoque-mobile-390.png`
- `gestman-03-after-preventivas-light.png`
- `gestman-03-after-preventivas-dark.png`
- `gestman-03-after-preventivas-mobile-390.png`
- `gestman-03-after-calendario-dark.png`
- `gestman-03-after-checklists-dark.png`
- `gestman-03-after-medicoes-dark.png`
- `gestman-03-after-usuarios-dark.png`
- `gestman-03-after-usuarios-mobile-390.png`
- `gestman-03-after-configuracoes-light.png`
- `gestman-03-after-configuracoes-dark.png`
- `gestman-03-after-configuracoes-mobile-390.png`
- `gestman-03-after-modal-dark.png`
- `gestman-03-after-estado-vazio.png`
- `gestman-03-after-estado-erro-validacao.png`
- `gestman-03-after-sidebar-recolhida.png`

As capturas estão na pasta de visualizações da tarefa.

## Testes executados

- Sintaxe dos 7 scripts JavaScript inline de cada HTML: aprovada.
- TypeScript via `tsc --noEmit`: aprovado.
- Build Vite: aprovado; 7 módulos transformados.
- Build final: `dist/index.html` com aproximadamente 6,29 MB; gzip aproximado de 3,27 MB.
- Matriz Playwright local sanitizada nas seis resoluções: aprovada.
- Estoque, Preventivas, Calendário, Checklists, Medições, Usuários e Configurações: abertura aprovada.
- Modal de Medições: foco, `Escape` e estado de validação aprovados.
- Temas claro e escuro: aprovados.
- Sidebar recolhida: aprovada.
- IDs duplicados em runtime: nenhum.
- Labels `for` órfãos: nenhum.
- Funções novas da Fase 3: uma declaração de cada.
- Novos listeners globais: nenhum.
- Console e `pageerror`: nenhum erro.
- `git diff --check`: aprovado.

A suíte Playwright oficial não foi executada porque o `global-setup` existente prepara dados e integrações no Supabase Staging. A validação desta fase foi executada exclusivamente na prévia local sanitizada.

## Auditoria de duplicações

- As cinco funções novas de configurações aparecem uma única vez em cada HTML.
- Nenhum listener global foi adicionado; as tabs usam ações locais existentes no conteúdo dinâmico.
- A análise textual ainda encontra 53 nomes de funções duplicados no monólito, todos preexistentes e fora do escopo visual.
- Nenhum ID duplicado foi encontrado no DOM inicial ou após abrir os módulos e o modal de configurações.

## Prévia local

`http://127.0.0.1:5189/?phase=03-final`

A prévia usa uma cópia sanitizada e dados fictícios. Não aponta para produção ou Staging.

## Riscos residuais e próxima etapa

- O volume do monólito e a especificidade acumulada do CSS continuam sendo a principal dívida técnica.
- A divergência preexistente entre `index.html` e `404.html` no bloco de sincronização deve ser tratada em uma tarefa funcional separada, com testes de conflito e persistência.
- As 53 declarações funcionais duplicadas devem ser auditadas fora da fase de design.
- O bundle HTML permanece grande; otimização deve ser planejada separadamente, sem misturar com redesign.
- Próxima etapa recomendada: validar o fluxo completo de cada formulário interno com dados QA locais e, depois, planejar a redução controlada de duplicações CSS/JavaScript.

## Confirmações

- Produção alterada: Não.
- Staging alterado: Não.
- Supabase alterado: Não.
- Backend alterado: Não.
- Push realizado: Não.
- Deploy realizado: Não.
