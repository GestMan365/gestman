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
const clone = value => JSON.parse(JSON.stringify(value));
const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const context = {
  state:{},
  currentAccount:{ company:{ id:"tenant-a" }, user:{ id:"admin-a", name:"Planejador A" } },
  candidates:[],
  remoteSaveResult:true,
  remoteSnapshot:null,
  saveCalls:0,
  uidSequence:0,
  normalizeTextKey:normalize,
  byId:(rows, id) => (Array.isArray(rows) ? rows : []).find(item => item.id === id),
  orderEligibleExecutorCandidates:() => context.candidates,
  planDateFromInput:value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? new Date(`${value}T12:00:00`) : null,
  planNextDates:(_plan, _count, execution) => [execution, "2026-09-29"],
  addDaysToPlanDate:() => "2026-09-29",
  planIntervalDays:() => 30,
  formatPlanDate:value => value,
  orderPersistenceIssue:order => !order.assetId ? "Selecione um equipamento." : (!order.executorIds?.length ? "Selecione pelo menos um executante." : ""),
  nextOrderNumberSafe:async () => "O.S-0001",
  uid:prefix => `${prefix}-${++context.uidSequence}`,
  saveState:() => { context.saveCalls += 1; },
  saveOrderSupabaseNow:async () => {
    context.remoteSnapshot = clone(context.state);
    return context.remoteSaveResult;
  },
  stage21TechnicalLog:() => {},
};
vm.createContext(context);
vm.runInContext([
  functionBody("planResponsible"),
  functionBody("preventivePlanCurrentTenantId"),
  functionBody("preventivePlanRecordTenantId"),
  functionBody("preventivePlanRecordBelongsToTenant"),
  functionBody("preventivePlanDurationHours"),
  functionBody("preventivePlanStoredExecutorIds"),
  functionBody("preventivePlanActiveExecutorCandidates"),
  functionBody("preventivePlanExecutorSnapshot"),
  functionBody("preventivePlanExecutionDate"),
  functionBody("preventivePlanHasGeneratedOrder"),
  functionBody("preventivePlanGenerationIssue"),
  functionBody("preventivePlanNextExecution"),
  functionBody("preventivePlanOrderType"),
  functionBody("buildPreventivePlanOrder"),
  functionBody("createPreventivePlanOrder"),
].join("\n"), context);

const techA = { id:"resource-a", kind:"resource", userId:"user-a", name:"Fabricio Figueiredo", code:"TEC-001", specialty:"Técnico mecânico", unit:"FASE 02", status:"Disponível", teamIds:["team-a"], teamNames:["Manutenção"], selectable:true };
const techB = { id:"user:user-b", kind:"user", userId:"user-b", name:"Executante B", code:"tec.b", specialty:"Técnico elétrico", unit:"FASE 02", status:"Disponível", teamIds:[], teamNames:[], selectable:true };

const basePlan = (overrides = {}) => ({
  id:"plan-1", companyId:"tenant-a", assetId:"asset-1", name:"FASE 02 - Preventiva mensal controlada",
  description:"Inspeção preventiva", maintenanceType:"Preventiva", priority:"Média",
  nextExecution:"2026-08-29", intervalDays:30, frequencyPreset:"monthly", status:"Ativo",
  responsibleId:"resource-a", responsibleName:"Fabricio Figueiredo", responsible:"Fabricio Figueiredo",
  executorIds:["user:user-b"], executorSnapshot:[], durationHours:1,
  checklistId:"check-1", plannedParts:[{ spareId:"part-1", quantity:2 }],
  documents:[{ id:"doc-1", name:"procedimento.pdf" }], history:[],
  ...overrides,
});

const reset = (plan = basePlan()) => {
  context.candidates = [techA, techB];
  context.remoteSaveResult = true;
  context.remoteSnapshot = null;
  context.saveCalls = 0;
  context.uidSequence = 0;
  context.state = {
    profile:{ name:"Planejador A" },
    assets:[{ id:"asset-1", code:"GFG-QA-EQP-025", name:"Equipamento QA" }],
    checklists:[{ id:"check-1", code:"CK-001", name:"FASE 02 - Inspeção preventiva", status:"Ativo" }],
    spareParts:[{ id:"part-1", code:"MAT-001", name:"Peça prevista" }],
    preventivePlans:[plan],
    orders:[],
  };
};

test("transfere responsável, executantes, duração, checklist, peça e tenant para a O.S.", () => {
  reset();
  const order = clone(context.buildPreventivePlanOrder(context.state.preventivePlans[0], "O.S-0001", 1000));
  assert.equal(order.companyId, "tenant-a");
  assert.equal(order.preventivePlanId, "plan-1");
  assert.equal(order.assetId, "asset-1");
  assert.equal(order.responsibleId, "resource-a");
  assert.equal(order.executor, "Fabricio Figueiredo");
  assert.deepEqual(new Set(order.executorIds), new Set(["resource-a", "user:user-b"]));
  assert.ok(order.executorIds.includes(order.responsibleId), "Responsável principal deve ser executante");
  assert.equal(order.plannedDurationHours, 1);
  assert.deepEqual(order.linkedChecklists, ["check-1"]);
  assert.equal(order.plannedSpareId, "part-1");
  assert.equal(order.plannedSpareQuantity, 2);
  assert.equal(order.attachments[0].name, "procedimento.pdf");
});

test("cria a O.S. exatamente uma vez e só então avança histórico e recorrência", async () => {
  reset();
  const order = clone(await context.createPreventivePlanOrder("plan-1", "2026-08-29"));
  assert.equal(order.number, "O.S-0001");
  assert.equal(context.state.orders.length, 1);
  assert.equal(context.state.preventivePlans[0].lastExecution, "2026-08-29");
  assert.equal(context.state.preventivePlans[0].nextExecution, "2026-09-29");
  assert.equal(context.state.preventivePlans[0].history.filter(item => item.type === "OS_GERADA").length, 1);
  assert.equal(context.remoteSnapshot.orders.length, 1, "A persistência deve receber O.S. e plano no mesmo estado");
  assert.equal(context.remoteSnapshot.preventivePlans[0].nextExecution, "2026-09-29");
  assert.equal(context.state.orders.length, 1);
  await assert.rejects(() => context.createPreventivePlanOrder("plan-1", "2026-08-29"), /PLAN_EXECUTION_CHANGED/);
  assert.equal(context.state.orders.length, 1, "Repetição da confirmação antiga não pode criar a próxima recorrência");
});

test("bloqueia duplicidade pelo plano e pela data programada", async () => {
  reset();
  context.state.orders.push({ id:"existing", number:"O.S-0009", companyId:"tenant-a", preventivePlanId:"plan-1", scheduledAt:"2026-08-29T08:00" });
  const before = clone(context.state);
  await assert.rejects(() => context.createPreventivePlanOrder("plan-1"), /PLAN_ORDER_DUPLICATE/);
  assert.deepEqual(clone(context.state), before);
  assert.equal(context.saveCalls, 0);
});

test("falha de persistência é atômica e não avança recorrência nem auditoria", async () => {
  reset();
  context.remoteSaveResult = false;
  const before = clone(context.state);
  await assert.rejects(() => context.createPreventivePlanOrder("plan-1"), /PLAN_ORDER_PERSISTENCE_FAILED/);
  assert.deepEqual(clone(context.state), before);
  assert.equal(context.saveCalls, 2, "Deve preparar a transação e persistir o rollback local");
});

test("isola plano e técnicos por tenant", () => {
  reset(basePlan({ companyId:"tenant-b" }));
  assert.equal(context.preventivePlanGenerationIssue(context.state.preventivePlans[0]), "PLAN_TENANT_MISMATCH");
  reset(basePlan({ executorIds:["foreign-tech"] }));
  assert.equal(context.preventivePlanGenerationIssue(context.state.preventivePlans[0]), "PLAN_EXECUTOR_INVALID");
});

test("plano legado continua legível, mas exige vínculo por ID para gerar", () => {
  reset(basePlan({ companyId:"", responsibleId:"", responsibleName:"", responsible:"Fabricio Figueiredo", executorIds:[] }));
  assert.equal(context.planResponsible(context.state.preventivePlans[0]), "Fabricio Figueiredo");
  assert.equal(context.preventivePlanGenerationIssue(context.state.preventivePlans[0]), "PLAN_RESPONSIBLE_REQUIRED");
});

test("duração de uma hora é numérica e formatos legados seguros continuam compatíveis", () => {
  assert.equal(context.preventivePlanDurationHours(1), 1);
  assert.equal(context.preventivePlanDurationHours("1 hora"), 1);
  assert.equal(context.preventivePlanDurationHours("1,5"), 1.5);
  assert.equal(context.preventivePlanDurationHours("inválido"), null);
});
