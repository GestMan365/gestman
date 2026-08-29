import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const functionBody = name => {
  const syncStart = html.indexOf(`function ${name}(`);
  const asyncStart = html.indexOf(`async function ${name}(`);
  const start = asyncStart >= 0 && (syncStart < 0 || asyncStart < syncStart) ? asyncStart : syncStart;
  assert.notEqual(start, -1, `Função ${name} ausente do frontend oficial`);
  const boundaries = ["\n    function ", "\n    async function ", "\n    const "]
    .map(marker => html.indexOf(marker, start + 12))
    .filter(index => index >= 0);
  const next = boundaries.length ? Math.min(...boundaries) : -1;
  return html.slice(start, next < 0 ? html.length : next);
};
const constantBody = (name, nextFunction) => {
  const start = html.indexOf(`const ${name} =`);
  const end = html.indexOf(`\n    function ${nextFunction}(`, start);
  assert.notEqual(start, -1, `Constante ${name} ausente do frontend oficial`);
  assert.notEqual(end, -1, `Fim da constante ${name} não encontrado`);
  return html.slice(start, end);
};

const context = {
  currentAccount:{ company:{ id:"tenant-a" }, user:{ id:"user-a", name:"Técnico A" } },
  state:{ profile:{ name:"Técnico A" } },
  uid:prefix => `${prefix}-generated`,
  localDateTimeValue:value => `local:${value}`,
};
vm.createContext(context);
vm.runInContext([
  functionBody("statusKey"),
  functionBody("isClosedOrder"),
  constantBody("WORK_ORDER_DELETION_ERRORS", "currentWorkOrderDeletionTenantId"),
  functionBody("currentWorkOrderDeletionTenantId"),
  functionBody("workOrderDeletionTenantId"),
  functionBody("workOrderDeletionBelongsToTenant"),
  functionBody("workOrderDeletionDecision"),
  constantBody("WORK_ORDER_MUTATION_ERRORS", "workOrderMutationDecision"),
  functionBody("workOrderMutationDecision"),
  functionBody("createWorkOrderMutationError"),
  functionBody("assertWorkOrderMutable"),
  functionBody("parseWorkedHoursInput"),
  functionBody("workedHoursValue"),
  functionBody("workLogHours"),
  functionBody("currentWorkLogTenantId"),
  functionBody("workLogTenantId"),
  functionBody("workLogBelongsToTenant"),
  functionBody("orderWorkLogs"),
  functionBody("orderLoggedHours"),
  functionBody("currentWorkLogActor"),
  functionBody("addOrderWorkLogService"),
  functionBody("orderWorkLogActionButton"),
].join("\n"), context);

const plain = value => JSON.parse(JSON.stringify(value));
const immutableError = error => error?.name === "WorkOrderMutationError"
  && error?.code === "WORK_ORDER_IMMUTABLE_BY_STATUS"
  && error?.immutable === true;
const order = (status, overrides = {}) => ({
  id:"os-1",
  number:"O.S-0001",
  status,
  companyId:"tenant-a",
  assetId:"asset-1",
  history:[{ id:"history-1", type:"CRIACAO", text:"O.S. criada" }],
  ...overrides,
});
const existingLog = () => ({
  id:"log-existing",
  orderId:"os-1",
  companyId:"tenant-a",
  description:"Apontamento existente",
  workedHours:1.5,
  hours:1.5,
  auditEvent:true,
  immutable:true,
});
const attempt = (targetOrder, entries) => context.addOrderWorkLogService(targetOrder, {
  id:"log-new",
  description:"Tentativa de novo apontamento",
  workedHours:0.5,
}, {
  entries,
  tenantId:"tenant-a",
  actor:"Técnico A",
  userId:"user-a",
  now:5000,
  occurredAt:"2026-08-29T12:00",
});

test("O.S. concluída não aceita apontamento e preserva todos os dados", () => {
  const target = order("Concluída");
  const entries = [existingLog()];
  const beforeOrder = plain(target);
  const beforeEntries = plain(entries);
  const beforeHours = context.orderLoggedHours(target.id, entries, "tenant-a");
  assert.throws(() => attempt(target, entries), immutableError);
  assert.deepEqual(target, beforeOrder);
  assert.deepEqual(entries, beforeEntries);
  assert.equal(context.orderLoggedHours(target.id, entries, "tenant-a"), beforeHours);
  assert.equal(entries.some(item => item.id === "log-new" || item.auditEvent && item.description === "Tentativa de novo apontamento"), false);
});

test("O.S. cancelada não aceita apontamento", () => {
  const entries = [existingLog()];
  assert.throws(() => attempt(order("Cancelada"), entries), immutableError);
  assert.deepEqual(entries, [existingLog()]);
});

test("botão de apontamento fica ausente em estados encerrados", () => {
  assert.equal(context.orderWorkLogActionButton(order("Concluída")), "");
  assert.equal(context.orderWorkLogActionButton(order("Cancelada")), "");
  assert.match(context.orderWorkLogActionButton(order("Em execução")), /Adicionar apontamento/);
});

test("O.S. em execução continua aceitando apontamento e horas", () => {
  const entries = [existingLog()];
  const result = plain(attempt(order("Em execução"), entries));
  assert.equal(result.ok, true);
  assert.equal(result.code, "WORK_ORDER_WORK_LOG_CREATED");
  assert.equal(entries.length, 2);
  assert.equal(entries[0].workedHours, 0.5);
  assert.equal(entries[0].hours, 0.5);
  assert.equal(entries[0].auditEvent, true);
  assert.equal(entries[0].immutable, true);
  assert.equal(context.orderLoggedHours("os-1", entries, "tenant-a"), 2);
});

test("tenant permanece isolado em tentativa programática", () => {
  const entries = [existingLog()];
  const before = plain(entries);
  assert.throws(
    () => attempt(order("Em execução", { companyId:"tenant-b" }), entries),
    error => error?.code === "WORK_ORDER_TENANT_SCOPE_VIOLATION"
  );
  assert.deepEqual(entries, before);
});

test("gateway de domínio bloqueia qualquer mutação de ordem encerrada", () => {
  assert.throws(() => context.assertWorkOrderMutable(order("Concluída"), "tenant-a"), immutableError);
  assert.throws(() => context.assertWorkOrderMutable(order("Cancelada"), "tenant-a"), immutableError);
  assert.equal(context.assertWorkOrderMutable(order("Aberta"), "tenant-a").allowed, true);
});
