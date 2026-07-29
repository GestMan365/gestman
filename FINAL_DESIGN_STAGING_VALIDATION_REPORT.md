# GestMan365 — Homologação final do design no Staging

Data: 2026-07-29
Branch: `design/ui-ux-v1`
Commit de origem: `ed2268f`
Ambiente: GestMan365 Staging

## Resultado executivo

O redesign final foi homologado contra o Supabase Staging, confirmado como
projeto diferente da produção. O frontend temporário recebeu somente a URL e a
chave publishable do Staging; a `service_role` permaneceu restrita aos helpers
Node de preparação, validação e limpeza.

Resultado final:

- Playwright oficial: 22 aprovados, 0 reprovados, 0 ignorados;
- bootstrap: 10 aprovados, 0 reprovados;
- RLS, RPC, Storage, onboarding e isolamento: 56 aprovados, 0 reprovados;
- dados e arquivos `QA-DESIGN-FINAL-`: zero resíduos;
- produção: não acessada nem alterada;
- deploy público: não realizado.

## Confirmação do ambiente

- Projeto vinculado: GestMan365 Staging.
- Projeto de produção identificado separadamente como GestMan365 CMMS.
- Project refs diferentes: confirmado sem registrar os valores.
- Vínculo local com produção: não.
- Staging saudável: confirmado.
- URL, project ref, chaves e tokens privados: não registrados neste relatório.
- Chave `service_role` no navegador: não.

## Arquivos alterados nesta fase

- `tests/e2e-official/support/staging-api.mjs`;
- `tests/e2e-official/global-teardown.mjs`;
- `tests/e2e-official/02-auth.spec.ts`;
- `tests/e2e-official/03-public-request.spec.ts`;
- `tests/e2e-official/06-users-isolation.spec.ts`;
- `scripts/validate-staging-bootstrap.mjs`;
- `scripts/validate-staging-security.mjs`;
- `FINAL_DESIGN_STAGING_VALIDATION_REPORT.md`.

`index.html`, `404.html`, migrations, RLS, RPCs, Storage e Edge Functions não
foram alterados nesta fase.

## Dados QA

Todos os helpers de homologação foram ajustados para usar exclusivamente:

`QA-DESIGN-FINAL-`

Os slugs e e-mails técnicos também usam a variante normalizada
`qa-design-final-`. A limpeza remove somente registros identificados por esses
marcadores.

## Bootstrap

Comando:

`node scripts/validate-staging-bootstrap.mjs`

Resultado:

- 10 aprovados;
- 0 reprovados;
- autenticação QA;
- sessão QA;
- bloqueio anônimo;
- rejeição de campos administrativos;
- rejeição de payload excessivo;
- bootstrap válido;
- resposta sem identificadores internos;
- idempotência;
- uma empresa;
- um membership.

## Segurança, RLS, RPC, Storage e onboarding

Comando:

`node scripts/validate-staging-security.mjs`

Resultado:

- 56 aprovados;
- 0 reprovados.

Cobertura confirmada:

- isolamento entre empresas;
- usuário inativo;
- membership removido;
- perfil global desativado;
- RPC de contexto e estado;
- conflito e versionamento do estado;
- bloqueio do bootstrap legado no navegador;
- Storage privado e isolado por empresa;
- traversal bloqueado;
- URL assinada cross-tenant bloqueada;
- onboarding válido, inválido, duplicado e rate limited;
- aprovação e conversão administrativas;
- ausência de senha textual;
- limpeza do banco QA.

## Playwright oficial

Comando:

`npm run test:e2e:official`

Resultado final:

- 22 aprovados;
- 0 reprovados;
- 0 ignorados;
- 0 falhas esperadas;
- 0 falhas inesperadas;
- duração aproximada: 3,1 minutos;
- limpeza automática confirmada.

### Ajustes legítimos nos testes

A primeira execução encontrou duas incompatibilidades dos testes com a
interface redesenhada:

1. o teste de usuários tentava operar uma linha dentro da aba oculta padrão
   “Empresa e perfil”; ele agora abre explicitamente “Usuários e acessos”;
2. o teste ainda esperava o rótulo antigo “Inativo”; ele agora valida a
   mensagem mais precisa “Acesso removido desta empresa”.

O teste de autenticação também passou a confirmar explicitamente que a sessão
foi gravada antes de recarregar a página. Uma repetição isolada e a suíte
completa confirmaram a persistência.

Nenhuma regra de negócio ou implementação do frontend precisou ser corrigida.
Nenhum teste foi removido ou enfraquecido.

## Módulos validados

- login, sessão, recarga e logout;
- onboarding e rate limit;
- Dashboard;
- Ativos e Equipamentos;
- Ordens de Serviço;
- Estoque e materiais;
- movimentações;
- Preventivas;
- Calendário e Programação;
- Checklists;
- Medições;
- Usuários e acessos;
- perfil global;
- Configurações;
- anexos e Storage;
- áreas operacionais;
- setores e locais;
- estrutura de instalação;
- Equipes e Recursos;
- relatórios;
- administração da plataforma;
- estados vazios, loading, erro e confirmações.

## Tema e navegação

- tema escuro: aprovado;
- tema claro: aprovado;
- persistência do tema após recarga: aprovada nos dois temas;
- sidebar aberta: aprovada;
- sidebar recolhida: aprovada;
- persistência da sidebar após recarga: aprovada;
- conteúdo expandido com sidebar recolhida: aprovado;
- drawer mobile: abriu e fechou corretamente;
- largura do drawer em 390 px: 310 px;
- tooltips/títulos disponíveis na navegação recolhida: 68 elementos;
- Escape fechou o modal;
- foco retornou ao botão que abriu o modal;
- regras `:focus-visible` presentes.

## Responsividade

As oito resoluções foram verificadas nos temas claro e escuro:

| Resolução | Tema escuro | Tema claro | Overflow global |
|---|---|---|---|
| 360 × 800 | aprovado | aprovado | não |
| 390 × 844 | aprovado | aprovado | não |
| 768 × 1024 | aprovado | aprovado | não |
| 1024 × 768 | aprovado | aprovado | não |
| 1280 × 720 | aprovado | aprovado | não |
| 1366 × 768 | aprovado | aprovado | não |
| 1440 × 900 | aprovado | aprovado | não |
| 1920 × 1080 | aprovado | aprovado | não |

Em 390 × 844:

- `window.innerWidth`: 390;
- `document.documentElement.scrollWidth`: 379;
- modal: 379 × 844, contido na viewport;
- formulário de Ativos: limites horizontais de 8 a 371 px;
- botões Cancelar e Salvar Ativo: visíveis e acessíveis;
- tabelas são substituídas ou adaptadas pela apresentação mobile quando
  aplicável.

## Console e rede

- `console.error` inesperado: zero;
- `console.warn` inesperado: zero;
- `pageerror`: zero;
- request failure inesperada: zero;
- resposta 4xx/5xx inesperada: zero;
- chamada para produção: zero;
- chamada antiga de bootstrap pelo navegador: zero;
- exposição de token ou identificador interno na interface: zero.

Respostas negativas esperadas foram verificadas para login inválido, rate
limit, isolamento cross-tenant, acesso anônimo, usuário inativo, traversal e
duplicidade.

## Sincronização de `index.html` e `404.html`

Comando:

`node scripts/validate-index-404-sync.mjs`

Resultado:

- sincronizados: sim;
- SHA-256 normalizado:
  `990997bb6ae8338c5bf9044a0815ad2bbc5bee8af56245310104d2f3f6ddfbf7`;
- IDs duplicados no HTML estático: zero;
- blocos JavaScript válidos: 7 em cada arquivo;
- rota principal: aprovada;
- fallback: aprovado;
- onboarding principal e fallback: aprovados;
- divergência funcional: nenhuma.

## Validações locais

- `npm ci`: aprovado após encerrar a prévia local anterior que mantinha o
  binário do Rollup bloqueado;
- TypeScript: aprovado, 0 erros;
- build Vite: aprovado, 8 módulos transformados;
- artefato HTML: aproximadamente 6,30 MB, 3,27 MB gzip;
- segurança estática: aprovada;
- auditoria de segredos: aprovada;
- IDs duplicados no DOM inicial: zero;
- labels órfãos no DOM inicial: zero;
- funções/listeners legados repetidos: dívida técnica preexistente, sem nova
  ocorrência criada nesta fase;
- `git diff --check`: aprovado.

## Limpeza final

A limpeza automática e uma auditoria adicional confirmaram zero ocorrências de
`QA-DESIGN-FINAL-` em:

- empresas;
- solicitações;
- usuários Auth;
- perfis;
- memberships;
- preferências;
- estado empresarial;
- ativos;
- equipamentos;
- Ordens de Serviço;
- peças;
- movimentações;
- preventivas;
- checklists;
- medições;
- requisições;
- transferências;
- auditoria;
- objetos de Storage.

Nenhum registro sem o prefixo autorizado foi removido.

## Bugs encontrados e corrigidos

- Bugs funcionais confirmados na aplicação: nenhum.
- Regressões de teste encontradas: duas.
- Regressões de teste corrigidas: duas.
- Correções de frontend: nenhuma.
- Correções de backend: nenhuma.

## Riscos restantes

- O monólito e o bundle HTML continuam grandes.
- Existem funções e listeners legados repetidos, já documentados nas fases
  anteriores.
- O `npm audit` continua registrando quatro vulnerabilidades conhecidas em
  dependências de build/desenvolvimento; elas não integram o runtime do
  monólito publicado e exigem atualização principal separada.
- A homologação visual automatizada não substitui auditoria WCAG completa com
  leitor de tela.

## Recomendação

O design está apto para uma prévia online não produtiva apontando somente para
o Staging. A promoção ao site oficial deve permanecer separada, revisada e
explicitamente autorizada.

Produção alterada: **Não**

Staging alterado: **somente dados QA temporários, integralmente removidos**

Backend alterado: **Não**

Push realizado: **Não**

Merge realizado: **Não**

Deploy público realizado: **Não**
