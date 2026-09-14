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
  canManage:true,
  uidSequence:0,
  normalizeTextKey:normalize,
  preventiveCanManage:() => context.canManage,
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
  "const preventivePlanOrderTransactions = new Set();",
  functionBody("planResponsible"),
  functionBody("preventivePlanCurrentTenantId"),
  functionBody("preventivePlanRecordTenantId"),
  functionBody("preventivePlanRecordBelongsToTenant"),
  functionBody("preventivePlanDurationHours"),
  functionBody("preventivePlanDurationLabel"),
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
  context.currentAccount = { company:{ id:"tenant-a" }, user:{ id:"admin-a", name:"Planejador A" } };
  context.canManage = true;
  context.nextOrderNumberSafe = async () => "O.S-0001";
  context.saveOrderSupabaseNow = async () => {
    context.remoteSnapshot = clone(context.state);
    return context.remoteSaveResult;
  };
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

test("detalhe usa duração numérica, preserva legado e não inventa horas ausentes", () => {
  assert.equal(context.preventivePlanDurationLabel({ durationHours:1 }), "1 h");
  assert.equal(context.preventivePlanDurationLabel({ durationHours:1.5, duration:"9 horas" }), "1,5 h");
  assert.equal(context.preventivePlanDurationLabel({ duration:"2 horas" }), "2 h");
  for (const plan of [{}, { durationHours:0 }, { durationHours:-1 }, { duration:"inválida" }]) {
    assert.equal(context.preventivePlanDurationLabel(plan), "Sem dados");
  }
});

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
};

test("plano pausado não gera O.S. nem altera recorrência", async () => {
  reset(basePlan({ status:"Pausado" }));
  const before = clone(context.state);
  await assert.rejects(() => context.createPreventivePlanOrder("plan-1"), /PLAN_PAUSED/);
  assert.deepEqual(clone(context.state), before);
  assert.equal(context.saveCalls, 0);
});

test("a função de domínio exige sessão e permissão, mesmo sem o botão", async () => {
  reset();
  context.canManage = false;
  await assert.rejects(() => context.createPreventivePlanOrder("plan-1"), /PLAN_PERMISSION_DENIED/);
  context.canManage = true;
  context.currentAccount = null;
  await assert.rejects(() => context.createPreventivePlanOrder("plan-1"), /PLAN_CONTEXT_REQUIRED/);
  assert.equal(context.saveCalls, 0);
});

test("chamadas concorrentes sem data explícita não geram duas recorrências", async () => {
  reset();
  const number = deferred();
  context.nextOrderNumberSafe = () => number.promise;
  const first = context.createPreventivePlanOrder("plan-1");
  const second = context.createPreventivePlanOrder("plan-1");
  const rejected = assert.rejects(second, /PLAN_GENERATION_BUSY/);
  number.resolve("O.S-0001");
  await Promise.all([first, rejected]);
  assert.equal(context.state.orders.length, 1);
  assert.equal(context.state.preventivePlans[0].history.length, 1);
});

test("uma geração pendente bloqueia outro plano do mesmo estado compartilhado", { timeout:2000 }, async t => {
  reset();
  context.state.preventivePlans.push(basePlan({ id:"plan-2" }));
  const saved = deferred();
  t.after(() => saved.resolve(false));
  const started = deferred();
  context.saveOrderSupabaseNow = () => { started.resolve(); return saved.promise; };
  const first = context.createPreventivePlanOrder("plan-1");
  await started.promise;
  await assert.rejects(() => context.createPreventivePlanOrder("plan-2"), /PLAN_GENERATION_BUSY/);
  saved.resolve(true);
  await first;
  assert.equal(context.state.orders.length, 1);
  assert.equal(context.state.preventivePlans[1].lastExecution, undefined);
});

test("data alterada durante a numeração exige nova confirmação mesmo sem argumento", async () => {
  reset();
  context.nextOrderNumberSafe = async () => {
    context.state.preventivePlans[0].nextExecution = "2026-09-01";
    return "O.S-0001";
  };
  await assert.rejects(() => context.createPreventivePlanOrder("plan-1"), /PLAN_EXECUTION_CHANGED/);
  assert.equal(context.state.orders.length, 0);
  assert.equal(context.state.preventivePlans[0].nextExecution, "2026-09-01");
  assert.equal(context.saveCalls, 0);
});

for (const change of ["tenant", "user", "state", "permission", "paused"]) {
  test(`revalida ${change} após aguardar numeração`, async () => {
    reset();
    context.nextOrderNumberSafe = async () => {
      if (change === "tenant") context.currentAccount.company.id = "tenant-b";
      if (change === "user") context.currentAccount.user.id = "admin-b";
      if (change === "state") context.state = clone(context.state);
      if (change === "permission") context.canManage = false;
      if (change === "paused") context.state.preventivePlans[0].status = "Pausado";
      return "O.S-0001";
    };
    const expected = change === "permission" ? /PLAN_PERMISSION_DENIED/ : change === "paused" ? /PLAN_PAUSED/ : /PLAN_CONTEXT_CHANGED/;
    await assert.rejects(() => context.createPreventivePlanOrder("plan-1"), expected);
    assert.equal(context.state.orders.length, 0);
    assert.equal(context.saveCalls, 0);
  });
}

test("rollback preserva O.S., planos e edições concorrentes não pertencentes à geração", async () => {
  reset();
  const previousPlan = clone(context.state.preventivePlans[0]);
  context.saveOrderSupabaseNow = async () => {
    context.state.orders.push({ id:"manual-order", title:"Criada em outro fluxo" });
    context.state.preventivePlans.push(basePlan({ id:"plan-2" }));
    context.state.preventivePlans[0] = {
      ...context.state.preventivePlans[0], name:"Nome editado", updatedAt:1234,
      history:[...context.state.preventivePlans[0].history, { id:"edit", type:"EDITADO" }],
    };
    throw new Error("NETWORK_FAILURE");
  };
  await assert.rejects(() => context.createPreventivePlanOrder("plan-1"), /NETWORK_FAILURE/);
  assert.deepEqual(clone(context.state.orders), [{ id:"manual-order", title:"Criada em outro fluxo" }]);
  assert.equal(context.state.preventivePlans.length, 2);
  const plan = context.state.preventivePlans[0];
  assert.equal(plan.name, "Nome editado");
  assert.equal(plan.updatedAt, 1234);
  assert.equal(plan.nextExecution, previousPlan.nextExecution);
  assert.equal(plan.lastExecution, undefined);
  assert.deepEqual(clone(plan.history), [{ id:"edit", type:"EDITADO" }]);
});

test("falha tardia não restaura dados da empresa anterior na nova sessão", async () => {
  reset();
  let nextState;
  context.saveOrderSupabaseNow = async () => {
    context.currentAccount = { company:{ id:"tenant-b" }, user:{ id:"admin-b" } };
    nextState = { orders:[{ id:"tenant-b-order" }], preventivePlans:[] };
    context.state = nextState;
    return false;
  };
  await assert.rejects(() => context.createPreventivePlanOrder("plan-1"), /PLAN_ORDER_PERSISTENCE_FAILED/);
  assert.equal(context.state, nextState);
  assert.deepEqual(clone(context.state.orders), [{ id:"tenant-b-order" }]);
  assert.equal(context.saveCalls, 1, "Não salvar rollback na sessão de outra empresa");
});

test("falha libera o bloqueio e permite repetir a mesma ocorrência", async () => {
  reset();
  context.remoteSaveResult = false;
  await assert.rejects(() => context.createPreventivePlanOrder("plan-1"), /PLAN_ORDER_PERSISTENCE_FAILED/);
  context.remoteSaveResult = true;
  const order = await context.createPreventivePlanOrder("plan-1");
  assert.equal(order.preventivePlanExecutionDate, "2026-08-29");
  assert.equal(context.state.orders.length, 1);
  assert.equal(context.state.preventivePlans[0].history.length, 1);
});

test("erro na numeração libera o bloqueio sem alterar plano ou O.S.", async () => {
  reset();
  const before = clone(context.state);
  context.nextOrderNumberSafe = async () => { throw new Error("NUMBER_FAILED"); };
  await assert.rejects(() => context.createPreventivePlanOrder("plan-1"), /NUMBER_FAILED/);
  assert.deepEqual(clone(context.state), before);
  assert.equal(context.saveCalls, 0);
  context.nextOrderNumberSafe = async () => "O.S-0001";
  await context.createPreventivePlanOrder("plan-1");
  assert.equal(context.state.orders.length, 1);
});

test("sucesso tardio após troca de sessão não informa sucesso nem desfaz gravação confirmada", async () => {
  reset();
  let nextState;
  context.saveOrderSupabaseNow = async () => {
    context.currentAccount = { company:{ id:"tenant-b" }, user:{ id:"admin-b" } };
    nextState = { orders:[], preventivePlans:[] };
    context.state = nextState;
    return true;
  };
  await assert.rejects(() => context.createPreventivePlanOrder("plan-1"), /PLAN_CONTEXT_CHANGED/);
  assert.equal(context.state, nextState);
  assert.equal(context.saveCalls, 1);
});

test("rollback não sobrescreve uma nova data definida durante a espera", async () => {
  reset();
  context.saveOrderSupabaseNow = async () => {
    context.state.preventivePlans[0].nextExecution = "2026-10-10";
    return false;
  };
  await assert.rejects(() => context.createPreventivePlanOrder("plan-1"), /PLAN_ORDER_PERSISTENCE_FAILED/);
  assert.equal(context.state.preventivePlans[0].nextExecution, "2026-10-10");
  assert.equal(context.state.orders.length, 0);
});
