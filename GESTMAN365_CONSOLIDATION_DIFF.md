# GestMan365 — Auditoria de consolidacao

Data: 21/07/2026.

## Escopo e diretorios

- Original: `C:\Users\andsa\Desktop\GestMan365-Claude`.
- Intermediaria, somente auditada: `C:\Users\andsa\Documents\Codex\GestMan365-Claude`.
- Validada e fonte da promocao: `C:\Users\andsa\Documents\Codex\2026-07-10\apa\GestMan365-Claude`.

Os inventarios por caminho, tamanho e SHA-256 foram gravados em `consolidation/`. Arquivos efemeros foram contabilizados, mas excluidos dos inventarios de promocao: `node_modules`, `dist`, relatorios/resultados Playwright, caches, traces, videos e arquivos temporarios.

| Copia | Arquivos totais | Inventariados | Excluidos como efemeros | Bytes inventariados |
|---|---:|---:|---:|---:|
| Original | 3.681 | 84 | 3.597 | 34.642.615 |
| Intermediaria | 3.441 | 84 | 3.357 | 34.650.257 |
| Validada | 3.454 | 92 | 3.362 | 30.514.994 |

## Diferencas por hash: original x validada

### Novos — documentacao e rastreabilidade

- `GESTMAN365_DELIVERY_REPORT.md`;
- `GESTMAN365_ENGINEERING.md`;
- `GESTMAN365_PRODUCT_SPEC.md`;
- `GESTMAN365_ROADMAP.md`;
- `GESTMAN365_CONSOLIDATION_DIFF.md`;
- `consolidation/inventory-original.tsv`;
- `consolidation/inventory-intermediaria.tsv`;
- `consolidation/inventory-validada.tsv`;
- `PROMOVER-GESTMAN365.ps1`.

### Novos — configuracao/ferramentas

- `scripts/vite-build.mjs`;
- `scripts/vite-config.mjs`;
- `scripts/vite-dev.mjs`;
- `scripts/vite-preview.mjs`.

### Novo — teste

- `tests/global-setup.ts`.

### Modificados — nova funcionalidade e correcoes

- `src/services/authService.ts`: modos demo/Supabase, sessao segura, mapeamento de perfil/empresa e erros controlados;
- `src/services/supabaseClient.ts`: modo padrao Supabase e validacao de configuracao;
- `src/services/tenantService.ts`: remove fallback demo em producao;
- `src/contexts/AuthContext.tsx`: recuperacao segura de falha de sessao;
- `src/pages/LoginPage.tsx`: formulario sem credenciais preenchidas, acessibilidade e mensagens controladas;
- `src/types/auth.ts` e `src/vite-env.d.ts`: contratos de erro e ambiente.

### Modificados — testes e configuracao

- `tests/auth/login.spec.ts`;
- `playwright.config.ts`;
- `package.json`;
- `.env.example`;
- `.gitignore`.

`package-lock.json` e `vite.config.ts` possuem o mesmo conteudo do original, mas fazem parte da lista de promocao para garantir uma configuracao reproduzivel.

### Exclusivos do original — preservar

- `gestman365-areas-operacionais.zip`;
- `gestman365-equipes-recursos.zip`;
- `gestman365-equipes-recursos-fix.zip`.

Esses arquivos nao serao removidos ou substituidos. O `.env`, `backup-legado`, referencias, arquivos locais e quaisquer arquivos nao listados para promocao tambem serao preservados.

## Classificacao das diferencas

| Classe | Conteudo |
|---|---|
| Nova funcionalidade | autenticacao por ambiente e mapeamento multiempresa |
| Correcao | sessao corrompida, usuario inativo, fallback demo e mensagens de login |
| Teste | seis cenarios E2E e servidor global de teste |
| Configuracao | scripts npm, Playwright, ambiente de exemplo e exclusoes Git |
| Documentacao | engenharia, produto, roadmap, entrega, consolidacao e inventarios |
| Arquivo legado | dez arquivos legado/backup comparados sem diferencas |
| Arquivo temporario | `node_modules`, `dist`, relatorios, resultados, traces, videos e caches; ignorados |
| Risco potencial | projeto original divergente, modo Supabase sem E2E real e cobertura parcial dos modulos |

## Validacao dos lancadores Vite

Os comandos Vite padrao `vite`, `vite build` e `vite preview` falham no ambiente Codex antes de carregar a configuracao, pois o esbuild tenta ler um diretorio ancestral bloqueado. O comando TypeScript isolado passa.

Por isso, os lancadores programaticos foram mantidos. A verificacao confirmou:

- base URL identica: `/nadirteste/`;
- alias `@` apontando para o mesmo diretorio `src`;
- mesmo plugin React;
- 105 modulos transformados;
- bundle com 3 arquivos e hashes identicos em duas builds consecutivas;
- preview em `127.0.0.1:4173/nadirteste/`;
- Playwright com 6 de 6 testes aprovados.

O servidor `dev` programatico inicia a URL, mas a otimizacao de dependencias do Vite ainda encontra a mesma restricao do esbuild dentro do sandbox. Fora do sandbox, os scripts permanecem compativeis; no Codex, build, preview e QA sao os caminhos validados.

## Plano de promocao

### Adicionar

Documentacao nova, inventarios, lancadores Vite, `tests/global-setup.ts` e script de promocao/rollback.

### Atualizar

Arquivos modificados listados acima, codigo-fonte validado, configuracoes TypeScript/Vite, `package.json`, `package-lock.json`, `.env.example` e `.gitignore`.

### Preservar

`.env`, `.git`, backup legado, referencias, ZIPs auxiliares e qualquer arquivo exclusivo do original.

### Ignorar

`node_modules`, `dist`, caches, relatorios/resultados Playwright, traces, videos, screenshots de teste, ZIP de entrega e temporarios.

Nenhum arquivo do original sera excluido durante a promocao.

## Resultado da promocao

- Backup criado em `C:\Users\andsa\Desktop\GestMan365-Claude-backup-20260721`.
- 277 arquivos e 45.084.198 bytes protegidos antes da promocao.
- Manifesto do backup: 277 linhas, zero divergencias de hash.
- Total atual do backup: 279 arquivos, incluindo manifesto e estado de promocao.
- 63 arquivos promovidos por lista permitida.
- Verificacao fonte x projeto oficial: zero diferencas.
- `.env` oficial x backup: hash identico.
- Tres ZIPs auxiliares: preservados com hashes identicos.
- Backup legado: preservado com hashes identicos.
- Build no projeto oficial: aprovada, 105 modulos e 3 arquivos de bundle.
- Playwright no projeto oficial: 6 de 6 testes aprovados na execucao direta e novamente pelo `npm run qa`.
- Rollback disponivel por `PROMOVER-GESTMAN365.ps1 -Action Rollback`.

## Riscos restantes

- Dashboard, Ativos, Solicitacoes, Ordens de Servico, PCM, Relatorios e Administracao ainda nao possuem cobertura E2E completa.
- O modo Supabase precisa de E2E contra uma homologacao isolada.
- A copia intermediaria deve permanecer fora do fluxo oficial para evitar nova divergencia.
- O rollback depende da integridade do backup validado antes da promocao.
