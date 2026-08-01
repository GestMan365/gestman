# GestMan365 — Sistema Visual Profissional 3D

## Direção visual

O GestMan365 passa a usar uma identidade industrial premium baseada em superfícies azul-marinho, hierarquia compacta, contraste elevado e ícones vetoriais com profundidade controlada. O sistema visual evita preto puro, neon excessivo, glassmorphism pesado e animações contínuas.

Princípios:

- leitura rápida em operações de manutenção;
- informação essencial sempre acompanhada por texto;
- profundidade visual leve, sem comprometer desempenho;
- cores semânticas estáveis entre módulos;
- comportamento equivalente nos temas escuro e claro;
- componentes responsivos desde 360 px;
- preservação integral dos contratos funcionais do monólito.

## Tokens centrais

Os tokens ficam em `assets/ui/gestman-3d.css`.

| Grupo | Tokens principais | Uso |
|---|---|---|
| Fundos | `--gm-bg-main`, `--gm-bg-sidebar`, `--gm-bg-header` | Estrutura principal |
| Superfícies | `--gm-surface`, `--gm-surface-raised`, `--gm-surface-inset` | Cards, modais e áreas internas |
| Bordas | `--gm-border`, `--gm-border-strong` | Separação e foco estrutural |
| Texto | `--gm-text-primary`, `--gm-text-secondary`, `--gm-text-muted` | Hierarquia tipográfica |
| Semântica | `--gm-primary`, `--gm-success`, `--gm-warning`, `--gm-danger`, `--gm-info`, `--gm-purple`, `--gm-cyan` | Ação, condição e criticidade |
| Profundidade | `--gm-shadow-sm`, `--gm-shadow-md`, `--gm-icon-highlight`, `--gm-icon-shadow` | Elevação controlada |

O tema claro redefine os mesmos contratos sem inverter as cores de forma automática. A navegação permanece escura para conservar identidade e orientação espacial.

## Tipografia e espaçamento

- família principal: pilha local do sistema, sem fonte externa bloqueante;
- títulos: peso 700–800 e alto contraste;
- textos operacionais: 12–16 px conforme densidade;
- labels: caixa alta moderada e maior espaçamento entre letras;
- escala de espaçamento baseada em 4 px;
- raios consistentes entre 8 e 18 px;
- foco de teclado visível com anel ciano/azul.

## Componentes

### Navegação

- sidebar aberta próxima de 256 px;
- sidebar recolhida próxima de 72 px;
- drawer mobile com backdrop e fechamento dedicado;
- grupos expansíveis, favoritos, alertas críticos e estado operacional;
- `aria-current="page"` aplicado à tela ativa;
- tooltips e títulos preservados no modo recolhido.

### Cabeçalho

- breadcrumb e título contextual;
- busca global;
- planta/período, notificações, ajuda e tema;
- perfil com estado online;
- densidade reduzida no mobile.

### Cards e indicadores

- superfície elevada e borda metálica discreta;
- faixa semântica superior;
- ícone 3D em shell próprio;
- valor, contexto e estado vazio sem dados fictícios;
- hover somente em componentes interativos.

### Tabelas

- cabeçalho de alto contraste;
- linhas alternadas discretas;
- badges semânticos;
- rolagem interna quando necessária;
- ausência de overflow horizontal global.

### Formulários e modais

- inputs, selects e textareas com estados coerentes;
- mensagens e obrigatoriedade preservadas;
- cabeçalho e rodapé do modal destacados;
- conteúdo rolável e ações acessíveis no mobile;
- ação destrutiva diferenciada por cor, texto e ícone.

### Estados

- sucesso: verde;
- informação e ação principal: azul;
- medição e tecnologia: ciano;
- atenção: âmbar;
- pendência: laranja;
- criticidade e exclusão: vermelho;
- análise especializada: roxo;
- controles administrativos: aço.

## Ícones 3D

O registro central fica em `assets/ui/icon-registry.js`. Os desenhos são SVGs locais, reutilizáveis e renderizados sob demanda. A aparência tridimensional é produzida pelo shell CSS com gradiente, contorno, brilho superior, sombra interna e sombra inferior discreta.

Regras:

- ícones decorativos recebem `aria-hidden="true"`;
- controles somente com ícone recebem `aria-label` e `title`;
- o conceito usa o mesmo nome de ícone em todas as telas;
- tons são atribuídos pelo `professionalToneMap`;
- uma única observação de DOM atualiza conteúdo dinâmico;
- `prefers-reduced-motion` desativa movimentos não essenciais.

## Responsividade

Breakpoints e resoluções validados:

- 360 × 800;
- 390 × 844;
- 768 × 1024;
- 1024 × 768;
- 1280 × 720;
- 1366 × 768;
- 1440 × 900;
- 1920 × 1080.

No mobile, o dashboard apresenta prioridades e ações rápidas, a navegação vira drawer e os formulários mantêm rodapé de ações acessível. Tabelas podem rolar internamente, sem ampliar a página.

## Acessibilidade

- textos essenciais nunca dependem somente de ícones;
- cor nunca é o único indicador de estado;
- foco de teclado visível;
- labels e nomes acessíveis preservados;
- `aria-expanded`, `aria-current`, diálogos e mensagens ao vivo mantidos;
- contraste dos temas escuro e claro conferido visualmente;
- suporte a redução de movimento.

## Performance

- nenhuma biblioteca pesada de ícones;
- nenhum asset remoto obrigatório;
- nenhuma imagem Base64 no HTML;
- registro vetorial compartilhado em uma única requisição;
- raster apenas para marca e favicons;
- assets essenciais totais: 196.729 bytes (aproximadamente 192,1 KiB).
