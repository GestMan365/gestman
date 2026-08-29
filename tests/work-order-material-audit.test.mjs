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
const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const context = {
  state:{},
  currentAccount:{ company:{ id:"tenant-a" }, user:{ id:"user-a", name:"Fabricio Figueiredo" } },
  normalizeTextKey:normalize,
  statusKey:normalize,
  byId:(rows, id) => (Array.isArray(rows) ? rows : []).find(item => item.id === id),
  normalizeQuantityForUnit:(_unit, value) => Number(value),
  normalizeQuantityForSpareId:(_id, value) => Number(value),
  formatQuantityForUnit:(value) => Number(value).toLocaleString("pt-BR", { maximumFractionDigits:4 }),
  formatDateTime:value => String(value),
  formatWorkedHours:value => `${value} h`,
  workLogHours:() => null,
  workLogTenantId:() => "tenant-a",
  orderWorkLogs:() => [],
  orderTabArray:(order, key) => Array.isArray(order?.[key]) ? order[key] : [],
  spareName:id => {
    const item = context.state.spareParts.find(row => row.id === id);
    return item ? `${item.code} - ${item.name}` : "Sem peça";
  },
  stockName:id => context.state.stockLocations.find(row => row.id === id)?.name || "Sem estoque",
  showToast:message => { context.lastToast = String(message || ""); },
  lastToast:"",
};
vm.createContext(context);
vm.runInContext([
  functionBody("stockMoveBalanceEffect"),
  functionBody("applyStockBalanceChange"),
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
  functionBody("materialUsageAlreadyRecorded"),
  functionBody("addMaterialUsageToOrder"),
  functionBody("commitMaterialUsageMovements"),
  functionBody("orderMaterialUsageEvents"),
  functionBody("orderAuditEvents"),
].join("\n"), context);

const reset = () => {
  context.lastToast = "";
  context.state = {
    profile:{ name:"Fabricio Figueiredo" },
    orders:[{ id:"os-1", number:"O.S-0001", history:[], materialsUsed:[], createdAt:1000 }],
    materialRequests:[{
      id:"req-1", number:"REQ-0001", orderId:"os-1", status:"Enviada", createdAt:2000,
      items:[{ id:"item-1", spareId:"part-1", stockId:"stock-1", quantity:1, deliveredQty:0 }]
    }],
    inventoryMovements:[],
    spareParts:[{ id:"part-1", code:"GFG-QA-MAT-001", name:"Peça QA", unit:"UN", balance:45 }],
    stockLocations:[{ id:"stock-1", code:"GFG-QA-ALMOX-CENTRAL", name:"Almoxarifado Central" }],
    maintenanceJournal:[],
  };
};
const movement = (overrides = {}) => ({
  id:"mov-33", itemId:"mov-item-33", number:"MOV-0033", type:"Saída", status:"Concluída",
  companyId:"tenant-a", tenantId:"tenant-a", orderId:"os-1", orderNumber:"O.S-0001",
  requestId:"req-1", requestNumber:"REQ-0001", requestItemId:"item-1",
  spareId:"part-1", partCode:"GFG-QA-MAT-001", partName:"Peça QA", unit:"UN",
  stockId:"stock-1", warehouseCode:"GFG-QA-ALMOX-CENTRAL", warehouseName:"Almoxarifado Central",
  quantity:1, balanceBefore:45, balanceAfter:44, owner:"Fabricio Figueiredo", user:"Fabricio Figueiredo",
  userId:"user-a", createdAt:3050, movedAt:3050, operationKey:"fulfillment:tenant-a:req-1:item-1:0",
  ...overrides,
});
const clone = value => JSON.parse(JSON.stringify(value));

test("criar, enviar, aprovar ou separar solicitação não cria PECA_UTILIZADA", () => {
  for (const status of ["Rascunho", "Enviada", "Em análise", "Aprovada", "Separação"]) {
    reset();
    context.state.materialRequests[0].status = status;
    const events = clone(context.orderAuditEvents(context.state.orders[0]));
    assert.equal(events.filter(item => item.type === "PECA_UTILIZADA").length, 0, `Evento antecipado no status ${status}`);
  }
});

test("baixa concluída cria um único evento rico, no horário real, sem REGISTRO", () => {
  reset();
  const result = clone(context.commitMaterialUsageMovements([movement()]));
  assert.equal(result.ok, true);
  assert.equal(context.state.spareParts[0].balance, 44);
  assert.equal(context.state.inventoryMovements.length, 1);
  const events = clone(context.orderAuditEvents(context.state.orders[0]));
  const usage = events.filter(item => item.type === "PECA_UTILIZADA");
  assert.equal(usage.length, 1);
  assert.equal(events.some(item => item.type === "REGISTRO"), false);
  assert.deepEqual({
    companyId:usage[0].companyId, orderId:usage[0].orderId, user:usage[0].user, date:usage[0].date,
    partId:usage[0].partId, partCode:usage[0].partCode, quantity:usage[0].quantity, unit:usage[0].unit,
    warehouseCode:usage[0].warehouseCode, requestNumber:usage[0].requestNumber,
    movementNumber:usage[0].movementNumber, balanceBefore:usage[0].balanceBefore, balanceAfter:usage[0].balanceAfter,
  }, {
    companyId:"tenant-a", orderId:"os-1", user:"Fabricio Figueiredo", date:3050,
    partId:"part-1", partCode:"GFG-QA-MAT-001", quantity:1, unit:"UN",
    warehouseCode:"GFG-QA-ALMOX-CENTRAL", requestNumber:"REQ-0001",
    movementNumber:"MOV-0033", balanceBefore:45, balanceAfter:44,
  });
  assert.match(context.orderAuditEventDescription(usage[0]), /REQ-0001/);
  assert.match(context.orderAuditEventDescription(usage[0]), /MOV-0033/);
  assert.match(context.orderAuditEventDescription(usage[0]), /45 → 44/);
});

test("repetir a mesma operação não duplica baixa nem evento", () => {
  reset();
  const sameBatch = clone(context.commitMaterialUsageMovements([movement(), movement({ id:"mov-same-batch" })]));
  assert.deepEqual(sameBatch, { ok:false, reason:"duplicate", movements:[] });
  assert.equal(context.state.spareParts[0].balance, 45);
  assert.equal(context.commitMaterialUsageMovements([movement()]).ok, true);
  const retry = clone(context.commitMaterialUsageMovements([movement({ id:"mov-retry" })]));
  assert.deepEqual(retry, { ok:false, reason:"duplicate", movements:[] });
  assert.equal(context.state.spareParts[0].balance, 44);
  assert.equal(context.state.inventoryMovements.length, 1);
  assert.equal(context.state.orders[0].history.filter(item => item.type === "PECA_UTILIZADA").length, 1);
});

test("falha em qualquer movimentação reverte o lote e não cria auditoria", () => {
  reset();
  const invalid = movement({ id:"mov-invalid", spareId:"missing-part", operationKey:"invalid-operation" });
  const result = clone(context.commitMaterialUsageMovements([movement(), invalid]));
  assert.deepEqual(result, { ok:false, reason:"stock", movements:[] });
  assert.equal(context.state.spareParts[0].balance, 45);
  assert.equal(context.state.inventoryMovements.length, 0);
  assert.equal(context.state.orders[0].history.length, 0);
});

test("histórico isola movimentos por tenant", () => {
  reset();
  context.state.inventoryMovements = [movement({ id:"foreign", companyId:"tenant-b", tenantId:"tenant-b", operationKey:"foreign" })];
  context.state.orders[0].history = [{ ...movement({ id:"foreign-history", companyId:"tenant-b", tenantId:"tenant-b" }), type:"PECA_UTILIZADA", date:3050 }];
  const events = clone(context.orderAuditEvents(context.state.orders[0]));
  assert.equal(events.some(item => item.type === "PECA_UTILIZADA"), false);
});

test("registro legado da baixa real continua visível e não duplica o movimento", () => {
  reset();
  context.state.orders[0].history = [{ date:3050, label:"Peça utilizada: GFG-QA-MAT-001 · 1", owner:"Fabricio Figueiredo" }];
  context.state.inventoryMovements = [movement()];
  let events = clone(context.orderAuditEvents(context.state.orders[0]));
  assert.equal(events.filter(item => item.type === "PECA_UTILIZADA").length, 1);
  assert.equal(events.some(item => item.type === "REGISTRO"), false);

  context.state.inventoryMovements = [];
  events = clone(context.orderAuditEvents(context.state.orders[0]));
  assert.equal(events.filter(item => item.type === "PECA_UTILIZADA").length, 1, "Registro legado sem MOV deve ser preservado");
});
