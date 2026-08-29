import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const functionBody = name => {
  const start = html.indexOf(`function ${name}`);
  const next = start < 0 ? -1 : html.indexOf("\n    function ", start + 12);
  assert.notEqual(start, -1, `Função ${name} ausente do frontend oficial`);
  const declarationStart = html.slice(Math.max(0, start - 6), start) === "async " ? start - 6 : start;
  return html.slice(declarationStart, next < 0 ? html.length : next);
};
const constantStart = html.indexOf("const CHECKLIST_EXECUTION_ERRORS");
const constantEnd = html.indexOf("\n    function checklistExecutionCurrentTenantId", constantStart);
assert.notEqual(constantStart, -1, "Contrato de erros do checklist ausente");
const clone = value => JSON.parse(JSON.stringify(value));
const context = {
  state:{},
  currentAccount:{ company:{ id:"tenant-a" }, user:{ id:"user-fabricio", firstName:"Fabricio", lastName:"Figueiredo", name:"Fabricio Figueiredo" } },
  remoteSaveResult:true,
  remoteSnapshot:null,
  saveCalls:0,
  uidSequence:0,
  byId:(rows,id)=>(Array.isArray(rows)?rows:[]).find(item=>item.id===id),
  checklistItems:model=>Array.isArray(model?.items)?model.items:[],
  orderRecordExecutorIds:order=>[...new Set([...(order.executorIds||[]),order.resourceId,...(order.participantIds||[]),...(order.executorSnapshot||[]).map(item=>item.id)].filter(Boolean))],
  isClosedOrder:status=>/^(conclu|finaliz|cancel)/i.test(String(status||"")),
  tenantUserDisplayName:user=>[user.firstName,user.lastName].filter(Boolean).join(" ")||user.name||user.username||"Usuário",
  gmOperationalUserById:()=>null,
  formatDateTime:value=>String(value),
  uid:prefix=>`${prefix}-${++context.uidSequence}`,
  saveState:()=>{context.saveCalls+=1},
  saveSingleSupabase:async()=>{context.remoteSnapshot=clone(context.state);return context.remoteSaveResult},
};
vm.createContext(context);
vm.runInContext([
  html.slice(constantStart,constantEnd),
  functionBody("checklistExecutionCurrentTenantId"),
  functionBody("checklistExecutionRecordTenantId"),
  functionBody("checklistExecutionBelongsToTenant"),
  functionBody("checklistExecutionOrderId"),
  functionBody("checklistExecutionTemplateId"),
  functionBody("checklistExecutorDisplayName"),
  functionBody("checklistOrderAssignment"),
  functionBody("checklistExecutionDuplicate"),
  functionBody("checklistExecutionStartIssue"),
  functionBody("buildChecklistExecution"),
  functionBody("createChecklistExecution"),
  functionBody("checklistExecutionCompletionIssue"),
  functionBody("checklistCompletionAuditEvent"),
  functionBody("completeChecklistExecution"),
].join("\n"),context);

const checklist = (overrides={}) => ({
  id:"check-1",companyId:"tenant-a",code:"CK-001",name:"FASE 02 - Inspeção preventiva",status:"Ativo",assetId:"asset-25",planId:"plan-1",
  items:[{id:"item-1",description:"Verificar condição",order:1,required:true}],sections:[],...overrides,
});
const order = (overrides={}) => ({
  id:"order-2",companyId:"tenant-a",number:"O.S-0002",status:"Aberta",assetId:"asset-25",preventivePlanId:"plan-1",linkedChecklists:["check-1"],
  responsibleId:"resource-anderson",executorIds:["resource-anderson"],executor:"Anderson Vieira",executorSnapshot:[{id:"resource-anderson",name:"Anderson Vieira",code:"TEC-002"}],history:[],...overrides,
});
const reset = ({model=checklist(),workOrder=order()}={}) => {
  context.remoteSaveResult=true;
  context.remoteSnapshot=null;
  context.saveCalls=0;
  context.uidSequence=0;
  context.state={profile:{name:"Fabricio Figueiredo"},resources:[],checklists:[model],orders:workOrder?[workOrder]:[],checklistExecutions:[]};
};

test("abertura pela O.S. transfere vínculo, técnico, executantes, equipamento, plano e checklist",async()=>{
  reset();
  const execution=clone(await context.createChecklistExecution("check-1",{orderId:"order-2",assetId:"asset-25",requireOrder:true,expectedOrderId:"order-2",startedAt:1000}));
  assert.equal(execution.workOrderId,"order-2");
  assert.equal(execution.orderId,"order-2");
  assert.equal(execution.workOrderNumber,"O.S-0002");
  assert.equal(execution.companyId,"tenant-a");
  assert.equal(execution.tenantId,"tenant-a");
  assert.equal(execution.assetId,"asset-25");
  assert.equal(execution.checklistTemplateId,"check-1");
  assert.equal(execution.originPlanId,"plan-1");
  assert.equal(execution.maintenancePlanId,"plan-1");
  assert.equal(execution.responsibleId,"resource-anderson");
  assert.equal(execution.responsibleName,"Anderson Vieira");
  assert.deepEqual(execution.executorIds,["resource-anderson"]);
  assert.equal(execution.startedById,"user-fabricio");
  assert.equal(execution.startedBy,"Fabricio Figueiredo");
  assert.notEqual(execution.startedById,execution.responsibleId,"Usuário iniciador não pode substituir o responsável técnico");
});

test("início direto pelo módulo continua aceitando execução sem O.S.",async()=>{
  reset({model:checklist({assetId:"",planId:""}),workOrder:null});
  const execution=clone(await context.createChecklistExecution("check-1",{assetId:"asset-25",responsible:"Técnico avulso",startedAt:1000}));
  assert.equal(execution.workOrderId,"");
  assert.equal(execution.responsible,"Técnico avulso");
  assert.equal(execution.startedBy,"Fabricio Figueiredo");
});

test("bloqueia tenant, O.S. encerrada, equipamento, checklist e plano incompatíveis",()=>{
  reset({workOrder:order({companyId:"tenant-b"})});
  assert.equal(context.checklistExecutionStartIssue(context.state.checklists[0],context.state.orders[0],"asset-25"),"CHECKLIST_TENANT_MISMATCH");
  reset({workOrder:order({status:"Concluída"})});
  assert.equal(context.checklistExecutionStartIssue(context.state.checklists[0],context.state.orders[0],"asset-25"),"CHECKLIST_ORDER_CLOSED");
  reset();
  assert.equal(context.checklistExecutionStartIssue(context.state.checklists[0],context.state.orders[0],"asset-25",{expectedOrderId:"order-other"}),"CHECKLIST_ORDER_MISMATCH");
  assert.equal(context.checklistExecutionStartIssue(context.state.checklists[0],context.state.orders[0],"other-asset"),"CHECKLIST_ASSET_MISMATCH");
  reset({workOrder:order({linkedChecklists:["check-other"]})});
  assert.equal(context.checklistExecutionStartIssue(context.state.checklists[0],context.state.orders[0],"asset-25"),"CHECKLIST_TEMPLATE_MISMATCH");
  reset({workOrder:order({preventivePlanId:"plan-other"})});
  assert.equal(context.checklistExecutionStartIssue(context.state.checklists[0],context.state.orders[0],"asset-25"),"CHECKLIST_PLAN_MISMATCH");
});

test("impede duplicidade e replay do mesmo checklist para a mesma O.S.",async()=>{
  reset();
  await context.createChecklistExecution("check-1",{orderId:"order-2",requireOrder:true,expectedOrderId:"order-2"});
  await assert.rejects(()=>context.createChecklistExecution("check-1",{orderId:"order-2",requireOrder:true,expectedOrderId:"order-2"}),/CHECKLIST_EXECUTION_DUPLICATE/);
  assert.equal(context.state.checklistExecutions.length,1);
});

test("falha de persistência reverte atomicamente o início",async()=>{
  reset();
  context.remoteSaveResult=false;
  const before=clone(context.state);
  await assert.rejects(()=>context.createChecklistExecution("check-1",{orderId:"order-2",requireOrder:true,expectedOrderId:"order-2"}),/CHECKLIST_EXECUTION_PERSISTENCE_FAILED/);
  assert.deepEqual(clone(context.state),before);
  assert.equal(context.saveCalls,2);
});

test("conclusão reflete na O.S. e cria auditoria imutável com papéis separados",async()=>{
  reset();
  const execution=await context.createChecklistExecution("check-1",{orderId:"order-2",requireOrder:true,expectedOrderId:"order-2",startedAt:1000});
  context.state.checklistExecutions[0].responses[0].answer="Conforme";
  context.state.checklistExecutions[0].responses[0].classification="Normal";
  const completed=clone(await context.completeChecklistExecution(execution.id,2000));
  const updatedOrder=clone(context.state.orders[0]);
  const event=updatedOrder.history.at(-1);
  assert.equal(completed.status,"Concluído");
  assert.deepEqual(updatedOrder.checklistExecutionIds,[execution.id]);
  assert.equal(event.type,"CHECKLIST_CONCLUIDO");
  assert.equal(event.checklistExecutionId,execution.id);
  assert.equal(event.responsibleId,"resource-anderson");
  assert.equal(event.startedById,"user-fabricio");
  assert.equal(event.user,"Fabricio Figueiredo");
  assert.equal(event.immutable,true);
});

test("falha ao concluir não deixa execução, O.S. ou indicador parcialmente atualizados",async()=>{
  reset();
  const execution=await context.createChecklistExecution("check-1",{orderId:"order-2",requireOrder:true,expectedOrderId:"order-2"});
  const before=clone(context.state);
  context.remoteSaveResult=false;
  await assert.rejects(()=>context.completeChecklistExecution(execution.id,2000),/CHECKLIST_EXECUTION_PERSISTENCE_FAILED/);
  assert.deepEqual(clone(context.state),before);
});

test("normalização preserva registros antigos e cria aliases de leitura",()=>{
  const normalizeContext={uid:prefix=>`${prefix}-legacy`};
  vm.createContext(normalizeContext);
  vm.runInContext(functionBody("normalizeChecklistExecution"),normalizeContext);
  const legacy=clone(normalizeContext.normalizeChecklistExecution({id:"legacy",checklistId:"check-1",orderId:"order-2",responsible:"Técnico legado",startedAt:1000,responses:[]}));
  assert.equal(legacy.checklistTemplateId,"check-1");
  assert.equal(legacy.workOrderId,"order-2");
  assert.equal(legacy.responsibleName,"Técnico legado");
});

test("declarações alteradas do frontend permanecem sintaticamente válidas",()=>{
  for(const name of ["normalizeChecklistExecution","orderDetailTabContent","openChecklistStart","createChecklistExecution","completeChecklistExecution","openChecklistExecution"]){
    assert.doesNotThrow(()=>new vm.Script(functionBody(name)),`Sintaxe inválida em ${name}`);
  }
});
