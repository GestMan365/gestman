# GestMan365 — Design Phase 04

Data: 2026-07-29
Branch: `design/ui-ux-v1`
Base: `9827c74`
Prévia local: `http://127.0.0.1:5189/?phase=04-final`

## Resultado

A Fase 4 concluiu o acabamento visual transversal, corrigiu a divergência funcional comprovada entre o documento principal e o fallback, ampliou a consistência de interação e deixou uma validação automática para impedir nova dessincronização.

Nenhuma regra de negócio, contrato de API, autenticação, migration, RLS, RPC, Edge Function, Storage ou dado remoto foi alterado.

## Arquivos alterados

- `index.html`;
- `404.html`;
- `scripts/validate-index-404-sync.mjs`;
- `INDEX_404_SYNC_AUDIT_REPORT.md`;
- `DESIGN_PHASE_04_REPORT.md`.

## Acabamento visual implementado

Foi adicionado o bloco `design-phase-04`, com 44 grupos de regras de acabamento:

- transição curta e discreta ao alternar views;
- estados coerentes de hover, active, focus e focus-within;
- foco visível com contraste em botões, abas, campos, summaries e elementos navegáveis;
- campos com estados de hover, foco, leitura e desabilitado;
- tabelas com foco de linha, divisores e rolagem interna estável;
- áreas de ações e rodapés de modal mais consistentes;
- conteúdo de modal protegido contra overflow;
- estados vazios com leitura balanceada;
- entrada curta de toast;
- indicador lateral nas opções ativas do menu e das configurações;
- alvos mínimos de 42 px no mobile;
- modal comum contido no viewport mobile;
- tratamento de `prefers-reduced-motion`.

As mudanças complementam as Fases 1–3 e não recriam os componentes já padronizados.

## Sincronização `index.html` / `404.html`

A auditoria encontrou uma implementação antiga de conflito de estado remoto no fallback. O `404.html` podia recarregar a versão do servidor e perder uma alteração local ainda não sincronizada.

Foram sincronizados exclusivamente:

- estado `gmSyncConflict`;
- normalização de estado remoto;
- detecção de chaves locais e remotas alteradas;
- merge quando não há sobreposição;
- modal de conflito;
- download da cópia local;
- escolha explícita da versão do servidor;
- mensagem específica de permissão;
- integração com `gmPersistState` e `loadSupabaseState`.

Resultado:

- arquivos binariamente idênticos;
- nenhum fallback intencional perdido;
- validação automática adicionada;
- detalhes completos em `INDEX_404_SYNC_AUDIT_REPORT.md`.

## Acessibilidade

Validado:

- foco visível;
- fechamento de modal por `Escape`;
- retorno do foco ao botão que abriu o modal;
- `role="dialog"`;
- `aria-modal="true"`;
- modal rotulado pelo título;
- navegação por abas nas configurações;
- tabelas roláveis com foco;
- toasts com live region já existente;
- estados vazios com live region já existente;
- redução de movimentos por preferência do sistema;
- controles mobile acessíveis.

No teste de configurações, o foco retornou para “Abrir perfil do usuário” após o fechamento por teclado.

## Matriz responsiva

| Resolução | View testada | Overflow horizontal global |
|---|---|---|
| 360 × 800 | Equipes e Recursos | Não |
| 390 × 844 | Equipes e Recursos, menu e formulário | Não |
| 768 × 1024 | Equipes e Recursos | Não |
| 1024 × 768 | Equipes e Recursos | Não |
| 1280 × 720 | Equipes e Recursos | Não |
| 1366 × 768 | Dashboard e módulos internos | Não |
| 1440 × 900 | Equipes e Recursos | Não |
| 1920 × 1080 | Equipes e Recursos | Não |

No mobile 390 × 844:

- gaveta lateral abriu e fechou;
- largura da gaveta: 310 px;
- formulário de recurso ocupou o viewport sem extrapolar;
- botões “Cancelar” e “Salvar Recurso” permaneceram visíveis;
- tabela foi convertida para cards/rolagem interna conforme o módulo;
- `scrollWidth` global permaneceu menor ou igual ao `innerWidth`.

O controle de viewport disponível não expôs leitura confiável do zoom nativo. A condição equivalente a 125% foi coberta pelas larguras efetivas intermediárias de 1024 e 1280 px; não foi declarado um resultado de zoom nativo que a ferramenta não mediu.

## Módulos validados no navegador

- Login;
- Dashboard;
- Ordens de Serviço;
- Ativos e Equipamentos;
- Catálogo e Almoxarifado de Peças;
- Planos de Manutenção;
- Calendário Operacional;
- Checklists;
- Medições;
- Equipes e Recursos;
- Usuários e acessos;
- Configurações;
- formulário e modal.

Em 1366 × 768, todos os módulos solicitados abriram com o heading esperado, campos e tabelas renderizados e sem overflow global.

## Estados e mensagens

Validados visualmente:

- estado normal com dados demo;
- estado vazio por pesquisa sem resultados;
- formulário aberto;
- modal;
- aviso/erro amigável de indisponibilidade de rede no login;
- toast de erro;
- estado de foco;
- tema claro;
- tema escuro;
- menu aberto;
- menu recolhido.

A mensagem de rede apresentada foi:

> Não foi possível conectar ao servidor. Verifique a internet e tente novamente.

Nenhuma stack trace, RPC, nome de tabela, token, project ref ou detalhe interno apareceu para o usuário.

## Desempenho visual

Observações:

- `index.html`: aproximadamente 6,30 MB;
- build Vite: 8 módulos transformados;
- saída principal: 6.295,33 kB;
- gzip: 3.273,37 kB;
- 7 blocos de estilo;
- 7 blocos JavaScript inline no arquivo oficial;
- 44 grupos de regras adicionados na Fase 4;
- 6.550 elementos DOM na prévia demo completa;
- 5 imagens;
- 36 fontes registradas pelo documento;
- nenhum novo asset externo;
- nenhuma nova dependência;
- nenhuma animação longa;
- `prefers-reduced-motion` aplicado.

Risco residual: o tamanho do monólito e o volume de DOM continuam altos. A Fase 4 evitou refatoração ampla; modularização e carregamento por módulo devem ser tratados separadamente.

## Duplicações

- IDs duplicados no DOM renderizado: 0;
- IDs duplicados no HTML estático: 0;
- listeners adicionados pela Fase 4: 0;
- funções globais adicionadas ao monólito: 0;
- nomes de funções duplicados preexistentes: 53;
- listeners preexistentes no monólito: 321 ocorrências.

As duplicações preexistentes foram documentadas, não ampliadas.

## Testes executados

- `node scripts/validate-index-404-sync.mjs`: aprovado;
- sintaxe dos 7 blocos JavaScript de cada HTML: aprovada;
- IDs estáticos duplicados: 0;
- TypeScript: aprovado;
- `npm run build`: aprovado;
- checks estáticos de segurança: aprovados;
- auditoria de segredos: sem literal de segredo versionado;
- `git diff --check`: aprovado;
- hash binário entre `index.html` e `404.html`: idêntico;
- navegação real local: aprovada;
- console da aplicação: 0 erros e 0 warnings capturados;
- matriz responsiva: aprovada;
- temas claro e escuro: aprovados;
- modal, foco e teclado: aprovados.

Os testes remotos oficiais não foram executados porque esta fase proíbe alteração ou dependência de Staging. A prévia usa `https://invalid.local` e uma chave deliberadamente inválida.

## Galeria visual

Diretório:

`C:\Users\andsa\.codex\visualizations\2026\07\24\019f957d-f69c-7620-a1e7-8a679ab86a4c`

Principais capturas:

- `gestman-04-login-dark-1366x768.png`;
- `gestman-04-login-error-dark-1366x768.png`;
- `gestman-04-login-error-dark-390x844.png`;
- `gestman-04-dashboard-dark-collapsed-1366x768.png`;
- `gestman-04-dashboard-dark-open-1366x768.png`;
- `gestman-04-dashboard-light-open-1366x768.png`;
- `gestman-04-orders-light-1366x768.png`;
- `gestman-04-assets-light-1366x768.png`;
- `gestman-04-spares-light-1366x768.png`;
- `gestman-04-stock-light-1366x768.png`;
- `gestman-04-preventivePlans-light-1366x768.png`;
- `gestman-04-calendar-light-1366x768.png`;
- `gestman-04-checklists-light-1366x768.png`;
- `gestman-04-measurements-light-1366x768.png`;
- `gestman-04-teamsResources-light-1366x768.png`;
- `gestman-04-settings-users-light-1366x768.png`;
- `gestman-04-form-resource-light-1366x768.png`;
- `gestman-04-mobile-menu-light-390x844.png`;
- `gestman-04-form-resource-light-390x844.png`;
- `gestman-04-teamsResources-dark-390x844.png`;
- `gestman-04-empty-search-dark-390x844.png`.

## Limitações e próximos passos

1. Modularizar o monólito em incremento técnico separado, mantendo contratos globais.
2. Reduzir os 53 nomes de funções repetidos com testes de compatibilidade.
3. Diminuir o bundle e o DOM inicial com carregamento sob demanda.
4. Criar suíte visual automatizada com comparação de screenshots.
5. Executar validação contra Supabase Staging apenas em uma fase de release autorizada.

## Segurança e ambientes

- Produção alterada: Não.
- Staging alterado: Não.
- Backend alterado: Não.
- Supabase alterado: Não.
- Push realizado: Não.
- Merge realizado: Não.
- Deploy público realizado: Não.
