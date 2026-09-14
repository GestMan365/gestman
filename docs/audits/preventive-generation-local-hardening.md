# Geração preventiva — validação local final

Data da rodada final: 14/09/2026.
Worktree: `phase04-username-forward-only`.
Branch: `codex/phase04-username-forward-only`.
HEAD inicial: `1b230fd6aaa331a1aa4c9af19bd06e661207d5d2`.

## Escopo e resultado

Correção local da geração preventiva e da navegação responsiva, com QA
isolado e dados fictícios. As quatro dimensões CSS exatas, cenários
funcionais e verificações locais abaixo passaram na rodada final.
Este relatório substitui os resultados parciais de 09 e 10/09.

O gate catalogal remoto da Fase 04 continua pendente. Este resultado não
autoriza publicação e não demonstra atomicidade remota. Não houve acesso a
produção, Supabase remoto, login, carregamento de credenciais, execução de
migration, repair, push, merge ou deploy. Não foram instaladas dependências.

## Implementação e revisão do diff

O escopo contém apenas oito arquivos: `index.html`, `404.html`, este
relatório, `scripts/validate-preventive-plan-order-generation.mjs`,
`tests/preventive-plan-order-generation.test.mjs`,
`scripts/preventive-local-qa-browser.mjs`,
`scripts/serve-preventive-local-qa.mjs` e
`tests/fixtures/preventive-local-qa.js`.

### Geração preventiva

- Bloqueio em memória por empresa dentro da função de geração, liberado em
  `finally`. Planos da mesma empresa compartilham o bloqueio nesta instância
  do frontend porque persistem um documento de estado compartilhado.
- Captura da ocorrência inicial mesmo quando o chamador omite a data esperada.
- Validação de sessão e permissão na função; revalidação de empresa, usuário,
  estado, permissão, plano e ocorrência após aguardar a numeração.
- Preservação das regras de plano pausado, executantes, responsável,
  checklist, peças e duplicidade já existentes.
- Rollback seletivo da O.S. e do evento gerados. Datas e timestamp somente
  são restaurados quando ainda coincidem com os valores daquela geração,
  preservando alterações concorrentes alheias.
- Nenhuma restauração na sessão de outra empresa nem após confirmação
  positiva de persistência; mensagens específicas para falhas de contexto.
- Detalhe prioriza `durationHours`, aceita duração legada válida e mostra
  `1 h` no caso testado; ausência ou valor inválido mantém `Sem dados`.

### Diagnóstico e correção de layout

Apesar dos nomes `industrial-sidebar-*`, a interface deste worktree usa
navegação superior horizontal. Essa estrutura foi preservada; não houve
redesenho para barra lateral.

Havia dois problemas distintos: o painel QA precisava participar do fluxo
da `.workspace`, e o menu de produção precisava permitir acesso às linhas
que não cabiam na faixa visível. Também foram corrigidos os trilhos de
texto/seta dos resumos compactos e a altura reservada ao cabeçalho mobile.

Em `#mainNavigation .industrial-sidebar-scroll`, a lista usa flex com
`min-width: 0`, `min-height: 0`, quebra de linhas e `overflow-y: auto`.
Somente os itens da navegação rolam; marca e rodapé não encolhem. Há
preenchimento inferior de 12 px e `scroll-padding` para o último item.
Administração permanece disponível, com texto de 12 px; nenhum módulo foi
ocultado. Dropdowns ficam fora da faixa de recorte do scroller.

Os controles QA quebram linha e permanecem dentro do painel. Seus estilos
são limitados a `#preventiveQa`. As alterações de produção estão espelhadas
em `index.html` e `404.html`, que permanecem binariamente idênticos.

## Navegador integrado e calibração

Foi utilizado exclusivamente o navegador integrado, pelas APIs da skill
Browser, com interação pelos controles e medições DOM somente de leitura.
Nenhum Chromium headless externo foi iniciado nesta rodada.

Cada tentativa ajustou o tamanho externo a partir da dimensão interna
observada. A aprovação exige igualdade inteira de `window.innerWidth` e
`window.innerHeight`, sem tolerância nessas duas medidas.

| Alvo CSS | Tentativas: tamanho externo → dimensão interna real |
| --- | --- |
| 951×535 | 951×535 → 820×461; 1103×621 → **951×535** |
| 1103×621 | 1103×621 → 951×535; 1279×721 → **1103×621** |
| 1366×768 | 1366×768 → 1178×662; 1584×891 → 1365×768; 1585×891 → **1366×768** |
| 390×844 | 390×844 → 336×728; 453×978 → 390×843; 453×979 → **390×844** |

### Bounding boxes após rolar a navegação

Valores `[x, y, largura, altura]`, em CSS px, arredondados a duas casas.
As asserções de geometria toleram até 1 px de arredondamento subpixel;
as dimensões internas da viewport são verificadas sem tolerância.

| Região | 951×535 | 1103×621 |
| --- | --- | --- |
| Menu | [0, 0, 950.86, 64] | [0, 0, 1102.59, 64] |
| Cabeçalho | [0, 64, 950.86, 47.99] | [0, 64, 1102.59, 47.99] |
| Marca | [0, 0, 126, 64] | [0, 0, 126, 64] |
| Rodapé do menu | [850.86, 0, 100, 64] | [1002.59, 0, 100, 64] |
| Área rolável | [126, 0, 724.87, 64] | [126, 0, 876.59, 64] |
| Workspace | [0, 111.99, 950.86, 423.34] | [0, 111.99, 1102.59, 509.55] |
| Painel QA | [23.99, 135.98, 889.95, 137.66] | [23.99, 135.98, 1041.68, 137.66] |
| Conteúdo preventivo | [23.99, 289.63, 889.95, 898.17] | [23.99, 289.63, 1041.68, 823.25] |
| Administração | [336.92, 7.69, 125.42, 42] | [133.98, 7.69, 125.42, 42] |

| Região | 1366×768 | 390×844 |
| --- | --- | --- |
| Menu | [0, 0, 1366.38, 64] | [0, 64, 390.52, 64] |
| Cabeçalho | [0, 64, 1366.38, 47.99] | [0, 0, 390.52, 64] |
| Marca | [0, 0, 161.99, 64] | [0, 64, 72, 59.99] |
| Rodapé do menu | [1266.38, 0, 100, 64] | [308.53, 64, 81.99, 64] |
| Área rolável | [161.99, 0, 1104.39, 64] | [72, 64, 236.53, 64] |
| Workspace | [0, 111.99, 1366.38, 656.10] | [0, 127.99, 390.52, 715.96] |
| Painel QA | [23.99, 135.98, 1305.47, 137.66] | [11.99, 207.99, 353.61, 271.62] |
| Conteúdo preventivo | [23.99, 289.63, 1305.47, 730.25] | [11.99, 495.60, 353.61, 757.19] |
| Administração | [169.98, 7.69, 160.39, 42] | [80.85, 70.99, 130.40, 46] |

Bounding boxes dos controles QA, comuns às três larguras desktop:

| Controle | Desktop | 390×844 |
| --- | --- | --- |
| Reiniciar cenário | [40.84, 187.22, 143.53, 38] | [28.84, 281.63, 143.53, 38] |
| Pausar plano | [192.36, 187.22, 123.40, 38] | [180.36, 281.63, 123.40, 38] |
| Simular falha | [323.75, 187.22, 99.96, 38] | [28.84, 327.61, 99.96, 38] |
| Testar geração | [431.69, 187.22, 110.33, 38] | [136.79, 327.61, 110.33, 38] |
| Testar envio duplo | [550.01, 187.22, 128.97, 38] | [28.84, 373.60, 128.97, 38] |
| Ocultar painel QA | [686.97, 187.22, 147.82, 38] | [165.80, 373.60, 147.82, 38] |

Nas quatro dimensões, Administração ficou totalmente dentro do scroller,
recebeu foco real e abriu por clique. `scrollTop` do menu chegou a 48.28 px
nos desktops e 257.76 px no mobile; `workspace.scrollTop` permaneceu zero.
Marca, cabeçalho, rodapé e workspace mantiveram suas caixas ao rolar o menu.
Ocultar o QA não alterou a geometria do menu, cabeçalho, rodapé ou último
item, confirmando que o painel não provoca artificialmente o recorte.

Não houve sobreposição entre menu/cabeçalho/workspace, marca/lista/rodapé,
QA/conteúdo, controles QA ou textos/setas dos itens. Nenhuma rolagem
horizontal global, na workspace, no menu ou no painel QA foi detectada.
O conteúdo mais alto que a viewport rola normalmente dentro da workspace.
Dropdowns abertos são sobreposições intencionais; não são cortes do menu.

### Cenários funcionais e tipografia

Em cada uma das quatro dimensões:

- Modal e detalhe exibiram duração `1 h`.
- Cancelamento preservou O.S., data e eventos.
- Plano pausado bloqueou geração e solicitou reativação.
- Falha determinística de persistência simulada restaurou O.S., data e
  evento da tentativa, sem criação residual.
- Dois cliques no botão de confirmação produziram somente uma O.S., um
  evento e próxima execução `2026-10-09`, partindo de `2026-09-09`.
- Modal coube horizontalmente; no mobile, controles foram acessados pela
  rolagem interna e permaneceram funcionais.
- Inter local carregada, interface visível com a fonte esperada, nenhuma
  família não aprovada, texto corrompido ou título/label com overflow.

## Testes locais finais

| Verificação | Resultado |
| --- | --- |
| Testes preventivos | 24/24, sem falhas ou skips |
| Suíte unitária completa, incluindo preventivas | 128/128, sem falhas ou skips |
| Validadores estáticos locais | 22/22 |
| TypeScript sem emissão | Aprovado após a correção final de duração |
| Vite build | Aprovado após a correção final de duração e navegação |
| Sintaxe dos scripts QA e testes modificados | Aprovada |
| Sintaxe inline index/404 | 7 blocos em cada entrada, aprovados |
| Paridade index/404 | Binária e normalizada aprovadas; zero IDs duplicados |
| Navegador integrado e tipografia | 4/4 viewports CSS exatas aprovadas |
| `git diff --check` | Aprovado |

Comandos principais, sem instalação de dependências:

```powershell
node --test --test-timeout=10000 tests/preventive-plan-order-generation.test.mjs
node --experimental-strip-types --test --test-timeout=10000 tests/*.test.mjs
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
node node_modules/vite/bin/vite.js build
node scripts/validate-index-404-sync.mjs
node --check scripts/preventive-local-qa-browser.mjs
node --check scripts/serve-preventive-local-qa.mjs
node --check tests/fixtures/preventive-local-qa.js
node --check tests/preventive-plan-order-generation.test.mjs
git diff --check
```

Validadores aprovados (prefixo `validate-`, extensão `.mjs`):
`ai-gestman`, `application-routes`, `asset-downtime-sync`,
`asset-lifecycle-checklist-history`, `checklist-observation-audit`,
`checklist-order-context`, `company-onboarding`, `flaticon-icons`,
`index-404-sync`, `maintenance-metrics`, `order-deletion`,
`phase03-material-reports`, `preventive-plan-order-generation`,
`profile-image-persistence`, `resource-user-source`, `session-security`,
`whatsapp-integration`, `work-order-completion-time`, `work-order-hours`,
`work-order-immutability`, `work-order-material-audit`,
`work-order-state-machine`.

Os scripts `validate-staging-bootstrap.mjs` e
`validate-staging-security.mjs` não foram executados. O script independente
`validate-typography-ui.mjs` também não foi executado nesta rodada porque
inicia navegador externo; as verificações DOM de fonte, codificação e
overflow foram realizadas no navegador integrado pelo novo helper de QA.
Isso não representa aprovação de fluxos remotos, login ou E2E integrado.

O build emitiu os avisos existentes sobre `icon-registry.js` e
`qrcode-generator.js` serem scripts clássicos sem `type="module"`.
Não houve falha; o projeto mantém a cópia configurada dos assets clássicos.

SHA-256 binário das duas entradas HTML validadas:
`e7731eae0688bb1792f9bfa80dfc3c7db523d2f606f222c6f3bc70ce8ca6b320`.

## Isolamento e reprodução do QA

`node scripts/serve-preventive-local-qa.mjs` escuta exclusivamente em
`127.0.0.1:4186`. A página raiz injeta a fixture sintética, permite apenas
assets locais e envia CSP com `connect-src 'none'`. Arquivos de ambiente
não são servidos. Não houve visita à rota de login.

Os helpers de `scripts/preventive-local-qa-browser.mjs` recebem a aba e a
capacidade de viewport do navegador integrado: `calibrateViewport`,
`checkMenuAccess`, `checkTypography` e `runPreventiveScenarios`. O módulo
não inicia browser, não lê credenciais nem cria conexões externas. Cada
dimensão foi calibrada, medida, rolada e testada por esses helpers.

A fixture substitui a fronteira de persistência por memória/falha
determinística. Geração, modal e cálculo da próxima execução usam o código
da aplicação. Os testes unitários isolados têm seus próprios doubles.
Os arquivos QA não são importados pelas entradas de produção.

## Limitações e entrega

- Exclusividade entre abas e dispositivos continua dependendo de unicidade
  por empresa + plano + ocorrência e transação no servidor. O mutex desta
  correção vale somente para uma instância do frontend.
- `gmPersistState` e seu tratamento compartilhado de conflitos não foram
  alterados. Perda de resposta após gravação remota exige reconciliação;
  o rollback local não prova ausência de escrita remota.
- Não foram implementados scheduler, Cron, geração autônoma, política para
  atrasos acumulados ou mudanças de calendário/fuso.
- O QA não demonstra RLS, autorização efetiva no servidor ou atomicidade
  entre documento de estado, O.S. e recorrência.
- `dist` é artefato regenerável e não faz parte da entrega. Screenshots
  foram inspecionadas em memória, sem arquivos adicionados ao worktree.
- A entrega autorizada é um único commit local isolado, sem publicação:
  `fix(preventivas): protege geração concorrente de ordens`.

### Limpeza final

O servidor QA foi encerrado e a viewport do navegador integrado restaurada;
a aba temporária de QA foi fechada. Sintaxe, paridade e `git diff --check`
passaram novamente na conferência final.

O diretório ignorado `dist` foi conferido em simulação e removido pela
limpeza nativa do Git, limitada explicitamente a esse caminho. Não há
screenshots, logs ou outros temporários no `test-results` deste worktree.
O build não foi repetido depois da limpeza porque o código não mudou e uma
nova execução apenas recriaria o artefato já validado e removido.
