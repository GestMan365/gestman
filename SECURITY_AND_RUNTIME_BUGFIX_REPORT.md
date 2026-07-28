# GestMan365 — correções de segurança e runtime

Data: 28/07/2026
Branch: `codex/github-current-20260722`
Base: `60e3aa2`
Ambiente remoto usado: somente GestMan365 Staging

## Resultado executivo

As quatro falhas conhecidas foram corrigidas e revalidadas:

1. rate limit server-side do onboarding público;
2. canonicalização de caminhos do Storage;
3. separação entre acesso empresarial e ativação global do usuário;
4. erro `orderDueState is not defined`.

A suíte completa terminou com `22 aprovados`, `0 reprovados` e `0 ignorados`. As cinco falhas anteriormente marcadas como esperadas agora passam como testes normais.

## Implementação

### Onboarding e rate limit

- A Edge Function `submit-company-request` deriva o sinal de origem no servidor, calcula hash SHA-256 e usa o RPC atômico `gm_consume_public_rate_limit`.
- O limite é de seis tentativas por janela de uma hora.
- A verificação idempotente de CNPJ ocorre antes do consumo do limite.
- Falha no mecanismo resulta em `503`; limite excedido resulta em `429`, código `RATE_LIMITED` e identificador técnico não sensível.
- O frontend exibe mensagem orientativa e restaura o botão para nova tentativa.
- Durante a primeira homologação foi detectado sombreamento local do nome `requestId`; o identificador persistido foi renomeado para `insertedRequestId` antes da revalidação final.

### Storage

A migration `202607280001_storage_path_canonicalization.sql`:

- adiciona `gm_storage_path_is_canonical`;
- rejeita caminhos vazios, absolutos, com controles, barras invertidas, barras duplicadas, segmentos `.`/`..`, codificação perigosa e separadores Unicode equivalentes;
- valida UUID da empresa, módulo permitido, quantidade e tamanho dos segmentos;
- mantém o isolamento por empresa e recria as policies do bucket privado usando o helper canônico.

### Membership e perfil global

A migration `202607280002_membership_profile_separation.sql`:

- impede que a remoção de acesso empresarial altere `gm_profiles.active`;
- mantém memberships de outras empresas;
- cria operação global separada, restrita ao administrador da plataforma;
- registra auditorias distintas de membership e perfil global.

No frontend, os textos agora distinguem:

- “Remover acesso desta empresa”;
- “Restaurar acesso nesta empresa”;
- “Desativar usuário globalmente”, ação separada da administração da plataforma.

### Runtime de Ordens

Foi implementada `orderDueState`, com classificação determinística:

- `completed`;
- `no-date`;
- `invalid`;
- `overdue`;
- `due-today`;
- `due-soon`;
- `on-time`.

`orderIsLate` passou a reutilizar essa classificação sem remover o tratamento do status textual atrasado.

## Validações

| Validação | Resultado |
|---|---|
| Playwright oficial | 22 aprovados, 0 reprovados, 0 ignorados |
| Falhas anteriormente esperadas | 5 de 5 corrigidas |
| Bootstrap Staging | 10 aprovados, 0 falhas |
| RLS/RPC/Storage/onboarding Staging | 56 aprovados, 0 falhas |
| Onboarding e JavaScript inline | 91 aprovados |
| TypeScript frontend | aprovado |
| TypeScript dos testes | aprovado |
| Build Vite | aprovado; 3 módulos transformados |
| Responsividade | 360, 390, 768, 1366 e 1920 sem overflow global |
| Console e rede | nenhum erro inesperado |
| Auditoria exata de segredos do Staging | zero correspondências versionadas |
| `git diff --check` | aprovado |

O artefato Vite permaneceu grande: aproximadamente `6,18 MB`, ou `3,26 MB` gzip.

## Limpeza de QA

- Empresas: 0
- Solicitações: 0
- Perfis: 0
- Usuários Auth: 0
- Objetos de Storage: 0

Todos os dados `QA-E2E-STAGING-` e `QA-SECURITY` foram removidos. Dados não QA foram preservados.

## Dependências

Na auditoria específica de dependências, o PostCSS transitivo foi atualizado de `8.5.15` para `8.5.24`, removendo o achado alto correspondente sem mudança de versão principal. O `npm audit` passou a registrar quatro vulnerabilidades: três moderadas e uma alta, relacionadas a `esbuild`/Vite e React Router. As correções restantes exigem Vite 6.4.3+ e React Router 7.18+, mudanças de versão principal que devem ocorrer em tarefas separadas.

## Escopo e garantias

- Produção alterada: **Não**
- Staging alterado: **Sim, somente pelas duas migrations e pela Edge Function autorizadas**
- Frontend público implantado: **Não**
- Push realizado: **Não**
- Dados reais utilizados: **Não**
- Testes removidos ou enfraquecidos: **Não**
