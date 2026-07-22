# Plano de Testes — Ordens de Serviço

## Escopo

Validação E2E do ciclo demo de O.S., sem Supabase, migração ou dados de produção. Dados usam `QA-AUTO-OS`, são idempotentes, segregados por empresa e persistem somente em `sessionStorage`.

## Máquina de estados

| Origem | Destinos válidos |
|---|---|
| ABERTA | EM_ANALISE, CANCELADA |
| EM_ANALISE | PLANEJADA, CANCELADA |
| PLANEJADA | ATRIBUIDA, AGUARDANDO_MATERIAL, AGUARDANDO_LIBERACAO, CANCELADA |
| AGUARDANDO_MATERIAL | ATRIBUIDA, CANCELADA |
| AGUARDANDO_LIBERACAO | ATRIBUIDA, CANCELADA |
| ATRIBUIDA | EM_EXECUCAO, CANCELADA |
| EM_EXECUCAO | PAUSADA, CONCLUIDA |
| PAUSADA | EM_EXECUCAO |
| CONCLUIDA | ENCERRADA; PLANEJADA apenas por reabertura justificada |
| ENCERRADA | PLANEJADA apenas por reabertura justificada |
| CANCELADA | nenhuma |

Bloqueios: início sem técnico; conclusão sem ação e duração; encerramento antes da conclusão; pausa/cancelamento/reabertura sem motivo; duração negativa; conversão duplicada; edição crítica após planejamento.

## Dados

Cinco O.S. determinísticas: corretivas em Aberta, Em análise e Planejada; preventiva Atribuída; inspeção Em execução. A numeração seguinte começa em `QA-AUTO-OS-006`.

## Matriz de cenários automatizados

| ID | Grupo | Objetivo / resultado esperado | Perfil | Prioridade | Risco |
|---|---|---|---|---|---|
| OS-001 | Smoke | proteger rota anônima | anônimo | alta | acesso indevido |
| OS-002 | Leitura | listar 5 seeds e estados válidos | admin | alta | backlog incorreto |
| OS-003 | Vazio | comunicar busca sem resultado | admin | média | UX |
| OS-004/005 | Busca/filtros | número, título, status, prioridade, tipo, ativo, técnico | admin | alta | decisão operacional |
| OS-006/007 | Criação | O.S. com ativo e serviço geral com setor | admin | alta | integridade |
| OS-008 | Validação | título, descrição e setor obrigatórios | admin | alta | registros incompletos |
| OS-009 | Numeração | sequencial, única e persistente | admin | crítica | duplicidade |
| OS-010/011 | Detalhe/edição | vínculo, histórico e edição pré-planejamento | admin | alta | rastreabilidade |
| OS-012 | Ciclo | analisar, planejar, atribuir, iniciar, apontar, concluir e encerrar | admin | crítica | fluxo CMMS |
| OS-013 | Pausa | motivo obrigatório e retomada válida | admin | alta | status falso |
| OS-014/015 | Apontamento | conclusão mínima e valores não negativos | admin | crítica | indicador incorreto |
| OS-016 | Espera | aguardar material e liberar para atribuição | admin | alta | backlog |
| OS-017 | Cancelamento | motivo, estado terminal e histórico | admin | alta | perda de contexto |
| OS-018/019 | Conversão | aprovada gera uma O.S. bidirecional; demais são bloqueadas | admin | crítica | duplicidade/parcialidade |
| OS-020 | Reabertura | justificativa e retorno a Planejada | admin | alta | edição pós-fechamento |
| OS-021–024 | Permissões | Técnico, Planejador, Solicitante e Supervisor | perfis | crítica | privilégio excessivo |
| OS-025 | Multiempresa | descartar registro de outro tenant | admin | crítica | vazamento de dados |
| OS-026 | Limpeza | remover apenas `QA-AUTO-OS` | admin | crítica | exclusão indevida |
| OS-027 | Robustez | zero erro de console/rede | admin | alta | falha silenciosa |
| OS-028 | Acessibilidade | teclado e foco | admin | média | barreira de uso |
| OS-029–031 | Responsividade | desktop, tablet e celular sem overflow | admin | alta | operação em campo |

## Perfis

- Administrador: ciclo completo, cancelamento e limpeza QA.
- Supervisor: criar, planejar, executar, concluir e encerrar; sem cancelamento administrativo nesta matriz.
- Planejador: criar, editar e planejar; não executar/encerrar.
- Técnico: somente O.S. atribuídas; executar, pausar, apontar e concluir; não encerrar.
- Solicitante: somente O.S. originadas de suas solicitações; leitura.

## Lacunas e dependências

| Problema | Risco/impacto | Recomendação | Prioridade | Dependência |
|---|---|---|---|---|
| Sem persistência/RLS remota | dados não produtivos | schema, RPC transacional e RLS | crítica | Supabase isolado |
| Técnico demo único | atribuição limitada | integrar usuários ativos/equipes | alta | Administração |
| Sem materiais reais | custo/saldo inválidos | contrato com estoque e transação | alta | Estoque |
| Sem anexos/checklist | evidência incompleta | storage privado e checklist versionado | alta | Supabase Storage |
| Sem PCM automático | preventiva manual | integrar plano/agenda após domínio estável | média | PCM |
| Sem assinatura/aceite | encerramento sem aceite | fluxo configurável | média | Produto |

## Indicadores futuros

| Indicador | Fórmula | Campos necessários / risco |
|---|---|---|
| MTTR | soma do tempo corretivo / falhas concluídas | tipo, início, conclusão; excluir espera conforme regra |
| MTBF | tempo operando / falhas | eventos de falha e calendário do ativo |
| Disponibilidade | MTBF / (MTBF + MTTR) | MTBF/MTTR confiáveis e paradas |
| Backlog | horas estimadas pendentes / capacidade semanal | duração estimada, status e equipes |
| Cumprimento | concluídas no prazo / programadas | data prevista e conclusão |
| Preventiva | preventivas / total de O.S. | tipo padronizado |
| Atendimento | início - abertura | datas coerentes |
| Execução | conclusão - início - pausas | eventos completos |
| Custo | mão de obra + materiais + terceiros | estoque/custos ainda ausentes |
| Reincidência | falhas equivalentes por ativo/período | modo de falha e causa padronizados |

## Aceite

Build, 31/31 novos testes, 66/66 anteriores, regressão total, QA, zero segredo, zero alteração remota, Git limpo e ZIP verificado.
