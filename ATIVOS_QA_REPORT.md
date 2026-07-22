# GestMan365 — Relatório de QA do Módulo Ativos

**Data:** 21/07/2026  
**Projeto oficial:** `C:\Users\andsa\Desktop\GestMan365-Claude`  
**Ambiente validado:** local, modo demo, Chromium, um worker  
**Supabase remoto alterado:** Não  
**Deploy realizado:** Não

## Resumo executivo

O módulo Ativos, que antes era apenas uma página de preparação, recebeu uma fundação local funcional e testável para o modo demo. Foram implementados modelo de domínio, dados determinísticos `QA-AUTO-ATIVO`, listagem, busca, filtros, cadastro, validação, edição, detalhes, inativação, feedback, estados de carregamento/vazio/erro, permissões e responsividade.

Nenhuma tabela ou migração Supabase foi criada ou presumida. Em modo Supabase sem contrato de Ativos, o serviço apresenta erro claro e não realiza consulta nem mutação remota. A implementação demo usa `sessionStorage`, isolado por empresa e limitado à sessão do navegador; não representa persistência de produção.

## Resultado final obrigatório

| Item | Resultado |
|---|---|
| Build | Aprovada |
| Testes anteriores | 18/18 aprovados |
| Novos testes de Ativos | 21/21 aprovados |
| Total de testes | 39 |
| Aprovados | 39 |
| Reprovados | 0 |
| Ignorados | 0 |
| Bugs críticos | 0 |
| Bugs altos | 0 confirmados; 3 riscos arquiteturais altos pendentes |
| Bugs médios | 0 confirmados; 5 lacunas funcionais médias pendentes |
| Bugs baixos | 1 defeito de automação encontrado e corrigido |
| Regressões | 0 |
| Supabase remoto alterado | Não |
| Deploy realizado | Não |
| Commit criado | Será registrado localmente após este relatório, sem push |
| ZIP criado | Será gerado após o commit |
| SHA-256 criado | Será gerado junto do ZIP |

## Arquivos analisados

- `src/pages/AssetsPage.tsx`
- `src/components/common/PageHeader.tsx`
- `src/components/common/ModuleCard.tsx`
- `src/components/layout/AppShell.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/components/layout/Topbar.tsx`
- `src/components/security/PermissionGate.tsx`
- `src/components/security/ProtectedRoute.tsx`
- `src/contexts/AuthContext.tsx`
- `src/contexts/TenantContext.tsx`
- `src/hooks/useAuth.ts`
- `src/hooks/usePermission.ts`
- `src/hooks/useTenant.ts`
- `src/services/authService.ts`
- `src/services/supabaseClient.ts`
- `src/services/tenantService.ts`
- `src/types/auth.ts`
- `src/types/domain.ts`
- `src/types/permissions.ts`
- `src/types/tenant.ts`
- `src/utils/permissions.ts`
- `src/styles/global.css`
- `tests/auth/login.spec.ts`
- `tests/dashboard/dashboard.spec.ts`
- `playwright.config.ts`
- `package.json`

## Arquivos criados

- `src/types/assets.ts`
- `src/services/assetService.ts`
- `src/components/assets/AssetFormDialog.tsx`
- `src/components/assets/AssetDetailsDialog.tsx`
- `tests/assets/assets.spec.ts`
- `ATIVOS_TEST_PLAN.md`
- `ATIVOS_QA_REPORT.md`

## Arquivos modificados

- `src/pages/AssetsPage.tsx`
- `src/styles/global.css`

## Modelo de domínio implementado localmente

| Grupo | Campos |
|---|---|
| Identidade | `id`, `empresaId`, `tag`, `name` |
| Estrutura física | `plantaId`, `setorId`, `localId`, `parentAssetId` |
| Dados técnicos | `description`, `category`, `manufacturer`, `model`, `serialNumber`, `manufactureYear`, `installationDate` |
| Operação | `status`, `criticality`, `responsible`, `isActive` |
| Gestão | `costCenter`, `notes` |
| Auditoria básica | `createdAt`, `updatedAt` |

### Regras locais aplicadas

- TAG obrigatória.
- Nome obrigatório.
- TAG normalizada para maiúsculas.
- Duplicidade rejeitada sem diferenciar maiúsculas/minúsculas.
- Unicidade verificada dentro da empresa ativa.
- Textos limitados no formulário.
- Ativo inativado permanece cadastrado.
- Não existe exclusão física na interface.
- Alterações locais verificam `empresaId`.
- Dados QA têm prefixo identificável.
- Limpeza remove somente TAGs iniciadas por `QA-AUTO-ATIVO`.

## Estratégia determinística de dados demo

Seeds criados uma vez por sessão e empresa:

1. `QA-AUTO-ATIVO-MOT-001` — Motor Elétrico da Esteira 01 — Produção.
2. `QA-AUTO-ATIVO-BOM-001` — Bomba Centrífuga de Processo 01 — Envase.
3. `QA-AUTO-ATIVO-CMP-001` — Compressor de Ar 01 — Utilidades.

O marcador de versão impede duplicação após recarregar. A limpeza grava uma lista sem os registros QA, impedindo que os seeds reapareçam na mesma sessão. Um novo contexto de navegador recebe novamente uma massa limpa e determinística.

## Funcionalidades implementadas e validadas

- Acesso protegido e integração com autenticação.
- Empresa ativa obtida do `TenantContext`.
- Listagem ordenada por TAG.
- Busca por TAG, nome, categoria e localização.
- Filtro por status, criticidade e setor.
- Limpeza conjunta dos filtros.
- Estado de carregamento.
- Estado vazio.
- Mensagem de erro.
- Cadastro com campos obrigatórios.
- Rejeição de TAG duplicada.
- Edição de nome, status, criticidade e campos técnicos.
- Persistência após reload dentro da sessão demo.
- Visualização de detalhes.
- Inativação sem exclusão física.
- Feedback após criar, editar, inativar e limpar QA.
- Layout de tabela no desktop e linhas em cards no mobile.
- Uso básico por teclado.

## Permissões analisadas

As regras vêm de `ROLE_PERMISSIONS`; nenhuma permissão nova foi inventada.

| Perfil | Consultar | Cadastrar | Editar | Inativar | Excluir produção | Limpar QA demo |
|---|---|---|---|---|---|---|
| Administrador | Sim | Sim | Sim | Sim, via `ativos:edit` | Não disponível | Sim, via `ativos:delete` |
| Supervisor | Sim | Sim | Sim | Sim, via `ativos:edit` | Não disponível | Não |
| Planejador | Sim | Não | Não | Não | Não | Não |
| Técnico | Sim | Não | Não | Não | Não | Não |
| Solicitante | Sim | Não | Não | Não | Não | Não |

Administrador, Supervisor e Técnico foram validados automaticamente nos pontos mais críticos. Planejador e Solicitante foram auditados pela matriz de permissões e permanecem como cenários E2E futuros.

## Testes adicionados

Foram adicionados 21 testes E2E cobrindo:

- autenticação e proteção de rota;
- estrutura e massa determinística;
- estado vazio;
- busca por TAG e nome;
- filtros de status, criticidade e setor;
- criação válida e feedback;
- obrigatoriedade de TAG e nome;
- TAG duplicada;
- edição e persistência no reload;
- detalhes técnicos;
- inativação sem exclusão;
- ausência de exclusão física;
- Técnico somente leitura;
- Supervisor com cadastro/edição e sem limpeza QA;
- console e rede;
- teclado;
- desktop, tablet e celular;
- limpeza exclusiva de dados QA, preservando ativo sem prefixo.

## Histórico da execução

Na primeira execução dos novos testes, 14 passaram e 7 falharam por um problema de automação: nesta versão do Playwright, alguns `getByLabel` exatos e escopados ao diálogo não resolveram os controles, embora a árvore acessível estivesse correta. Os seletores foram substituídos por `getByRole` com nome acessível. A interface e as regras não precisaram ser alteradas.

Depois da correção:

- Ativos isolado: 21/21 aprovados.
- Regressão completa: 39/39 aprovados.
- `npm run qa`: build aprovada e 39/39 aprovados.
- Falhas finais: zero.
- Testes ignorados: zero.

## Auditoria de UX

### Crítica

Nenhum problema crítico reproduzido na fundação local.

### Alta

1. **Backend Supabase de Ativos ainda indefinido:** esquema, RLS, índices e contratos não podem ser homologados.
2. **Rastreabilidade ainda incompleta:** não existe histórico imutável de alterações ou vínculo com usuário executor.
3. **Integridade referencial ainda não comprovada:** planta, setor, local, responsável e ativo pai são referências textuais/opcionais no demo.

### Média

1. Não há paginação ou ordenação selecionável para grandes parques industriais.
2. Não há documentos, fotos, QR Code ou histórico de manutenção.
3. Não há cadastro hierárquico pai/filho na interface.
4. O diálogo ainda não possui armadilha de foco completa nem fechamento por Escape implementado explicitamente.
5. A inativação possui feedback, mas uma confirmação dedicada pode ser necessária após definição da regra de negócio.

### Baixa

1. Ações da tabela usam botões textuais; iconografia final pode melhorar a leitura rápida.
2. Setores demo são fixos no formulário, adequados à massa QA, mas não representam cadastros reais.

### Melhorias objetivas corrigidas

- Título, filtros, tabela e diálogos receberam estrutura semântica.
- Campos têm nomes acessíveis, limites e indicação de obrigatoriedade.
- Ações apresentam feedback claro.
- Estado vazio e erro não simulam dados.
- O mobile não depende de rolagem horizontal da tabela.
- A criticidade é exibida por texto, sem depender apenas de cor.
- A exclusão física foi evitada.

## Lacunas do modelo e recomendações

Antes do modo Supabase, recomenda-se aprovar:

1. tabela `ativos` e nomes finais dos campos;
2. índice único composto por empresa e TAG normalizada;
3. chaves estrangeiras para empresa, planta, setor, local, responsável e ativo pai;
4. política RLS por vínculo ativo de usuário/empresa;
5. regra formal de inativação e bloqueio de exclusão quando houver O.S., planos ou histórico;
6. tabela de auditoria com autor, data, antes/depois e motivo;
7. storage privado para fotos/documentos, com políticas por empresa;
8. estratégia de QR Code sem expor identificadores sensíveis;
9. paginação e busca no servidor;
10. validação de datas, ano, número de série e relações cíclicas pai/filho.

## Cobertura ainda ausente

- Banco Supabase, RLS e concorrência real.
- Criação/edição offline ou sincronização.
- Paginação e ordenação de grandes volumes.
- Fotos, documentos, QR Code e histórico.
- Hierarquia pai/filho.
- Integração com O.S., PCM, estoque e indicadores.
- Auditoria do usuário que alterou o ativo.
- Perfis Planejador e Solicitante em E2E dedicado.
- Firefox e WebKit.
- Auditoria WCAG automatizada e leitor de tela real.

## Segurança

- Nenhuma chamada ao Supabase remoto foi efetuada pelos testes.
- Nenhuma migração foi criada ou executada.
- Nenhum dado de produção foi criado.
- Nenhum segredo deve fazer parte do diff ou do ZIP.
- A persistência demo usa somente `sessionStorage` com namespace por empresa.
- A limpeza QA preserva qualquer TAG sem o prefixo obrigatório.

## Comandos PowerShell executados

```powershell
npm run build
npx playwright test --list
npx playwright test tests/assets --project=chromium
npx playwright test --project=chromium
npm run qa
```

## Conclusão

A fundação local de Ativos está consistente para continuar o desenvolvimento do produto: build aprovada, 39/39 testes aprovados, zero regressões e nenhum acesso remoto. A implementação Supabase deve ser uma etapa separada, precedida pela aprovação do esquema, das regras de domínio e das políticas RLS descritas neste relatório.
