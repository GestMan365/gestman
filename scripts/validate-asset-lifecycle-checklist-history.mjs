import fs from "node:fs";

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),"utf8");
const html=read("index.html"),fallback=read("404.html");
const lifecycleMigration=read("supabase/migrations/20260908213849_asset_work_order_lifecycle.sql");
const transitionMigration=read("supabase/migrations/20260824234000_work_order_state_machine.sql");
const failures=[];
const expect=(condition,message)=>{if(!condition)failures.push(message)};
const sqlFunction=(source,name)=>{
  const start=source.indexOf(`create or replace function public.${name}(`);
  if(start<0)return"";
  const end=source.indexOf("\n$$;",start);
  return source.slice(start,end<0?source.length:end+4);
};
const functionBody=name=>{
  const starts=[`function ${name}(`,`async function ${name}(`].map(pattern=>html.indexOf(pattern)).filter(index=>index>=0);
  if(!starts.length)return"";
  const start=Math.min(...starts),stops=[html.indexOf("\n    function ",start+12),html.indexOf("\n    async function ",start+12)].filter(index=>index>=0);
  return html.slice(start,stops.length?Math.min(...stops):html.length);
};

const normalizeExecution=functionBody("normalizeChecklistExecution");
const transition=functionBody("gmTransitionWorkOrder");
const lifecycle=functionBody("reconcileAssetWorkOrderLifecycleState");
const health=functionBody("assetHealth");
const executions=functionBody("assetChecklistExecutions");
const timestamp=functionBody("assetChecklistTimestampInfo");
const history=functionBody("assetChecklistHistoryEvents");
const activeOrderSql=sqlFunction(lifecycleMigration,"gm_work_order_is_asset_active");
const reconcileSql=sqlFunction(lifecycleMigration,"gm_reconcile_asset_work_order_lifecycle");
const manualStatusSql=sqlFunction(lifecycleMigration,"gm_mark_manual_asset_status_changes");
const triggerSql=sqlFunction(lifecycleMigration,"gm_enforce_work_order_state_transition");

expect(normalizeExecution.includes("checklistTimestampValue")&&!normalizeExecution.includes("Date.now()"),"Normalização de checklist ainda fabrica horário ausente.");
expect(normalizeExecution.includes("equipmentId: execution.equipmentId || execution.assetId"),"Compatibilidade equipmentId/assetId ausente.");
expect(functionBody("checklistExecutionDateLabel").includes("Data não informada"),"Data ausente ainda é exibida como hífen.");
expect(transition.includes("reconcileAssetWorkOrderLifecycleState")&&transition.indexOf("await gmRpc")<transition.indexOf("reconcileAssetWorkOrderLifecycleState"),"Reconciliação local não ocorre somente após persistência transacional.");
expect(lifecycle.includes("previousStatus")&&lifecycle.includes("workOrderStatusControl"),"Estado anterior do ativo não é preservado.");
expect(lifecycle.includes("activeOrders.length")&&lifecycle.includes("activeDowntime"),"Vínculos operacionais ativos não protegem a restauração.");
expect(lifecycle.includes("manualOrigin")&&lifecycle.includes("statusSetManually"),"Status manual não é diferenciado do status automático.");
expect(lifecycle.includes("assetLifecycleBelongsToTenant"),"Ciclo do ativo não valida tenant.");
expect(health.includes("activeOrders")&&health.includes("sem vínculo operacional ativo"),"Saúde do ativo ainda pode afirmar manutenção ativa sem evidência.");
expect(executions.includes("assetChecklistEquipmentId")&&executions.includes("assetLifecycleBelongsToTenant"),"Ficha não localiza checklist por equipmentId e tenant.");
expect(executions.includes("deduplicated")&&executions.includes("assetChecklistExecutionId"),"Execuções não são deduplicadas por executionId.");
expect(timestamp.indexOf('"completedAt"')<timestamp.indexOf('"updatedAt"')&&timestamp.includes("CHECKLIST_CONCLUIDO"),"Prioridade dos timestamps confiáveis está incorreta.");
expect(history.includes("assetChecklistExecutions")&&history.includes("CHECKLIST CONCLUÍDO"),"Histórico do ativo não usa execuções concluídas normalizadas.");
expect(functionBody("assetTabContent").includes("assetChecklistLatestExecution")&&functionBody("assetTabContent").includes("responsibleName")&&functionBody("assetTabContent").includes("startedBy"),"Aba Checklists não apresenta os detalhes operacionais exigidos.");
expect(lifecycleMigration.includes("gm_reconcile_asset_work_order_lifecycle"),"Reconciliação transacional server-side ausente.");
expect(lifecycleMigration.includes("for update")===false,"Migration paralela não deve criar uma segunda leitura fora do lock já mantido pelo RPC.");
expect(lifecycleMigration.includes("gm_work_order_is_asset_active")&&lifecycleMigration.includes("gm_normalize_downtime_status"),"O.S. e parada ativas não são consideradas conjuntamente.");
expect(lifecycleMigration.includes("gm_mark_manual_asset_status_changes"),"Alterações manuais não removem o controle automático.");
expect(lifecycleMigration.includes("new.state := public.gm_reconcile_asset_work_order_lifecycle"),"Trigger não aplica a reconciliação na mesma transação da O.S.");
expect(transitionMigration.includes("for update")&&transitionMigration.includes("unique (company_id, request_id)"),"Concorrência ou idempotência do RPC original não está preservada.");
expect([activeOrderSql,reconcileSql,manualStatusSql].every(body=>body.includes("security invoker")&&!body.includes("security definer")),"Função pura de transformação JSON ainda usa SECURITY DEFINER.");
expect(triggerSql.includes("security definer")&&triggerSql.includes("set search_path = ''"),"Trigger privilegiada perdeu SECURITY DEFINER justificado ou search_path seguro.");
expect(triggerSql.indexOf("v_actor_user_id := auth.uid()")>=0&&triggerSql.indexOf("v_actor_user_id := auth.uid()")<triggerSql.indexOf("v_marker :="),"Trigger não rejeita usuário anônimo antes de processar a transição.");
expect(triggerSql.includes("public.gm_is_company_member(v_company_id)")&&triggerSql.includes("GM_TENANT_ACCESS_DENIED"),"Trigger não valida participação no tenant.");
expect(triggerSql.includes("GM_ORDER_TENANT_MISMATCH")&&triggerSql.includes("GM_ORDER_ASSET_TENANT_MISMATCH"),"Trigger não rejeita O.S. ou ativo de tenant incompatível.");
expect(reconcileSql.includes("GM_ORDER_ASSET_TENANT_MISMATCH"),"Reconciliação ainda ignora ativo ausente do estado tenant.");
expect([activeOrderSql,reconcileSql,manualStatusSql,triggerSql].every(body=>body.includes("set search_path = ''")),"Há função da migration sem search_path vazio.");
expect(lifecycleMigration.includes("revoke all on function public.gm_enforce_work_order_state_transition() from public, anon, authenticated;"),"EXECUTE direto da trigger não foi revogado de todos os papéis clientes.");
expect(lifecycleMigration.includes("revoke all on function public.gm_transition_work_order(bigint, text, text, jsonb, text, uuid) from public, anon;")&&lifecycleMigration.includes("grant execute on function public.gm_transition_work_order(bigint, text, text, jsonb, text, uuid) to authenticated;"),"Matriz de EXECUTE do único RPC autorizado está incorreta.");
expect(!/grant\s+execute\s+on\s+function\s+public\.(gm_work_order_is_asset_active|gm_reconcile_asset_work_order_lifecycle|gm_mark_manual_asset_status_changes|gm_enforce_work_order_state_transition)/i.test(lifecycleMigration),"Função auxiliar ou trigger foi exposta diretamente a authenticated.");
expect(lifecycleMigration.trimStart().startsWith("begin;")&&lifecycleMigration.trimEnd().endsWith("commit;"),"Migration deixou de ser transacional.");
expect(!/\b(drop\s+(table|schema)|truncate|delete\s+from|update\s+public\.)\b/i.test(lifecycleMigration),"Migration contém operação destrutiva ou alteração ampla de dados.");
expect(html===fallback,"index.html e 404.html não estão sincronizados.");

if(failures.length){console.error(failures.map(item=>`- ${item}`).join("\n"));process.exit(1)}
console.log("Fase 04 — ciclo do ativo e histórico de checklists: validação estática aprovada.");
