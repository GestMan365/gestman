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
  currentAccount:{ company:{ id:"tenant-a" } },
  isAdminUser:() => true,
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
  functionBody("createWorkOrderDeletionError"),
  functionBody("assertWorkOrderCanBeDeleted"),
  functionBody("deleteWorkOrderService"),
  functionBody("orderAdminDeleteButton"),
].join("\n"), context);

const closedOrder = (status = "Concluída", overrides = {}) => ({
  id:"os-1",
  number:"O.S-0001",
  status,
  companyId:"tenant-a",
  history:[{ id:"audit-1", type:"CRIACAO" }],
  workLogs:[{ id:"log-1", hours:1.5 }],
  materialsUsed:[{ id:"material-1", quantity:1 }],
  ...overrides,
});
const serviceAttempt = async order => {
  const calls = { audit:0, order:0 };
  const run = context.deleteWorkOrderService(order, {
    tenantId:"tenant-a",
    deleteAuditEvents:async () => { calls.audit += 1; return true; },
    deleteOrderRecord:async () => { calls.order += 1; return true; },
  });
  return { run, calls };
};
const immutableError = error => error?.code === "WORK_ORDER_IMMUTABLE_BY_STATUS" && error?.immutable === true;
const plain = value => JSON.parse(JSON.stringify(value));

test("O.S. concluída sem vínculos não pode ser excluída", async () => {
  const order = closedOrder();
  const before = structuredClone(order);
  const { run, calls } = await serviceAttempt(order);
  await assert.rejects(run, immutableError);
  assert.deepEqual(calls, { audit:0, order:0 });
  assert.deepEqual(order, before, "histórico, apontamentos e materiais devem permanecer intactos");
});

test("O.S. concluída com vínculos continua imutável", async () => {
  const order = closedOrder("Concluída", { links:[{ type:"material", id:"mov-1" }] });
  const { run, calls } = await serviceAttempt(order);
  await assert.rejects(run, immutableError);
  assert.deepEqual(calls, { audit:0, order:0 }, "remover vínculos não pode ser pré-requisito para a proteção por status");
});

test("O.S. cancelada não pode ser excluída", async () => {
  const { run, calls } = await serviceAttempt(closedOrder("Cancelada"));
  await assert.rejects(run, immutableError);
  assert.deepEqual(calls, { audit:0, order:0 });
});

test("botão de exclusão não é renderizado em estados encerrados", () => {
  assert.equal(context.orderAdminDeleteButton(closedOrder("Concluída")), "");
  assert.equal(context.orderAdminDeleteButton(closedOrder("Cancelada")), "");
  assert.match(context.orderAdminDeleteButton(closedOrder("Aberta")), /Excluir O\.S\./);
});

test("tentativa direta no serviço retorna erro específico de imutabilidade", async () => {
  const { run } = await serviceAttempt(closedOrder("Concluída"));
  await assert.rejects(run, error => {
    assert.equal(error.name, "WorkOrderDeletionError");
    assert.equal(error.code, "WORK_ORDER_IMMUTABLE_BY_STATUS");
    assert.equal(error.status, "Concluída");
    assert.match(error.message, /imutável/i);
    return true;
  });
});

test("isolamento entre tenants bloqueia mutação fora da empresa ativa", async () => {
  const foreign = closedOrder("Aberta", { companyId:"tenant-b" });
  const { run, calls } = await serviceAttempt(foreign);
  await assert.rejects(run, error => error?.code === "WORK_ORDER_TENANT_SCOPE_VIOLATION");
  assert.deepEqual(calls, { audit:0, order:0 });

  const own = await serviceAttempt(closedOrder("Aberta"));
  assert.deepEqual(plain(await own.run), { ok:true, code:"WORK_ORDER_DELETED", orderId:"os-1" });
  assert.deepEqual(own.calls, { audit:1, order:1 });
});

test("ordens abertas legadas sem tenant explícito permanecem compatíveis", async () => {
  const legacy = closedOrder("Aberta");
  delete legacy.companyId;
  const attempt = await serviceAttempt(legacy);
  assert.deepEqual(plain(await attempt.run), { ok:true, code:"WORK_ORDER_DELETED", orderId:"os-1" });
  assert.deepEqual(attempt.calls, { audit:1, order:1 });
});
