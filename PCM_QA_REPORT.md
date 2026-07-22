# Relatório de QA — PCM e Manutenção Preventiva

## Resultado executivo

O PCM deixou de ser uma tela demonstrativa e passou a ter um domínio funcional em modo demo: planos por empresa, estados controlados, versionamento de periodicidade, agenda preventiva, contador/horímetro, suspensão, reativação, arquivamento e geração idempotente de O.S. O Supabase remoto não foi alterado.

## Arquivos analisados

- `src/pages/PcmPage.tsx`, `src/pages/WorkOrdersPage.tsx` e `src/pages/AssetsPage.tsx`;
- serviços e tipos de Ativos e Ordens de Serviço;
- contexto de autenticação/tenant, permissões, rotas, estilos e testes existentes;
- configuração Playwright e lançadores Vite validados anteriormente.

## Arquivos criados

- `src/types/pcm.ts`;
- `src/services/pcmService.ts`;
- `src/components/pcm/MaintenancePlanFormDialog.tsx`;
- `src/components/pcm/MaintenancePlanDetailsDialog.tsx`;
- `tests/pcm/pcm.spec.ts`;
- `PCM_TEST_PLAN.md`;
- `PCM_QA_REPORT.md`.

## Arquivos modificados

- `src/pages/PcmPage.tsx`;
- `src/services/workOrderService.ts`;
- `src/types/workOrders.ts`;
- `src/types/permissions.ts`;
- `src/styles/global.css`.

## Modelo de domínio e regras

- Código único por empresa, prefixo seguro no demo e vínculo obrigatório com Ativo.
- Estados: RASCUNHO, ATIVO, SUSPENSO, VENCIDO e ARQUIVADO.
- Transições inválidas bloqueadas; suspensão exige motivo; arquivamento preserva histórico.
- Mudança de periodicidade incrementa versão e registra evento.
- Gatilhos modelados: CALENDARIO, HORIMETRO, QUILOMETRAGEM, CICLOS, MEDICAO, CONDICAO e EVENTO.
- Implementados na UI e testados: calendário e horímetro. Contadores regressivos são bloqueados.
- Datas por calendário suportam dia, semana, mês e ano com frequência positiva.

## Geração de O.S.

- Somente plano ATIVO e ativo operacionalmente ativo geram O.S.
- O.S. herda ativo, tipo, prioridade, criticidade, duração, procedimento, instruções, materiais, ferramentas e snapshot do checklist.
- Competência, ID/código/versão do plano ficam registrados na O.S.; o plano guarda o ID da O.S.
- A chave lógica plano + competência impede duplicidade.
- Próxima execução é recalculada somente após criação bem-sucedida.
- Não existe scheduler remoto nesta fase; a “geração automática” permanece contrato futuro.

## Checklists, programação e backlog

- O modelo aceita itens obrigatórios/opcionais, tipo de resposta, ordem e versão; a O.S. recebe snapshot textual.
- Resposta executável, evidência/foto e bloqueio de conclusão ainda são cobertura futura.
- Calendário exibe próximas execuções ativas e filtros por ativo, estado, gatilho e atraso.
- Backlog em semanas não é inventado. Fórmula recomendada: `horas estimadas pendentes / capacidade semanal disponível da equipe`.
- Como capacidade e jornada não existem, a interface informa “Estrutura base”.

## Permissões

- Administrador: planejamento e gestão completa.
- Supervisor: consulta e planejamento conforme matriz atual; aprovação formal não foi inventada.
- Planejador: criação e edição, sem arquivar ou gerar nesta versão.
- Técnico: sem acesso administrativo ao módulo; execução ocorre pela O.S.
- Solicitante: sem acesso administrativo.

## UX e correções objetivas

- Alta: PCM era somente dois cards sem fluxo — corrigido.
- Alta: inexistência de estado/histórico — corrigido.
- Alta: risco de O.S. preventiva duplicada — corrigido com idempotência.
- Média: ausência de filtros e agenda — corrigido.
- Média: falta de estados vazios/carregamento/feedback — corrigido.
- Baixa: responsividade das tabelas e formulários — corrigida e testada.

## Indicadores e fontes necessárias

- Cumprimento da programação = O.S. programadas concluídas no prazo / O.S. programadas previstas.
- Aderência preventiva = preventivas executadas conforme competência / preventivas previstas.
- Preventiva x corretiva: horas ou quantidade por tipo, sempre identificando a unidade.
- Backlog em semanas = horas estimadas pendentes / capacidade semanal disponível.
- Reprogramação = O.S. reprogramadas / O.S. programadas.
- MTTR, MTBF e disponibilidade dependem de tempos válidos, falhas e calendário operacional; não foram simulados.

## Riscos pendentes

- Crítico para produção: ainda não existe persistência Supabase/RLS do PCM nem migração aprovada.
- Alto: geração automática precisa de scheduler transacional e trava de concorrência no backend.
- Alto: checklists executáveis e evidências precisam de armazenamento e auditoria servidor.
- Médio: capacidade de equipe e conflitos de agenda dependem de cadastros ainda ausentes.
- Médio: gatilhos por medição/condição precisam de fonte de leitura confiável; IoT não foi implementado.

## Testes e regressão

- Suíte PCM: 29 cenários E2E no Chromium.
- Testes anteriores: 97.
- Total esperado após esta entrega: 126.
- Build, suíte PCM e regressão completa devem permanecer verdes antes do commit.

## Comandos PowerShell

```powershell
Set-Location 'C:\Users\andsa\Desktop\GestMan365-Claude'
npm run build
npx playwright test --list
npx playwright test tests/pcm --project=chromium
npx playwright test --project=chromium
npm run qa
```
