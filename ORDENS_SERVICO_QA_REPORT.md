# Relatório de QA — Ordens de Serviço

**Projeto:** `C:\Users\andsa\Desktop\GestMan365-Claude`  
**Origem:** `1af2e7e96d8d569fe352587e33658b6dec4944b8`  
**Data:** 21/07/2026

## Resultado

O placeholder de O.S. foi substituído por um ciclo operacional demo completo, tipado e testável: abertura, análise, planejamento, esperas, atribuição, execução, pausa, retomada, apontamento, conclusão, encerramento, reabertura e cancelamento. A conversão Solicitação → O.S. é bidirecional, única e restaurável em caso de falha na sessão.

## Arquivos principais

- `src/types/workOrders.ts`: domínio, estados, tipos e histórico.
- `src/services/workOrderService.ts`: regras, transições, conversão e seed.
- `src/pages/WorkOrdersPage.tsx`: backlog, filtros e orquestração.
- `src/components/work-orders/*`: cadastro e ciclo detalhado.
- `src/pages/RequestsPage.tsx` e `RequestDetailsDialog.tsx`: conversão real.
- `src/types/permissions.ts`: separação entre planejar, executar e encerrar.
- `tests/work-orders/work-orders.spec.ts`: 31 testes E2E.

## Integrações

Ativos são validados contra a empresa ativa e fornecem setor/local/criticidade. Solicitação aprovada herda título, descrição, prioridade, ativo, setor e solicitante. A solicitação recebe `workOrderId`, muda para `CONVERTIDA_EM_OS`, e a O.S. recebe `requestId`. Snapshots dos dois armazenamentos evitam vínculo parcial.

## Permissões

Administrador executa o ciclo completo. Supervisor planeja, executa e encerra. Planejador não executa. Técnico conclui tecnicamente apenas O.S. atribuídas e não encerra administrativamente. Solicitante acompanha somente O.S. de sua origem.

## UX auditada

- **Crítica corrigida:** inexistência de ciclo e histórico.
- **Alta corrigida:** ações exibidas fora do estado/perfil, falta de feedback e ausência de mobile.
- **Média corrigida:** filtros, vazio, foco por teclado e motivos obrigatórios.
- **Alta pendente:** seleção de técnicos depende do futuro cadastro de usuários ativos.
- **Média pendente:** uso com luvas requer validação em dispositivo físico; anexos/checklist/assinatura dependem de backend.

## Materiais, ferramentas, PCM e indicadores

O domínio reserva contratos para materiais/ferramentas, sem inventar saldo, baixa ou custo. PCM automático não foi criado. Fórmulas, campos e riscos de MTTR, MTBF, disponibilidade, backlog, cumprimento, custos e reincidência estão no plano de testes.

## Bugs encontrados e corrigidos

1. Tela original sem funcionalidade: substituída pelo fluxo operacional.
2. Ausência de isolamento defensivo: listagem filtra `empresaId` mesmo com sessão contaminada.
3. Conclusão e encerramento antes compartilhavam permissão do Técnico: responsabilidades separadas.
4. Solicitação apenas “preparava” conversão: agora a conversão demo é consistente nos dois módulos.
5. Seletor E2E ambíguo do motivo de cancelamento: detalhado por região/texto exato.

## Cobertura ausente

Persistência/RLS, concorrência real, equipes/usuários ativos, materiais/estoque, anexos, fotos, assinatura, checklist, medições e PCM dependem de módulos/backends futuros. Nenhum foi simulado como se estivesse integrado.

## Comandos

```powershell
npm run build
npx playwright test --list
npx playwright test tests/work-orders --project=chromium
npx playwright test --project=chromium
npm run qa
```

Não houve Supabase remoto, migração, produção, push ou deploy.
