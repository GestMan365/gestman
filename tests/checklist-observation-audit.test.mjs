import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const html=fs.readFileSync(new URL("../index.html",import.meta.url),"utf8");
const functionBody=name=>{
  const start=html.indexOf(`function ${name}`),next=start<0?-1:html.indexOf("\n    function ",start+12);
  assert.notEqual(start,-1,`Função ${name} ausente`);
  const declarationStart=html.slice(Math.max(0,start-6),start)==="async "?start-6:start;
  return html.slice(declarationStart,next<0?html.length:next);
};
const constantStart=html.indexOf("const CHECKLIST_EXECUTION_ERRORS"),constantEnd=html.indexOf("\n    function checklistExecutionCurrentTenantId",constantStart);
const clone=value=>JSON.parse(JSON.stringify(value));
const normalize=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const context={
  state:{},
  currentAccount:{company:{id:"tenant-a"},user:{id:"user-fabricio",firstName:"Fabricio",lastName:"Figueiredo",name:"Fabricio Figueiredo"}},
  remoteSaveResult:true,saveCalls:0,uidSequence:0,
  byId:(rows,id)=>(Array.isArray(rows)?rows:[]).find(item=>item.id===id),
  normalizeTextKey:normalize,
  checklistItems:model=>Array.isArray(model?.items)?model.items:[],
  orderRecordExecutorIds:order=>order.executorIds||[],
  tenantUserDisplayName:user=>[user.firstName,user.lastName].filter(Boolean).join(" ")||user.name||"Usuário",
  isClosedOrder:status=>/^(conclu|finaliz|cancel)/i.test(String(status||"")),
  formatDateTime:value=>String(value),
  uid:prefix=>`${prefix}-${++context.uidSequence}`,
  saveState:()=>{context.saveCalls+=1},
  saveSingleSupabase:async()=>context.remoteSaveResult,
};
vm.createContext(context);
vm.runInContext([
  html.slice(constantStart,constantEnd),
  functionBody("orderAuditStatusDetails"),
  functionBody("orderAuditEventType"),
  functionBody("orderAuditEventLabel"),
  functionBody("normalizeChecklistExecution"),
  functionBody("checklistExecutionCurrentTenantId"),
  functionBody("checklistExecutionRecordTenantId"),
  functionBody("checklistExecutionBelongsToTenant"),
  functionBody("checklistExecutionOrderId"),
  functionBody("checklistExecutionTemplateId"),
  functionBody("checklistResponseClassification"),
  functionBody("checklistExecutionMetrics"),
  functionBody("updateChecklistExecutionResponse"),
  functionBody("checklistExecutionCompletionIssue"),
  functionBody("checklistCompletionAuditEvent"),
  functionBody("completeChecklistExecution"),
].join("\n"),context);

const item=(id,order,type="conformity")=>({id,description:`Item ${order}`,order,type,required:true});
const baseOrder=(overrides={})=>({id:"order-2",companyId:"tenant-a",number:"O.S-0002",status:"Aberta",assetId:"asset-25",preventivePlanId:"plan-1",linkedChecklists:["check-1"],history:[],...overrides});
const baseExecution=(overrides={})=>({
  id:"execution-1",code:"EX-258718",companyId:"tenant-a",tenantId:"tenant-a",checklistId:"check-1",checklistTemplateId:"check-1",checklistName:"FASE 02 - Inspeção preventiva",
  assetId:"asset-25",orderId:"order-2",workOrderId:"order-2",workOrderNumber:"O.S-0002",maintenancePlanId:"plan-1",originPlanId:"plan-1",
  responsibleId:"resource-anderson",responsibleName:"Anderson Vieira",responsible:"Anderson Vieira",startedById:"user-fabricio",startedBy:"Fabricio Figueiredo",openedById:"user-fabricio",openedBy:"Fabricio Figueiredo",
  status:"Em andamento",startedAt:1000,progress:0,
  templateSnapshot:{id:"check-1",name:"FASE 02 - Inspeção preventiva",items:[item("item-1",1),item("item-2",2),item("item-3",3,"measurement")],sections:[]},
  responses:[
    {itemId:"item-1",description:"Item 1",order:1,answer:"",note:"",evidence:[]},
    {itemId:"item-2",description:"Item 2",order:2,answer:"",note:"",evidence:[]},
    {itemId:"item-3",description:"Item 3",order:3,answer:"",note:"",evidence:[]},
  ],...overrides,
});
const observations=[
  "Fixação e reaperto verificados na homologação da Fase 02.",
  "Sem ruído ou vibração anormal na verificação controlada.",
  "Proteções e limpeza confirmadas na verificação controlada.",
];
const reset=(execution=baseExecution(),order=baseOrder())=>{context.remoteSaveResult=true;context.saveCalls=0;context.uidSequence=0;context.state={profile:{name:"Fabricio Figueiredo"},checklists:[{id:"check-1"}],checklistExecutions:[execution],orders:[order]}};
const fillThreeObservations=()=>{
  context.updateChecklistExecutionResponse("execution-1","item-1",{answer:"Conforme",note:observations[0]});
  context.updateChecklistExecutionResponse("execution-1","item-2",{answer:"Conforme",note:observations[1]});
  context.updateChecklistExecutionResponse("execution-1","item-3",{answer:"12.5",note:observations[2]});
};

test("três observações consecutivas permanecem associadas aos respectivos itemId",()=>{
  reset();fillThreeObservations();
  const responses=clone(context.state.checklistExecutions[0].responses);
  assert.deepEqual(responses.map(row=>row.itemId),["item-1","item-2","item-3"]);
  assert.deepEqual(responses.map(row=>row.note),observations);
});

test("respostas rápidas, medição e evidência não sobrescrevem outros itens",()=>{
  reset();
  context.updateChecklistExecutionResponse("execution-1","item-1",{answer:"Conforme",note:"Primeira"});
  context.updateChecklistExecutionResponse("execution-1","item-2",{answer:"Conforme",evidence:[{id:"ev-2",name:"foto.jpg"}]});
  context.updateChecklistExecutionResponse("execution-1","item-3",{answer:"18.75",note:"Medição estável"});
  context.updateChecklistExecutionResponse("execution-1","item-1",response=>({...response,note:"Primeira atualizada"}));
  const byItem=Object.fromEntries(clone(context.state.checklistExecutions[0].responses).map(row=>[row.itemId,row]));
  assert.equal(byItem["item-1"].answer,"Conforme");
  assert.equal(byItem["item-1"].note,"Primeira atualizada");
  assert.equal(byItem["item-2"].evidence[0].id,"ev-2");
  assert.equal(byItem["item-3"].answer,"18.75");
  assert.equal(byItem["item-3"].note,"Medição estável");
});

test("salvar, serializar e reabrir preserva respostas e observações",()=>{
  reset();fillThreeObservations();
  context.state.checklistExecutions[0].status="Rascunho";
  const persisted=JSON.parse(JSON.stringify(context.state.checklistExecutions[0]));
  const reopened=clone(context.normalizeChecklistExecution(persisted));
  assert.equal(reopened.status,"Rascunho");
  assert.deepEqual(reopened.responses.map(row=>row.note),observations);
  assert.deepEqual(reopened.responses.map(row=>row.answer),["Conforme","Conforme","12.5"]);
});

test("resumo contabiliza três observações e todos os itens conformes",()=>{
  reset();fillThreeObservations();
  const metrics=clone(context.checklistExecutionMetrics(context.state.checklistExecutions[0].responses));
  assert.deepEqual(metrics,{totalItems:3,conformCount:3,nonConformCount:0,notApplicableCount:0,observationCount:3,evidenceCount:0});
});

test("finalização preserva dados, mantém O.S. aberta e cria CHECKLIST_CONCLUIDO rico",async()=>{
  reset();fillThreeObservations();
  const completed=clone(await context.completeChecklistExecution("execution-1",2000)),order=clone(context.state.orders[0]),event=order.history[0];
  assert.deepEqual(completed.responses.map(row=>row.note),observations);
  assert.equal(completed.result,"Conforme com observações");
  assert.equal(completed.observationCount,3);
  assert.equal(order.status,"Aberta");
  assert.equal(event.type,"CHECKLIST_CONCLUIDO");
  assert.equal(event.tenantId,"tenant-a");
  assert.equal(event.workOrderId,"order-2");
  assert.equal(event.workOrderNumber,"O.S-0002");
  assert.equal(event.checklistExecutionId,"execution-1");
  assert.equal(event.checklistTemplateId,"check-1");
  assert.equal(event.maintenancePlanId,"plan-1");
  assert.equal(event.originPlanId,"plan-1");
  assert.equal(event.equipmentId,"asset-25");
  assert.equal(event.responsibleId,"resource-anderson");
  assert.equal(event.responsibleName,"Anderson Vieira");
  assert.equal(event.startedBy,"Fabricio Figueiredo");
  assert.equal(event.openedBy,"Fabricio Figueiredo");
  assert.equal(event.completedBy,"Fabricio Figueiredo");
  assert.equal(event.totalItems,3);
  assert.equal(event.conformCount,3);
  assert.equal(event.observationCount,3);
  assert.equal(event.immutable,true);
});

test("histórico diferencia checklist concluído de conclusão da O.S. e lê legado",()=>{
  assert.equal(context.orderAuditEventType({type:"CHECKLIST_CONCLUIDO",text:"Checklist CK-001 concluído"}),"CHECKLIST_CONCLUIDO");
  assert.equal(context.orderAuditEventType({type:"CONCLUSAO",text:"Checklist FASE 02 concluído com observações"}),"CHECKLIST_CONCLUIDO");
  assert.equal(context.orderAuditEventLabel({type:"CONCLUSAO",text:"Checklist FASE 02 concluído"}),"CHECKLIST CONCLUÍDO");
  assert.equal(context.orderAuditEventType({type:"CONCLUSAO",text:"O.S. finalizada pelo técnico"}),"CONCLUSAO");
});

test("replay não duplica evento de auditoria",async()=>{
  const existing={id:"audit-old",type:"CHECKLIST_CONCLUIDO",action:"CHECKLIST_CONCLUIDO",checklistExecutionId:"execution-1",text:"Checklist concluído",date:1500};
  reset(baseExecution(),baseOrder({history:[existing]}));fillThreeObservations();
  await context.completeChecklistExecution("execution-1",2000);
  assert.equal(context.state.orders[0].history.filter(row=>row.checklistExecutionId==="execution-1").length,1);
  await assert.rejects(()=>context.completeChecklistExecution("execution-1",2100),/CHECKLIST_EXECUTION_ALREADY_COMPLETED/);
  assert.equal(context.state.orders[0].history.length,1);
});

test("falha de persistência faz rollback completo",async()=>{
  reset();fillThreeObservations();
  const before=clone(context.state);context.remoteSaveResult=false;
  await assert.rejects(()=>context.completeChecklistExecution("execution-1",2000),/CHECKLIST_EXECUTION_PERSISTENCE_FAILED/);
  assert.deepEqual(clone(context.state),before);
});

test("tenant incompatível é bloqueado sem alterar execução ou O.S.",async()=>{
  reset(baseExecution({companyId:"tenant-b",tenantId:"tenant-b"}));
  const before=clone(context.state);
  await assert.rejects(()=>context.completeChecklistExecution("execution-1",2000),/CHECKLIST_TENANT_MISMATCH/);
  assert.deepEqual(clone(context.state),before);
});
