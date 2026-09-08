import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const html=fs.readFileSync(new URL("../index.html",import.meta.url),"utf8");
const functionBody=name=>{
  const starts=[`function ${name}(`,`async function ${name}(`].map(pattern=>html.indexOf(pattern)).filter(index=>index>=0);
  assert.ok(starts.length,`Função ${name} ausente`);
  const start=Math.min(...starts),nextCandidates=[html.indexOf("\n    function ",start+12),html.indexOf("\n    async function ",start+12)].filter(index=>index>=0);
  return html.slice(start,nextCandidates.length?Math.min(...nextCandidates):html.length);
};
const clone=value=>JSON.parse(JSON.stringify(value));
const normalize=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
const time=value=>{if(value===null||value===undefined||String(value).trim()==="")return 0;const number=Number(value);if(Number.isFinite(number)&&number>0)return number;const parsed=new Date(value).getTime();return Number.isFinite(parsed)&&parsed>0?parsed:0};
const context={
  state:{},
  currentAccount:{company:{id:"tenant-a"},user:{id:"user-a"}},
  gmRemoteSaveTimer:null,gmRemoteSavePromise:Promise.resolve(),gmStateDirty:false,gmRemoteStateVersion:1,
  gmRemoteStateUpdatedAt:"",gmRemoteLastSavedState:null,gmSyncConflict:null,hasPendingLocalSync:false,hasSessionLocalChange:false,
  normalizeTextKey:normalize,
  statusKey:normalize,
  gmOrderTimeMs:(value,fallback=0)=>time(value)||fallback,
  byId:(rows,id)=>(rows||[]).find(item=>String(item.id)===String(id)),
  orderAuditEventType:event=>String(event.type||event.action||"").includes("CHECKLIST")?"CHECKLIST_CONCLUIDO":"",
  formatDateTime:value=>`DATA:${time(value)}`,
  isClosedOrder:status=>/conclu|finaliz|cancel/i.test(normalize(status)),
  orderIsLate:()=>false,
  validOperationalDate:value=>{const timestamp=time(value);return timestamp?new Date(timestamp):null},
  gmPrepareWorkOrderTransitionPatch:(_order,_status,patch)=>patch,
  clearTimeout:()=>{},
  gmPersistState:async()=>true,
  gmRpc:async()=>{throw new Error("GM_PERSISTENCE_FAILED")},
  uid:()=>"request-1",
  normalizeState:value=>value,
  gmInvalidateMaintenanceMetrics:()=>{},gmScheduleMaintenanceMetricsRender:()=>{},notifyOsPanelUpdate:()=>{},dispatchWhatsAppOrderEvents:()=>{},
};
vm.createContext(context);
vm.runInContext([
  functionBody("checklistTimestampValue"),
  functionBody("gmCanonicalOrderStatus"),
  functionBody("assetLifecycleRecordTenantId"),
  functionBody("assetLifecycleBelongsToTenant"),
  functionBody("assetLifecycleOrderIsActive"),
  functionBody("assetWorkOrderStatusControl"),
  functionBody("assetLifecycleActiveDowntime"),
  functionBody("assetLifecycleStatusEvent"),
  functionBody("reconcileAssetWorkOrderLifecycleState"),
  functionBody("assetLifecycleCurrentTenantId"),
  functionBody("assetChecklistExecutionId"),
  functionBody("assetChecklistEquipmentId"),
  functionBody("assetChecklistTemplateId"),
  functionBody("assetChecklistCompletionEvent"),
  functionBody("assetChecklistTimestampInfo"),
  functionBody("assetChecklistExecutionCompleted"),
  functionBody("assetChecklistExecutions"),
  functionBody("assetChecklistLatestExecution"),
  functionBody("assetChecklistDateTimeLabel"),
  functionBody("assetChecklistPendingCount"),
  functionBody("assetChecklistHistoryEvents"),
  functionBody("assetHealth"),
  functionBody("gmTransitionWorkOrder"),
].join("\n"),context);

const baseState=()=>({
  assets:[{id:"asset-25",companyId:"tenant-a",status:"Operando",statusHistory:[]}],
  orders:[{id:"order-1",companyId:"tenant-a",assetId:"asset-25",status:"Aberta",updatedAt:500,history:[]}],
  downtimes:[],checklists:[],checklistExecutions:[],preventivePlans:[],measurements:[]
});
const running=(state,id="order-1",at=1000)=>({...state,orders:state.orders.map(order=>order.id===id?{...order,status:"Em execução",startedAt:at,updatedAt:at}:order)});
const finish=(state,id="order-1",at=2000)=>({...state,orders:state.orders.map(order=>order.id===id?{...order,status:"Concluída",finishedAt:at,updatedAt:at}:order)});

test("início da primeira O.S. registra o estado anterior e coloca o ativo em manutenção",()=>{
  const result=context.reconcileAssetWorkOrderLifecycleState(running(baseState()),"order-1",{tenantId:"tenant-a",actorUserId:"user-a",at:1000});
  const asset=clone(result.assets[0]);
  assert.equal(asset.status,"Em manutenção");
  assert.equal(asset.workOrderStatusControl.previousStatus,"Operando");
  assert.equal(asset.workOrderStatusControl.activatedByOrderId,"order-1");
  assert.equal(asset.statusHistory[0].action,"WORK_ORDER_MAINTENANCE_STARTED");
});

test("conclusão da última O.S. restaura com segurança o estado anterior",()=>{
  const started=context.reconcileAssetWorkOrderLifecycleState(running(baseState()),"order-1",{tenantId:"tenant-a",at:1000});
  const completed=context.reconcileAssetWorkOrderLifecycleState(finish(started),"order-1",{tenantId:"tenant-a",at:2000});
  assert.equal(completed.assets[0].status,"Operando");
  assert.equal(completed.assets[0].workOrderStatusControl,undefined);
  assert.deepEqual(clone(completed.assets[0].statusHistory.map(item=>item.action)),["WORK_ORDER_MAINTENANCE_STARTED","WORK_ORDER_MAINTENANCE_RESTORED"]);
});

test("duas O.S. ativas impedem restauração ao concluir apenas uma",()=>{
  const initial=baseState();initial.orders.push({id:"order-2",companyId:"tenant-a",assetId:"asset-25",status:"Aberta",updatedAt:500});
  let state=context.reconcileAssetWorkOrderLifecycleState(running(initial),"order-1",{tenantId:"tenant-a",at:1000});
  state=context.reconcileAssetWorkOrderLifecycleState(running(state,"order-2",1100),"order-2",{tenantId:"tenant-a",at:1100});
  state=context.reconcileAssetWorkOrderLifecycleState(finish(state,"order-1",2000),"order-1",{tenantId:"tenant-a",at:2000});
  assert.equal(state.assets[0].status,"Em manutenção");
  assert.equal(state.assets[0].workOrderStatusControl.source,"work_order");
  assert.equal(state.assets[0].statusHistory.length,1);
});

test("status manual não é sobrescrito por O.S.",()=>{
  const state=baseState();state.assets[0]={...state.assets[0],status:"Em manutenção",statusOrigin:"manual",statusSetManually:true};
  const result=context.reconcileAssetWorkOrderLifecycleState(running(state),"order-1",{tenantId:"tenant-a",at:1000});
  assert.equal(result.assets[0].status,"Em manutenção");
  assert.equal(result.assets[0].workOrderStatusControl,undefined);
  assert.equal(result.assets[0].statusHistory.length,0);
});

test("replay de início e conclusão não duplica eventos",()=>{
  let state=context.reconcileAssetWorkOrderLifecycleState(running(baseState()),"order-1",{tenantId:"tenant-a",at:1000});
  state=context.reconcileAssetWorkOrderLifecycleState(state,"order-1",{tenantId:"tenant-a",at:1000});
  assert.equal(state.assets[0].statusHistory.length,1);
  state=context.reconcileAssetWorkOrderLifecycleState(finish(state),"order-1",{tenantId:"tenant-a",at:2000});
  state=context.reconcileAssetWorkOrderLifecycleState(state,"order-1",{tenantId:"tenant-a",at:2000});
  assert.equal(state.assets[0].statusHistory.length,2);
});

test("parada ativa impede restauração prematura e preserva o estado anterior",()=>{
  let state=context.reconcileAssetWorkOrderLifecycleState(running(baseState()),"order-1",{tenantId:"tenant-a",at:1000});
  state={...state,assets:[{...state.assets[0],status:"Parado",activeDowntimeId:"stop-1"}],downtimes:[{id:"stop-1",companyId:"tenant-a",assetId:"asset-25",status:"Ativa",previousAssetStatus:"Em manutenção",startAt:1500}]};
  state=context.reconcileAssetWorkOrderLifecycleState(finish(state),"order-1",{tenantId:"tenant-a",at:2000});
  assert.equal(state.assets[0].status,"Parado");
  assert.equal(state.assets[0].workOrderStatusControl,undefined);
  assert.equal(state.downtimes[0].previousAssetStatus,"Operando");
});

test("isolamento por tenant bloqueia reconciliação cruzada",()=>{
  const state=running(baseState());state.orders[0].companyId="tenant-b";
  assert.throws(()=>context.reconcileAssetWorkOrderLifecycleState(state,"order-1",{tenantId:"tenant-a"}),/GM_ORDER_TENANT_MISMATCH/);
});

test("falha de persistência mantém ordem, ativo e histórico integralmente",async()=>{
  context.state=running(baseState());const before=clone(context.state);
  await assert.rejects(()=>context.gmTransitionWorkOrder("order-1","Em execução",{}),/GM_PERSISTENCE_FAILED/);
  assert.deepEqual(clone(context.state),before);
});

const checklistState=()=>({
  assets:[{id:"asset-25",companyId:"tenant-a",status:"Operando"}],
  checklists:[{id:"check-1",companyId:"tenant-a",assetId:"asset-25",name:"Inspeção preventiva"}],
  orders:[
    {id:"order-2",companyId:"tenant-a",assetId:"asset-25",number:"O.S-0002",history:[]},
    {id:"order-legacy",companyId:"tenant-a",assetId:"asset-25",number:"O.S-LEGACY",history:[{type:"CHECKLIST_CONCLUIDO",checklistExecutionId:"execution-event",date:2500}]}
  ],
  checklistExecutions:[
    {id:"execution-old",companyId:"tenant-a",equipmentId:"asset-25",checklistTemplateId:"check-1",status:"Concluído",completedAt:1000,result:"Conforme",responsibleName:"Técnico A"},
    {id:"execution-new",companyId:"tenant-a",equipmentId:"asset-25",checklistTemplateId:"check-1",status:"Concluído",finishedAt:2000,result:"Conforme com observações",responsibleName:"Anderson Vieira",startedBy:"Fabricio Figueiredo",workOrderId:"order-2"},
    {id:"execution-new",companyId:"tenant-a",equipmentId:"asset-25",checklistTemplateId:"check-1",status:"Concluído",finishedAt:1500,result:"Registro duplicado"},
    {id:"execution-event",companyId:"tenant-a",assetId:"asset-25",checklistId:"check-1",status:"Concluído",workOrderId:"order-legacy",result:"Conforme"},
    {id:"execution-foreign",companyId:"tenant-b",equipmentId:"asset-25",checklistTemplateId:"check-1",status:"Concluído",completedAt:9000,result:"Não conforme"}
  ],preventivePlans:[],measurements:[],downtimes:[]
});

test("checklist concluído mais recente usa data, resultado e execução corretos",()=>{
  context.state=checklistState();
  const rows=clone(context.assetChecklistExecutions("asset-25","tenant-a")),latest=clone(context.assetChecklistLatestExecution("asset-25","check-1","tenant-a"));
  assert.deepEqual(rows.map(item=>item.id),["execution-event","execution-new","execution-old"]);
  assert.equal(latest.id,"execution-event");
  assert.equal(context.assetChecklistDateTimeLabel(rows[0],"tenant-a"),"DATA:2500");
  assert.equal(rows.find(item=>item.id==="execution-new").result,"Conforme com observações");
});

test("histórico deduplica executionId, ordena e não mistura tenant",()=>{
  context.state=checklistState();
  const history=clone(context.assetChecklistHistoryEvents(context.state.assets[0]));
  assert.deepEqual(history.map(item=>item.id),["checklist:execution-event","checklist:execution-new","checklist:execution-old"]);
  assert.equal(history.filter(item=>item.id==="checklist:execution-new").length,1);
  assert.equal(history.some(item=>item.id.includes("foreign")),false);
});

test("registro legado sem timestamp exibe Data não informada sem fabricar data",()=>{
  context.state=checklistState();
  const legacy={id:"execution-undated",companyId:"tenant-a",assetId:"asset-25",checklistId:"check-1",status:"Concluído",result:"Conforme"};
  context.state.checklistExecutions.push(legacy);
  assert.deepEqual(clone(context.assetChecklistTimestampInfo(legacy,"tenant-a")),{value:0,source:"missing"});
  assert.equal(context.assetChecklistDateTimeLabel(legacy,"tenant-a"),"Data não informada");
});

test("saúde não afirma manutenção em andamento sem atividade ativa",()=>{
  context.state=checklistState();context.state.assets[0].status="Em manutenção";
  context.assetOrders=()=>[];context.assetDowntimes=()=>[];context.assetPlans=()=>[];
  const health=clone(context.assetHealth(context.state.assets[0]));
  assert.equal(health.active,0);
  assert.equal(health.reason.includes("em andamento"),false);
  assert.match(health.reason,/sem vínculo operacional ativo/);
});
