# GestMan365 — auditoria de segurança de dependências

Data: 28/07/2026
Branch: `codex/github-current-20260722`
Commit inicial: `18031ed`
Runtime auditado: Node `24.16.0` e npm `11.13.0`

## Resumo executivo

O `npm audit` inicial registrou cinco pacotes vulneráveis: três de severidade moderada e dois de severidade alta.

Foi aplicada somente uma correção compatível:

- PostCSS transitivo: `8.5.15` → `8.5.24`;
- Nano ID transitivo: `3.3.14` → `3.3.16`, como dependência resolvida do PostCSS.

O resultado final é:

| Severidade | Antes | Depois |
|---|---:|---:|
| Alta | 2 | 1 |
| Moderada | 3 | 3 |
| Total | 5 | 4 |

As quatro ocorrências restantes exigem Vite 6.4.3+ ou React Router 7.18+, ambos fora da versão principal atual. Nenhuma atualização principal, `override`, `npm audit fix --force` ou remoção de pacote foi realizada.

## Alcance no produto

O build oficial atual produz somente `dist/index.html`. O `index.html` monolítico não referencia `src/main.tsx`, portanto React, React Router e seus módulos não entram no artefato publicado.

Vite, esbuild e PostCSS são ferramentas de desenvolvimento/build e não são enviados ao navegador no GitHub Pages. O risco de Vite/esbuild concentra-se em servidor de desenvolvimento exposto a conteúdo ou clientes não confiáveis. O script atual usa o bind local padrão do Vite e não configura exposição em rede.

Existe uma aplicação React paralela em `src/`, validada pelo TypeScript, mas ela não participa do bundle oficial atual. Ela usa `HashRouter`, rotas fixas e redirecionamento interno após login; não há SSR nem hidratação de erros no projeto.

## 1. esbuild

- Pacote: `esbuild`.
- Advisory: [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99).
- Severidade: moderada.
- Instalada: `0.21.5`.
- Faixa afetada: `<=0.24.2`.
- Primeira versão corrigida aplicável: `0.25.0`.
- Tipo: transitiva e de desenvolvimento.
- Cadeia: `devDependency vite@5.4.21 → esbuild@0.21.5`.
- Uso real: transformação e servidor de desenvolvimento do Vite.
- Bundle publicado: não incluído.
- Exploração no GestMan365: requer que um desenvolvedor execute e exponha o servidor vulnerável e visite conteúdo malicioso capaz de interagir com ele.
- Correção disponível: Vite 6.4.3 usa `esbuild ^0.25.0`.
- Decisão: não atualizado, pois Vite 5 → 6 é mudança principal e exige tarefa de migração/regressão própria.
- Risco residual: servidor de desenvolvimento; não expor Vite para redes não confiáveis.
- Classificação: **somente desenvolvimento; pendente por breaking change; não bloqueadora para o monólito estático publicado**.

## 2. PostCSS

- Pacote: `postcss`.
- Advisory: [GHSA-r28c-9q8g-f849](https://github.com/advisories/GHSA-r28c-9q8g-f849).
- Severidade inicial: alta.
- Instalada antes: `8.5.15`.
- Faixa afetada: `<=8.5.17`.
- Primeira versão corrigida: `8.5.18`.
- Instalada depois: `8.5.24`.
- Tipo: transitiva e de desenvolvimento.
- Cadeia: `devDependency vite@5.4.21 → postcss`.
- Uso real: processamento de CSS durante desenvolvimento/build.
- Bundle publicado: não incluído.
- Exploração no GestMan365: dependeria do processamento local de CSS/source map não confiável; os arquivos do projeto são controlados pelo repositório.
- Alteração realizada: atualização transitiva compatível no lockfile, sem adicionar dependência direta.
- Testes: `npm ci`, TypeScript, build e validações locais aprovados.
- Risco residual: nenhum para o advisory auditado.
- Classificação: **corrigida**.

## 3. react-router

- Pacote: `react-router`.
- Advisories:
  - [GHSA-wrjc-x8rr-h8h6](https://github.com/advisories/GHSA-wrjc-x8rr-h8h6), redirecionamento aberto por barra invertida;
  - [GHSA-337j-9hxr-rhxg](https://github.com/advisories/GHSA-337j-9hxr-rhxg), injeção de construtor na hidratação SSR.
- Severidade: moderada.
- Instalada: `6.30.4`.
- Faixa afetada agregada: versões anteriores a `7.18.0`.
- Primeira versão integralmente corrigida: `7.18.0`.
- Tipo: transitiva de uma dependência de produção.
- Cadeia: `dependency react-router-dom@6.30.4 → react-router@6.30.4`.
- Uso real: aplicação React paralela em `src/`.
- Bundle oficial publicado: não incluído.
- Exploração no GestMan365: o advisory SSR não se aplica à SPA atual, que não usa SSR ou hidratação de erros. O advisory de redirecionamento permanece relevante se a aplicação React for publicada futuramente e aceitar destino controlado externamente.
- Decisão: não atualizado; React Router 6 → 7 é mudança principal.
- Risco residual: aplicação React paralela não deve ser publicada antes de migração e testes específicos de rotas/autenticação.
- Classificação: **não explorável no build publicado; pendente por breaking change; bloqueadora apenas para futura publicação da aplicação React**.

## 4. react-router-dom

- Pacote: `react-router-dom`.
- Advisory: [GHSA-jjmj-jmhj-qwj2](https://github.com/advisories/GHSA-jjmj-jmhj-qwj2), redirecionamento aberto com possibilidade de XSS.
- Severidade: moderada.
- Instalada: `6.30.4`.
- Faixa direta afetada: `6.30.2` até `6.30.4`.
- Versão que elimina toda a cadeia auditada: `7.18.0`.
- Tipo: dependência direta de produção.
- Cadeia: `gestman365 → react-router-dom@6.30.4 → react-router@6.30.4`.
- Uso real: `HashRouter`, `Navigate`, `NavLink`, `Outlet` e `useLocation` na aplicação React paralela.
- Bundle oficial publicado: não incluído.
- Exploração no GestMan365: o código atual navega por rotas internas fixas e usa `location.state.from` criado pelo próprio `ProtectedRoute`; não foi encontrada entrada direta de URL externa. O risco aumenta se esse fluxo for ampliado ou publicado.
- Decisão: não atualizado; a migração 6 → 7 exige revisão de API e regressão das rotas.
- Risco residual: contido enquanto a aplicação React não for publicada.
- Classificação: **não explorável no build publicado; pendente por breaking change; bloqueadora apenas para futura publicação da aplicação React**.

## 5. Vite

- Pacote: `vite`.
- Advisories:
  - [GHSA-4w7w-66w2-5vf9](https://github.com/advisories/GHSA-4w7w-66w2-5vf9), traversal em source maps de dependências otimizadas;
  - [GHSA-v6wh-96g9-6wx3](https://github.com/advisories/GHSA-v6wh-96g9-6wx3), exposição de hash NTLMv2 em caminhos UNC no Windows;
  - [GHSA-fx2h-pf6j-xcff](https://github.com/advisories/GHSA-fx2h-pf6j-xcff), bypass de `server.fs.deny` no Windows.
- Severidade agregada: alta.
- Instalada: `5.4.21`.
- Faixa afetada agregada: `<=6.4.2`.
- Primeira versão que corrige a cadeia listada: `6.4.3`.
- Tipo: devDependency direta.
- Cadeia: `gestman365 → vite@5.4.21 → esbuild@0.21.5/postcss@8.5.24`.
- Uso real: build e servidor local.
- Bundle publicado: não incluído.
- Exploração no GestMan365: exige servidor Vite acessível a origem/cliente não confiável ou manipulação de caminhos no ambiente de desenvolvimento. O servidor não é usado em produção.
- Decisão: não atualizado; Vite 5 → 6 é mudança principal. O plugin React instalado aceita Vite 6, mas o upgrade ainda requer build, preview, Windows e regressão E2E próprios.
- Risco residual: não expor `npm run dev` além de localhost.
- Classificação: **somente desenvolvimento; pendente por breaking change; não bloqueadora para o monólito estático publicado**.

## Validação Deno

Foi usada instalação isolada do Deno `2.9.4` via `npx`, sem adicioná-lo ao projeto.

- `deno check`: aprovado após tornar obrigatórios no tipo normalizado os campos que a função sempre produz; nenhuma alteração de runtime.
- `deno lint`: aprovado com exclusão documentada de `no-import-prefix`, pois a Edge Function usa o import HTTPS padrão já implantado no Supabase.
- `deno fmt --check`: aponta formatação preexistente. O arquivo não foi reformatado para evitar diff amplo e alteração cosmética fora do objetivo.
- Nenhum `deno.lock` foi mantido no repositório.

## Regressão local

- `npm ci`: aprovado.
- `npm audit`: 4 achados, sendo 3 moderados e 1 alto.
- TypeScript da aplicação: aprovado.
- TypeScript da configuração/testes: aprovado.
- Build Vite: aprovado, 3 módulos transformados.
- Artefato: aproximadamente `6,18 MB`, `3,26 MB` gzip.
- Onboarding e JavaScript inline: 91 checks aprovados.
- Playwright local, com toda chamada Supabase bloqueada:
  - login renderizado;
  - onboarding renderizado;
  - resposta `429` simulada e mensagem correta;
  - `orderDueState` validado nos sete estados;
  - blocos de `index.html` e `404.html` sincronizados;
  - nenhum ID duplicado ou label órfão;
  - viewport de 390 px sem overflow global.
- A suíte oficial foi listada com 22 testes, mas não executada porque depende do Supabase Staging, proibido nesta tarefa.
- Produção e Staging não receberam chamadas ou alterações.

## Recomendação de release

Do ponto de vista destas dependências, as quatro ocorrências restantes **não bloqueiam a publicação do monólito estático atual**, porque não integram seu bundle. A liberação deve exigir que:

1. o servidor Vite não seja exposto a rede não confiável;
2. a aplicação React paralela permaneça fora da publicação;
3. Vite 6.4.3+ e React Router 7.18+ sejam tratados em branches separadas antes de publicar a aplicação React ou usar Vite em ambiente compartilhado.

Produção alterada: **Não**
Staging alterado: **Não**
Push realizado: **Não**
Deploy realizado: **Não**
