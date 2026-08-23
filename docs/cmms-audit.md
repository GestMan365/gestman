# Auditoria técnica do GestMan365 CMMS

Data da auditoria: 2026-08-23
Base analisada: aplicação oficial monolítica (`index.html` e `404.html`) e backend Supabase presente no repositório.

## 1. Resumo executivo

O GestMan365 já é um MVP avançado, com cobertura funcional ampla, autenticação Supabase, isolamento por empresa, permissões por módulo e persistência operacional remota. A principal limitação arquitetural é que a maior parte dos dados de negócio ainda é persistida como um único documento JSONB em `gm_tenant_state`. Isso permitiu evoluir rapidamente o produto, mas concentra concorrência, validação e consistência no salvamento do estado completo.

O ciclo de manutenção existe na interface, porém ainda não está fechado no backend. Os maiores bloqueadores de confiabilidade são:

1. planos preventivos não geram O.S. automaticamente no servidor;
2. usuários de acesso e recursos operacionais são fontes distintas;
3. indicadores possuem fórmulas divergentes entre Dashboard, Relatórios e IA;
4. transições de O.S., paradas e estado do ativo são validadas principalmente no cliente;
5. a navegação dos módulos não possui rotas profundas reais.

A primeira entrega recomendada e escolhida é a camada única de indicadores no backend (P0.3), por ser uma fundação compartilhada, de baixo risco destrutivo e com impacto imediato em Dashboard, Indicadores, Relatórios e IA.

## 2. Arquitetura atual

### Frontend oficial

- Aplicação SPA monolítica em HTML, CSS e JavaScript clássico.
- Arquivos de entrada publicados: `index.html` e `404.html`, mantidos como cópias funcionais idênticas.
- Vite é usado para build e publicação dos dois arquivos; não é a origem da arquitetura da aplicação oficial.
- Existe um scaffold React em `src/`, mas ele não é o frontend oficial em uso e não deve ser confundido com o monólito publicado.
- O roteamento principal é realizado por `setView()`, alternando seções DOM. A maioria dos módulos permanece na URL raiz.
- A interface contém 32 views, incluindo Dashboard, Ativos, O.S., Planos, Checklists, Paradas, Medições, Estoque, Recursos, Relatórios e administração da plataforma.

### Backend

- Supabase Auth para autenticação.
- PostgreSQL/Supabase para empresas, memberships, perfis, auditoria, preferências e estado operacional.
- Edge Functions para onboarding, administração de usuários/empresas, IA e integrações.
- Storage privado e políticas de acesso documentadas nas migrations de segurança.
- O estado operacional compartilhado é carregado por `gm_load_tenant_state()` e salvo por `gm_save_tenant_state(expected_version, state)`.

### Persistência e concorrência

- `gm_tenant_state.state` é a fonte principal de verdade para o monólito.
- O salvamento usa versão otimista e bloqueio de linha, retornando `GM_STATE_CONFLICT` em concorrência.
- O backend valida o nível de permissão dos top-level keys modificados.
- Exclusões em arrays exigem nível `manage`.
- O estado completo ainda é a unidade de concorrência; duas alterações independentes em coleções diferentes podem disputar a mesma versão.

### Deploy

- Vite gera a aplicação estática.
- O repositório contém `CNAME` para o domínio oficial.
- Não há workflow GitHub Actions versionado na cópia analisada.
- Edge Functions e migrations dependem de fluxo Supabase separado do deploy estático.

## 3. Tecnologias e dependências

- HTML5, CSS e JavaScript clássico no frontend oficial.
- Vite 5 e TypeScript para build/scaffold.
- React 18 e React Router 6 presentes no scaffold paralelo.
- Supabase JS 2.45.x.
- PostgreSQL, RLS, RPCs e Supabase Edge Functions/Deno.
- Playwright para E2E.
- pgTAP/SQL para testes de RLS, RPC e Storage.

## 4. Modelo de dados e relacionamentos

### Entidades relacionais de identidade/plataforma

- `gm_companies`: empresa/tenant.
- `gm_company_members`: vínculo do usuário com empresa, função, perfil e permissões.
- `gm_profiles`: perfil global do usuário, separado do membership.
- `gm_company_units`, `gm_company_subscriptions` e tabelas de auditoria.
- `gm_tenant_state`: documento operacional JSONB por empresa.

### Coleções operacionais no JSONB

Entre as coleções normalizadas pelo frontend estão:

- `regions`, `locations`, `operationalAreas`, `sectorsLocations`, `installationStructures`;
- `assets`, `orders`, `preventivePlans`;
- `checklists`, `checklistExecutions`;
- `downtimes`, `measurementPoints`, `measurements`, `pendingActions`;
- `resources`, `teams`;
- peças, estoques, movimentações, requisições, transferências, ferramentas e documentos.

### Relações principais

- O.S. → ativo por `assetId`.
- plano → ativo por `assetId`.
- O.S. preventiva → plano por `preventivePlanId`.
- parada → ativo por `assetId` e opcionalmente O.S. por `orderId`.
- ativo → localização legada por `locationId` e/ou hierarquia nova de instalação.
- equipe → recursos por IDs; O.S. guarda snapshots e IDs de executantes.

### Risco de modelo

Há tabelas relacionais legadas para partes do domínio, mas o monólito oficial usa prioritariamente o JSONB. A coexistência cria risco de duas fontes de verdade caso uma integração escreva nas tabelas legadas sem atualizar `gm_tenant_state`.

## 5. Fluxo atual de Ordem de Serviço

1. O usuário abre o formulário de O.S.
2. O frontend valida ativo, descrição e pelo menos um executante.
3. O registro é criado com status `Aberta` e salvo no estado do tenant.
4. “Salvar e iniciar” chama `startOrder()`, alterando o status para `Em execucao` e registrando `startedAt`.
5. O encerramento coleta solução, responsável e data; calcula duração/MTTR no navegador e muda para `Concluida`.
6. O estado completo é persistido via RPC.
7. Há proteção administrativa para exclusão e verificação recursiva de vínculos.

### Lacunas confirmadas

- Não existe máquina de estados autoritativa no banco.
- Um status cancelado é tratado como fechado, mas as transições não são validadas pelo servidor.
- O histórico de eventos não é uma trilha imutável garantida; eventos fazem parte do estado e chamadas legadas foram reduzidas ao salvamento do JSONB.
- SLA/prazo por prioridade não é obrigatório.
- Encerramento corretivo não exige causa, modo de falha, componente e ação estruturados.
- A atualização entre O.S., parada e status do ativo não é transacional.

## 6. Planos preventivos

O cadastro suporta recorrência por data, próxima execução, responsável textual, checklist, peças, documentos e calendário informado como texto. A geração disponível é manual.

O próprio formulário informa que a geração automática depende de backend ainda indisponível. A função manual evita duplicação apenas comparando plano e data no estado carregado no navegador. Não há scheduler, fila, log de tentativas ou idempotência transacional por empresa/plano/ocorrência.

Planos por medidor/horímetro não possuem serviço automático implementado.

## 7. Usuários, técnicos, recursos e equipes

- Usuários de acesso vêm de Supabase Auth, `gm_company_members` e `gm_profiles`.
- Recursos operacionais vêm de `state.resources`.
- Equipes vêm de `state.teams`.
- O recurso aceita `userId`, mas o vínculo é opcional e não é reconciliado pelo backend.
- O seletor de executantes combina usuários permitidos e recursos, gerando snapshot na O.S.
- Responsável do plano ainda é texto livre.

Consequência: um usuário executor ativo pode não corresponder a um recurso ativo, e alterações de disponibilidade podem divergir entre O.S., calendário e equipes.

## 8. Indicadores: origem e fórmulas encontradas

Foram identificadas fórmulas independentes em três locais:

1. `calcMetrics()` e funções de Dashboard/Relatórios no monólito;
2. `stage16MetricData()` e gráficos gerenciais;
3. `buildInternalContext()` da Edge Function `ai-gestman`.

### MTTR

- O módulo gerencial usa O.S. corretivas concluídas com duração explícita ou intervalo início/fim válido.
- O cálculo legado usa `order.mttr` e converte ausência em zero.
- A IA possuía outro cálculo baseado somente em `order.mttr > 0`.

### MTBF

- O módulo gerencial usa deltas de horímetro e falhas corretivas.
- O gráfico do Dashboard possui fallback para horas-calendário menos paradas.
- O cálculo legado e a IA estimam horas por `ativos × 720 / falhas`, mesmo sem base operacional comprovada.

### Disponibilidade

- O módulo gerencial usa todas as horas civis do período multiplicadas pelos ativos e subtrai paradas.
- Sem parada registrada, esse cálculo pode retornar 100%, mesmo sem calendário produtivo válido.
- A IA possuía fórmula adicional baseada em ativos “operando” e O.S. abertas.

### Conclusão

Os valores não possuem contrato único e podem divergir entre telas. Ausência de dados também pode virar zero. Isso confirma o P0.3.

## 9. Autenticação, autorização e multiempresa

### Pontos positivos

- Autenticação usa Supabase Auth; não há autenticação própria paralela no fluxo oficial.
- Contexto vem de `gm_current_context()` e considera membership ativo e empresa ativa.
- Estado é isolado por empresa e protegido por RLS/RPC.
- `gm_save_tenant_state()` aplica controle de versão e autorização por módulo.
- Edge Function de IA valida usuário, empresa, permissão, origem e limite de uso.
- Sessão fica em `sessionStorage`, reduzindo persistência involuntária entre sessões do navegador.

### Riscos e pendências

- “Continuar conectado” aparece marcado por padrão, mas a sessão permanece apenas na aba; o contrato visual e o comportamento não são equivalentes.
- Funções `SECURITY DEFINER` legadas usam `search_path` fixado em `public`; novas funções devem usar `search_path = ''` e nomes qualificados.
- A matriz de permissões frontend é útil para UX, mas segurança depende das RPCs/RLS.
- Testes dinâmicos de isolamento entre dois tenants precisam continuar obrigatórios antes de produção.
- O JSONB completo amplia a superfície de validação de entrada e de concorrência.

## 10. Processos dependentes do frontend

- geração de O.S. preventiva;
- cálculo e atualização de próxima execução do plano;
- transições de status de O.S.;
- cálculo de duração/MTTR no encerramento;
- sincronização de status entre ativo e parada;
- prevenção de duas paradas ativas para o mesmo ativo;
- parte dos indicadores e gráficos;
- navegação entre módulos e deep links;
- reconciliação de usuários com recursos operacionais.

## 11. Hipóteses observadas

| Hipótese | Resultado | Evidência no código |
|---|---|---|
| Planos ativos/atrasados sem O.S. automática | Confirmada estruturalmente | O formulário declara ausência do serviço; geração é manual. Números do ambiente não foram hardcoded nem presumidos. |
| Formulário pode não listar técnicos ativos | Confirmada como risco | Usuários e recursos vêm de fontes diferentes; vínculo `userId` é opcional. |
| Disponibilidade 100% sem paradas válidas | Confirmada | Fórmula usa horas civis e parada zero quando não há calendário operacional. |
| Ativo “Parado” sem parada registrada | Permitida pelo modelo atual | Não há regra backend que obrigue ocorrência de parada. |
| Quantidades divergentes entre módulos | Confirmada como risco de cálculo | Há renderizadores e agregadores independentes para Dashboard, relatórios e módulos operacionais. |
| IA mostra MTTR/MTBF zero enquanto tela mostra “Sem dados” | Confirmada | A IA e `calcMetrics()` convertiam ausência em zero; `stage16MetricData()` usa `null`. |
| O.S. urgente sem prazo não aparece como atrasada | Confirmada | Sem data, `orderDueState()` retorna `no-date`; não existe prazo automático por prioridade. |
| Planos sem responsáveis | Permitida | Responsável é campo opcional e textual. |
| Checklists/medições sem registros | Não confirmável apenas pelo código | As coleções podem ser vazias por tenant; requer inspeção de dados autorizada para quantificar. |
| Peças incompletas | Permitida pelo cadastro atual | Categoria, fornecedor, valor e mínimo não são universalmente obrigatórios. |
| Todos os módulos na URL raiz | Confirmada | `setView()` alterna DOM sem rota por módulo. |
| Problemas de acessibilidade | Parcialmente confirmada | Há melhorias de foco e rótulos, mas ainda existem HTML dinâmico, botões repetidos e elementos decorativos que exigem matriz E2E completa. |

## 12. Riscos principais

### Críticos

- indicadores divergentes usados para decisão gerencial;
- preventivas vencidas dependentes de ação manual;
- regras operacionais críticas apenas no navegador;
- status de ativo, parada e O.S. sem transação única.

### Altos

- concorrência no documento JSONB completo;
- identidade operacional duplicada entre membership e recursos;
- campos livres onde deveriam existir IDs/taxonomias;
- relatórios e IA consumindo fórmulas diferentes.

### Médios

- URLs sem deep link;
- documentação que mistura o scaffold React com o produto oficial;
- código monolítico com funções históricas duplicadas/sobrescritas;
- cobertura E2E dependente de ambiente e segredos ignorados pelo Git.

## 13. Testes existentes e lacunas

### Existentes

- Playwright oficial para segurança estática, autenticação, solicitação pública, RLS/Storage, UI operacional, isolamento, responsividade e administração.
- pgTAP para RLS, RPC e Storage.
- validadores estáticos para sincronismo `index.html`/`404.html`, IA, exclusão de O.S., imagens de perfil e integração WhatsApp.

### Lacunas

- contrato único de indicadores;
- cenários de ausência de dados versus zero;
- sobreposição de paradas;
- recorrência e concorrência de preventivas;
- máquina de estados de O.S. no backend;
- reconciliação usuário/recurso;
- concorrência entre dois usuários alterando coleções diferentes;
- navegação profunda, refresh e histórico do navegador.

## 14. Débitos técnicos

- monólito de aproximadamente 39 mil linhas duplicado em dois arquivos;
- funções antigas permanecem no arquivo e são sobrescritas por versões posteriores;
- fórmulas de negócio embutidas em renderizadores;
- ausência de módulo compartilhado de domínio;
- nomenclatura inconsistente (`Concluida`, `Concluída`, `Em execucao`, `Em execução`);
- campos relacionais armazenados simultaneamente como nome, snapshot e ID;
- mensagens antigas ainda mencionam `localStorage`, embora a persistência oficial tenha sido substituída por Supabase.

## 15. Decisão da primeira fatia P0

Será implementada a camada única de indicadores como serviço backend puro e compartilhado:

- cálculo em módulo TypeScript comum às Edge Functions;
- endpoint autenticado e tenant-scoped;
- IA consumindo o mesmo contrato;
- frontend consumindo o endpoint em vez de recalcular valores;
- `null` preservado quando não há base suficiente;
- disponibilidade indisponível sem calendário operacional vinculável;
- testes de contrato determinísticos.

Nenhuma migration de dados é necessária para esta primeira fatia porque o serviço é somente leitura e usa o estado já persistido. Nenhum dado atual será alterado.
