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
  persistenceCalls:0,
  lastToast:"",
  MATERIAL_REQUEST_ORDER_ERRORS:Object.freeze({IMMUTABLE_STATUS:"WORK_ORDER_IMMUTABLE_BY_STATUS",TENANT_SCOPE:"MATERIAL_REQUEST_WORK_ORDER_TENANT_SCOPE_VIOLATION",NOT_FOUND:"MATERIAL_REQUEST_WORK_ORDER_NOT_FOUND",INVALID_STATUS:"MATERIAL_REQUEST_WORK_ORDER_STATUS_NOT_ALLOWED"}),
  MATERIAL_REQUEST_ALLOWED_ORDER_STATUSES:new Set(["aberta","em execucao","pausada","aguardando material"]),
  statusKey:normalize,
  normalizeTextKey:normalize,
  ptBrText:value => String(value || ""),
  byId:(rows, id) => (Array.isArray(rows) ? rows : []).find(item => item.id === id),
  roundStockValue:value => Math.round((Number(value) + Number.EPSILON) * 10000) / 10000,
  normalizeQuantityForSpareId:(_id, value) => Number(value || 0),
  normalizeQuantityForUnit:(_unit, value) => Number(value || 0),
  validOperationalDate:value => { const date = new Date(value); return Number.isNaN(date.getTime()) ? null : date; },
  accessProfileForUser:() => "admin",
  machineName:id => context.state.assets.find(item => item.id === id)?.name || "-",
  stockAlertStatus:part => ({ shortage:Math.max(0, Number(part.minimum || 0) - Number(part.balance || 0)) }),
  escapeHtml:value => String(value ?? ""),
  showToast:message => { context.lastToast = String(message || ""); },
  saveState:() => { context.persistenceCalls += 1; },
  render:() => {},
  $:() => null,
  openMaterialRequestDetail:() => {},
};
vm.createContext(context);
vm.runInContext([
  functionBody("stockMoveBalanceEffect"),
  functionBody("materialRequestBalanceEffect"),
  functionBody("addStockBalance"),
  functionBody("stockBalanceRows"),
  functionBody("currentMaterialAuditTenantId"),
  functionBody("materialUsageTenantId"),
  functionBody("materialUsageBelongsToTenant"),
  functionBody("materialRequestOrderTenantId"),
  functionBody("materialRequestOrderBelongsToTenant"),
  functionBody("materialRequestOrderAcceptsOperations"),
  functionBody("materialRequestOrderValidation"),
  functionBody("materialRequestOrderErrorMessage"),
  functionBody("assertMaterialRequestOrderWritable"),
  functionBody("guardMaterialRequestOrder"),
  functionBody("materialRequestItems"),
  functionBody("materialReservedQuantity"),
  functionBody("materialOrderOptions"),
  functionBody("updateMaterialRequestRecord"),
  functionBody("stage16Date"),
  functionBody("stage16ItemDate"),
  functionBody("stage16Text"),
  functionBody("stage16Responsible"),
  functionBody("stage16ScopedRows"),
  functionBody("stockLocationName"),
  functionBody("stage16MaterialRecordKeys"),
  functionBody("stage16MaterialMovementReportRow"),
  functionBody("stage16MovementReportRows"),
  functionBody("stage16StockPositionReportRows"),
  functionBody("stage16MaterialRequestReportRows"),
].join("\n"), context);
context.isClosedOrder = status => ["concluida", "cancelada"].includes(normalize(status));
context.spareName = id => {
  const part = context.state.spareParts.find(item => item.id === id);
  return part ? `${part.code} - ${part.name}` : "Sem peça";
};
context.stockName = id => context.state.stockLocations.find(item => item.id === id)?.name || "Sem estoque";
context.stage16Rows = kind => (Array.isArray(context.state[kind]) ? context.state[kind] : []).filter(item => context.materialUsageBelongsToTenant(item));

const clone = value => JSON.parse(JSON.stringify(value));
const reset = () => {
  context.persistenceCalls = 0;
  context.lastToast = "";
  context.state = {
    profile:{ name:"Fabricio Figueiredo" },
    orders:[
      { id:"os-open", number:"O.S-0003", companyId:"tenant-a", status:"Em execução", assetId:"asset-31" },
      { id:"os-paused", number:"O.S-0004", companyId:"tenant-a", status:"Pausada", assetId:"asset-31" },
      { id:"os-wait", number:"O.S-0005", companyId:"tenant-a", status:"Aguardando material", assetId:"asset-31" },
      { id:"os-closed", number:"O.S-0001", companyId:"tenant-a", status:"Concluída", assetId:"asset-31" },
      { id:"os-cancelled", number:"O.S-0002", companyId:"tenant-a", status:"Cancelada", assetId:"asset-31" },
      { id:"os-foreign", number:"O.S-9000", companyId:"tenant-b", status:"Aberta", assetId:"asset-31" },
    ],
    assets:[{ id:"asset-31", name:"GFG-QA-EQP-031" }],
    spareParts:[{ id:"part-31", companyId:"tenant-a", code:"GFG-QA-MAT-031", name:"Peça Fase 03", unit:"UN", balance:8, minimum:2 }],
    stockLocations:[
      { id:"central", name:"GFG-QA-ALMOX-CENTRAL" },
      { id:"mechanics", name:"GFG-QA-ALMOX-MECANICA" },
    ],
    inventoryMovements:[
      { id:"mov-35", number:"MOV-0035", companyId:"tenant-a", type:"Entrada", status:"Concluída", stockId:"central", spareId:"part-31", quantity:10, owner:"Fabricio Figueiredo", createdAt:"2026-08-29T10:00:00-03:00" },
      { id:"mov-transfer-mirror", number:"TR-0002", transferId:"tr-2", companyId:"tenant-a", type:"Transferência", status:"Concluída", originStockId:"central", destinationStockId:"mechanics", spareId:"part-31", quantity:3, createdAt:"2026-08-29T10:10:00-03:00" },
      { id:"mov-36", number:"MOV-0036", companyId:"tenant-a", type:"Saída", status:"Concluída", stockId:"central", spareId:"part-31", quantity:2, orderId:"os-open", owner:"Fabricio Figueiredo", createdAt:"2026-08-29T10:20:00-03:00" },
      { id:"mov-foreign", number:"MOV-9000", companyId:"tenant-b", type:"Entrada", status:"Concluída", stockId:"central", spareId:"part-31", quantity:99, createdAt:"2026-08-29T10:30:00-03:00" },
    ],
    stockTransfers:[
      { id:"tr-2", number:"TR-0002", companyId:"tenant-a", originId:"central", destinyId:"mechanics", spareId:"part-31", quantity:3, status:"Concluída", owner:"Fabricio Figueiredo", createdAt:"2026-08-29T10:10:00-03:00" },
      { id:"tr-2-replay", transferId:"tr-2", number:"TR-0002", companyId:"tenant-a", originId:"central", destinyId:"mechanics", spareId:"part-31", quantity:3, status:"Concluída", owner:"Fabricio Figueiredo", createdAt:"2026-08-29T10:10:00-03:00" },
      { id:"tr-foreign", number:"TR-9000", companyId:"tenant-b", originId:"central", destinyId:"mechanics", spareId:"part-31", quantity:50, status:"Concluída", createdAt:"2026-08-29T10:40:00-03:00" },
    ],
    materialRequests:[
      { id:"req-3", number:"REQ-0003", companyId:"tenant-a", orderId:"os-open", assetId:"asset-31", requester:"Anderson Vieira", priority:"Alta", status:"Atendida", attendant:"Fabricio Figueiredo", createdAt:"2026-08-29T10:15:00-03:00", items:[
        { id:"req-3-item-1", spareId:"part-31", stockId:"central", quantity:2, approvedQty:2, deliveredQty:2 },
        { id:"req-3-item-2", spareId:"part-31", stockId:"mechanics", quantity:5, approvedQty:3, deliveredQty:1 },
      ] },
      { id:"req-old", number:"REQ-0001", companyId:"tenant-a", orderId:"os-closed", requester:"Fabricio Figueiredo", status:"Atendida", createdAt:"2026-08-28T10:00:00-03:00", spareId:"part-old", stockId:"central", quantity:1, approvedQty:1, deliveredQty:1 },
      { id:"req-foreign", number:"REQ-9000", companyId:"tenant-b", orderId:"os-foreign", requester:"Outro tenant", status:"Atendida", createdAt:"2026-08-29T10:00:00-03:00", spareId:"part-31", quantity:99 },
    ],
  };
};

test("novas solicitações listam somente O.S. operacionais do tenant", () => {
  reset();
  const options = context.materialOrderOptions();
  assert.match(options, /O\.S-0003/);
  assert.match(options, /O\.S-0004/);
  assert.match(options, /O\.S-0005/);
  assert.doesNotMatch(options, /O\.S-0001/);
  assert.doesNotMatch(options, /O\.S-0002/);
  assert.doesNotMatch(options, /O\.S-9000/);
});

test("domínio bloqueia O.S. concluída, cancelada e de outro tenant antes de persistir", () => {
  reset();
  assert.equal(context.materialRequestOrderValidation("os-open").ok, true);
  assert.equal(context.materialRequestOrderValidation("os-closed").code, "WORK_ORDER_IMMUTABLE_BY_STATUS");
  assert.equal(context.materialRequestOrderValidation("os-cancelled").code, "WORK_ORDER_IMMUTABLE_BY_STATUS");
  assert.equal(context.materialRequestOrderValidation("os-foreign").code, "MATERIAL_REQUEST_WORK_ORDER_TENANT_SCOPE_VIOLATION");
  assert.throws(() => context.assertMaterialRequestOrderWritable("os-closed"), error => error.code === "WORK_ORDER_IMMUTABLE_BY_STATUS");
  const before = clone(context.state.materialRequests);
  assert.equal(context.updateMaterialRequestRecord("req-old", { status:"Enviada" }), false);
  assert.deepEqual(clone(context.state.materialRequests), before);
  assert.equal(context.persistenceCalls, 0);
});

test("solicitação antiga vinculada a O.S. encerrada permanece legível", () => {
  reset();
  const rows = clone(context.stage16MaterialRequestReportRows());
  assert.equal(rows.some(item => item.number === "REQ-0001" && item.order === "O.S-0001"), true);
  const legacyOption = context.materialOrderOptions("os-closed", true);
  assert.match(legacyOption, /O\.S-0001/);
  assert.match(legacyOption, /somente histórico/);
});

test("relatório de movimentações inclui TR-0002 uma vez e preserva MOV-0035/MOV-0036", () => {
  reset();
  const rows = clone(context.stage16MovementReportRows());
  assert.equal(rows.filter(item => item.number === "TR-0002").length, 1);
  assert.equal(rows.some(item => item.number === "MOV-0035" && item.type === "Entrada"), true);
  assert.equal(rows.some(item => item.number === "MOV-0036" && item.type === "Saída"), true);
  const transfer = rows.find(item => item.number === "TR-0002");
  assert.deepEqual({type:transfer.type,quantity:transfer.quantity,origin:transfer.origin,destination:transfer.destination,user:transfer.user,status:transfer.status},{type:"Transferência",quantity:3,origin:"GFG-QA-ALMOX-CENTRAL",destination:"GFG-QA-ALMOX-MECANICA",user:"Fabricio Figueiredo",status:"Concluída"});
  assert.equal(rows.some(item => item.number === "MOV-9000" || item.number === "TR-9000"), false);
});

test("posição de estoque mostra 5 central, 3 mecânico e total consolidado 8", () => {
  reset();
  const rows = clone(context.stage16StockPositionReportRows()).filter(item => item.code === "GFG-QA-MAT-031");
  assert.equal(rows.find(item => item.warehouse === "GFG-QA-ALMOX-CENTRAL")?.balance, 5);
  assert.equal(rows.find(item => item.warehouse === "GFG-QA-ALMOX-MECANICA")?.balance, 3);
  assert.equal(rows.find(item => item.level === "Total consolidado")?.balance, 8);
});

test("solicitações detalham múltiplos itens e atendimento parcial sem multiplicar totais", () => {
  reset();
  const rows = clone(context.stage16MaterialRequestReportRows()).filter(item => item.number === "REQ-0003");
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map(item => item.requested), [2, 5]);
  assert.equal(rows.reduce((sum, item) => sum + item.requested, 0), 7);
  assert.equal(rows.reduce((sum, item) => sum + item.approved, 0), 5);
  assert.equal(rows.reduce((sum, item) => sum + item.delivered, 0), 3);
  assert.equal(rows.reduce((sum, item) => sum + item.pending, 0), 2);
  assert.equal(rows[0].order, "O.S-0003");
  assert.equal(rows[0].equipment, "GFG-QA-EQP-031");
  assert.equal(rows[0].attendant, "Fabricio Figueiredo");
  assert.equal(rows.some(item => item.requester === "Outro tenant"), false);
});

test("REQ-0003 atendida integralmente resulta em pendente zero", () => {
  reset();
  context.state.materialRequests[0].items = [context.state.materialRequests[0].items[0]];
  const row = clone(context.stage16MaterialRequestReportRows()).find(item => item.number === "REQ-0003");
  assert.deepEqual({requested:row.requested,approved:row.approved,delivered:row.delivered,pending:row.pending},{requested:2,approved:2,delivered:2,pending:0});
});

test("escopo de relatórios preserva isolamento por tenant", () => {
  reset();
  const scoped = clone(context.stage16ScopedRows("materialRequests", context.state.materialRequests));
  assert.deepEqual(scoped.map(item => item.number), ["REQ-0003", "REQ-0001"]);
});
