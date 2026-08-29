import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const functionBody = name => {
  const start = html.indexOf(`function ${name}`);
  const next = start < 0 ? -1 : html.indexOf("\n    function ", start + 12);
  assert.notEqual(start, -1, `Função ${name} ausente do frontend oficial`);
  return html.slice(start, next < 0 ? html.length : next);
};
const context = {
  state:{ maintenanceJournal:[], materialRequests:[], inventoryMovements:[], spareParts:[], stockLocations:[], orders:[], profile:{ name:"Técnico A" } },
  currentAccount:{ company:{ id:"tenant-a" }, user:{ id:"user-a", name:"Técnico A" } },
  normalizeTextKey:value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(),
  orderTabArray:(order, key) => Array.isArray(order?.[key]) ? order[key] : [],
  spareName:id => `Peça ${id}`,
  stockName:id => `Estoque ${id}`,
  byId:(rows, id) => rows.find(item => item.id === id),
  formatQuantityForUnit:value => String(value),
  formatDateTime:value => String(value),
};
vm.createContext(context);
vm.runInContext([
  functionBody("parseWorkedHoursInput"),
  functionBody("workedHoursValue"),
  functionBody("workLogHours"),
  functionBody("formatWorkedHours"),
  functionBody("currentWorkLogTenantId"),
  functionBody("workLogTenantId"),
  functionBody("workLogBelongsToTenant"),
  functionBody("isOrderWorkLog"),
  functionBody("isImmutableOrderWorkLog"),
  functionBody("orderWorkLogs"),
  functionBody("orderLoggedHours"),
  functionBody("currentWorkLogActor"),
  functionBody("workOrderChronologicalHours"),
  functionBody("workOrderEffectiveHours"),
  functionBody("workOrderTimeSummary"),
  functionBody("orderAuditTime"),
  functionBody("orderAuditStatusDetails"),
  functionBody("orderAuditEventType"),
  functionBody("orderAuditEventDescription"),
  functionBody("currentMaterialAuditTenantId"),
  functionBody("materialUsageTenantId"),
  functionBody("materialUsageBelongsToTenant"),
  functionBody("materialUsageMovementKey"),
  functionBody("isCompletedStockExit"),
  functionBody("isCompletedMaterialUsageMovement"),
  functionBody("materialUsageEventFromMovement"),
  functionBody("orderMaterialUsageEvents"),
  functionBody("orderAuditEvents"),
  functionBody("gmOrderTimeMs"),
  functionBody("gmEffectiveOrderHours"),
].join("\n"), context);

const parse = value => JSON.parse(JSON.stringify(context.parseWorkedHoursInput(value)));

test("aceita horas decimais com vírgula e ponto", () => {
  assert.deepEqual(parse("0,5"), { value:0.5, error:"" });
  assert.deepEqual(parse("1"), { value:1, error:"" });
  assert.deepEqual(parse("1,5"), { value:1.5, error:"" });
  assert.deepEqual(parse("2.25"), { value:2.25, error:"" });
});

test("rejeita zero preenchido, negativos, texto, NaN e excesso de 24 horas", () => {
  for (const value of ["0", "0,00", "-1", "abc", "NaN", "1,2,3", "24,01", "25", "1e2"]) {
    const result = parse(value);
    assert.equal(result.value, null, `Valor inválido aceito: ${value}`);
    assert.ok(result.error, `Mensagem ausente para: ${value}`);
  }
  assert.deepEqual(parse(""), { value:null, error:"" });
  assert.deepEqual(parse("24"), { value:24, error:"" });
});

test("soma múltiplos técnicos sem duplicar o mesmo apontamento", () => {
  const rows = [
    { id:"log-1", orderId:"os-1", companyId:"tenant-a", user:"Técnico A", workedHours:1.5 },
    { id:"log-2", orderId:"os-1", companyId:"tenant-a", user:"Técnico B", hours:"2,25" },
    { id:"log-2", orderId:"os-1", companyId:"tenant-a", user:"Técnico B", hours:"2,25" },
    { id:"other-order", orderId:"os-2", companyId:"tenant-a", workedHours:10 },
  ];
  assert.equal(context.orderWorkLogs("os-1", rows, "tenant-a").length, 2);
  assert.equal(context.orderLoggedHours("os-1", rows, "tenant-a"), 3.75);
});

test("isola apontamentos por empresa e preserva registros legados do estado já isolado", () => {
  const rows = [
    { id:"own", orderId:"os-1", companyId:"tenant-a", workedHours:1.5 },
    { id:"foreign", orderId:"os-1", companyId:"tenant-b", workedHours:9 },
    { id:"legacy", orderId:"os-1", hours:0.5 },
  ];
  assert.deepEqual(context.orderWorkLogs("os-1", rows, "tenant-a").map(item => item.id), ["own", "legacy"]);
  assert.equal(context.orderLoggedHours("os-1", rows, "tenant-a"), 2);
});

test("horas permanecem numéricas após serialização e recarregamento", () => {
  const original = { id:"log-1", orderId:"os-1", workedHours:parse("1,5").value, hours:parse("1,5").value, user:"Técnico A", createdAt:2000 };
  const reloaded = JSON.parse(JSON.stringify(original));
  assert.equal(typeof reloaded.workedHours, "number");
  assert.equal(reloaded.workedHours, 1.5);
  assert.equal(context.orderLoggedHours("os-1", [reloaded], "tenant-a"), 1.5);
});

test("histórico APONTAMENTO contém observação, horas, usuário e data", () => {
  context.state.maintenanceJournal = [{
    id:"log-1", orderId:"os-1", companyId:"tenant-a", description:"Inspeção e reaperto", workedHours:1.5, hours:1.5,
    user:"Técnico A", createdAt:2000, source:"order_work_log", auditEvent:true, immutable:true
  }];
  const events = JSON.parse(JSON.stringify(context.orderAuditEvents({ id:"os-1", createdAt:1000, history:[] })));
  const entry = events.find(item => item.type === "APONTAMENTO");
  assert.equal(entry.text, "Inspeção e reaperto");
  assert.equal(entry.workedHours, 1.5);
  assert.equal(entry.hours, 1.5);
  assert.equal(entry.user, "Técnico A");
  assert.equal(entry.date, 2000);
  assert.equal(entry.immutable, true);
  assert.match(context.orderAuditEventDescription(entry), /Horas: 1,5 h/);
  assert.match(context.orderAuditEventDescription(entry), /Usuário: Técnico A/);
});

test("duração cronológica, tempo efetivo e horas apontadas permanecem separados", () => {
  context.state.maintenanceJournal = [
    { id:"log-a", orderId:"os-1", companyId:"tenant-a", workedHours:1.5 },
    { id:"log-b", orderId:"os-1", companyId:"tenant-a", workedHours:2.25 },
  ];
  const order = { id:"os-1", startedAt:1000000, finishedAt:1000000 + 4 * 36e5, pauseHours:1.5 };
  const summary = JSON.parse(JSON.stringify(context.workOrderTimeSummary(order)));
  assert.deepEqual(summary, {
    chronologicalHours:4,
    effectiveHours:2.5,
    pausedHours:1.5,
    loggedHours:3.75,
  });
});

test("apontamentos da O.S. são imutáveis na interface comum", () => {
  assert.equal(context.isImmutableOrderWorkLog({ orderId:"os-1", title:"Apontamento da O.S." }), true);
  assert.equal(context.isImmutableOrderWorkLog({ source:"order_work_log" }), true);
  assert.equal(context.isImmutableOrderWorkLog({ auditEvent:true }), true);
  assert.equal(context.isImmutableOrderWorkLog({ title:"Registro operacional" }), false);
});
