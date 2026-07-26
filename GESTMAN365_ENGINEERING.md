# GestMan365 — Guia de Engenharia

## Arquitetura

O GestMan365 usa React 18, TypeScript, Vite, React Router e Supabase. A aplicacao e organizada em camadas:

- `pages`: composicao das telas e fluxos de usuario;
- `components`: componentes compartilhados, layout e protecao de interface;
- `contexts` e `hooks`: estado de autenticacao, empresa ativa e autorizacao;
- `services`: integracao com autenticacao, Supabase e dados multiempresa;
- `types`: contratos TypeScript do dominio;
- `utils`: funcoes puras de navegacao e permissoes;
- `tests`: testes end-to-end Playwright.

Rotas privadas passam por `ProtectedRoute`. O `AppShell` concentra barra superior, menu e conteudo. A regra de acesso nao deve existir somente na interface: operacoes persistentes precisam ser protegidas tambem por RLS e politicas do banco.

## Padroes de codigo

- TypeScript em modo `strict` e sem `any` implicito.
- Componentes funcionais, pequenos e orientados a responsabilidade unica.
- Regras de integracao ficam em `services`, nao nas paginas.
- Tipos de dominio ficam em `src/types`.
- Mensagens de erro exibidas ao usuario nao revelam detalhes internos.
- Seletores de teste priorizam papel, rotulo e texto acessivel; `data-testid` e excecao.
- Nomes de arquivos de componentes e paginas usam PascalCase; utilitarios e servicos usam camelCase.

## Seguranca

- Nunca versionar `.env`, tokens, senhas, chaves privadas ou `service_role`.
- O frontend aceita somente a chave publica/publishable do Supabase.
- Credenciais nunca devem ser registradas em console, telemetria ou relatorios de teste.
- O modo demo e exclusivo para desenvolvimento e precisa ser ativado explicitamente.
- O modo padrao e `supabase`.
- Dados de sessao local sao tratados como cache de interface, nunca como autoridade em producao.
- JSON invalido ou legado no `localStorage` e descartado com seguranca.
- Usuario inativo tem a sessao rejeitada.

## Autenticacao por ambiente

### Modo demo

Ativado somente por `VITE_AUTH_MODE=demo`. Aceita a conta de demonstracao definida pelo produto, persiste uma sessao local controlada, suporta recarga e logout e nao realiza chamadas ao Supabase. Deve ser usado apenas localmente e em testes automatizados.

### Modo Supabase

Ativado por `VITE_AUTH_MODE=supabase` ou pela ausencia da variavel. Usa `signInWithPassword`, recupera a sessao real com `auth.getUser` e mapeia nome, perfil, empresa, avatar e situacao a partir dos metadados. Quando URL ou chave publica nao estiverem configuradas, o login informa a indisponibilidade sem expor configuracao.

## Multiempresa

- Todo registro operacional deve possuir identificador de empresa.
- O usuario autenticado deve ter `empresaId` valido antes de acessar dados operacionais.
- Consultas devem filtrar a empresa ativa e as politicas RLS devem repetir essa restricao no banco.
- Trocas de empresa exigem nova validacao de permissao.
- Dados de demonstracao nao podem ser usados como fallback no modo Supabase.

## Supabase

- Supabase Auth e a autoridade de identidade no modo de producao.
- Tabelas devem usar RLS habilitado e politicas por empresa/perfil.
- Alteracoes de esquema devem ser versionadas por migrations.
- Funcoes privilegiadas devem executar no servidor/Edge Function, nunca no navegador.
- Falhas de rede e configuracao devem produzir estado vazio ou erro controlado, nunca dados ficticios.

## Testes

### Estoque e materiais

A suíte `tests/inventory/inventory.spec.ts` cobre 56 cenários E2E com dados identificados por `QA-AUTO-EST` e `QA-AUTO-FERR`. No modo demo, o estado é isolado por empresa em `sessionStorage`. A futura persistência Supabase deve manter as mesmas invariantes em transação, aplicar RLS por empresa e garantir idempotência por chave única.

- Playwright executa inicialmente no Chromium, com um worker para fluxos que alteram estado.
- Captura de tela e video sao preservados em falha; trace e coletado na primeira repeticao.
- O servidor de teste e compilado com modo demo explicito.
- A suite de autenticacao cobre login valido, rejeicao, persistencia, logout, rota protegida e cache corrompido.
- Novos fluxos devem cobrir caminho feliz, validacao, permissao e recuperacao de erro.

## Git e revisao

- Commits pequenos, descritivos e sem arquivos gerados ou segredos.
- Pull requests devem explicar impacto, testes e risco de migracao.
- Nunca reescrever alteracoes de terceiros sem revisao.
- `dist`, relatorios Playwright, resultados e `.env` nao sao artefatos de codigo-fonte.

## CI/CD

Pipeline minimo:

1. instalar dependencias com `npm ci`;
2. executar `npm run build`;
3. executar `npm run test:e2e` em ambiente isolado;
4. armazenar relatorio, screenshots, videos e traces em caso de falha;
5. publicar somente quando todas as verificacoes obrigatorias passarem.

Ambientes de homologacao e producao devem usar `VITE_AUTH_MODE=supabase` e configuracoes distintas.

## Definicao de pronto

Uma tarefa so esta pronta quando:

- comportamento e regras de acesso foram implementados;
- mensagens de erro e estados de carregamento foram tratados;
- nao existem segredos ou logs sensiveis;
- build TypeScript/Vite passa;
- testes relevantes passam;
- responsividade e acessibilidade foram verificadas;
- documentacao foi atualizada quando necessario.

**Regra obrigatoria:** antes de concluir qualquer tarefa, executar no minimo `npm run build` e os testes relacionados. Para a validacao completa, executar `npm run qa`.
