import assert from "node:assert/strict";
import fs from "node:fs";

const indexHtml = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const fallbackHtml = fs.readFileSync(new URL("../404.html", import.meta.url), "utf8");
const results = [];
const test = (name, condition) => { assert.ok(condition, name); results.push(`OK - ${name}`); };
const functionSource = name => {
  const syncStart = indexHtml.indexOf(`function ${name}(`);
  const asyncStart = indexHtml.indexOf(`async function ${name}(`);
  const start = asyncStart >= 0 && (syncStart < 0 || asyncStart < syncStart) ? asyncStart : syncStart;
  assert.notEqual(start, -1, `função ${name} não encontrada`);
  const boundaries = ["\n    function ", "\n    async function ", "\n    const "]
    .map(marker => indexHtml.indexOf(marker, start + 12))
    .filter(index => index >= 0);
  const next = boundaries.length ? Math.min(...boundaries) : -1;
  return indexHtml.slice(start, next < 0 ? indexHtml.length : next);
};

test("index e fallback permanecem sincronizados", indexHtml === fallbackHtml);
test("erro específico de imutabilidade é compartilhado", indexHtml.includes("IMMUTABLE_STATUS:WORK_ORDER_DELETION_ERRORS.IMMUTABLE_STATUS"));
test("gateway de domínio rejeita status encerrado", functionSource("assertWorkOrderMutable").includes("workOrderMutationDecision"));
test("serviço valida antes de alterar apontamentos", functionSource("addOrderWorkLogService").indexOf("assertWorkOrderMutable") < functionSource("addOrderWorkLogService").indexOf("entries.unshift"));
test("serviço cria apontamento auditável e imutável", functionSource("addOrderWorkLogService").includes("auditEvent:true") && functionSource("addOrderWorkLogService").includes("immutable:true"));
test("ação de apontamento some em O.S. encerrada", functionSource("orderWorkLogActionButton").includes("isClosedOrder(order.status)"));
test("aba de apontamentos usa ação protegida", functionSource("orderDetailTabContent").includes("orderWorkLogActionButton(order)"));
test("abertura e salvamento passam pela proteção", functionSource("addOrderObservation").includes("blockWorkOrderMutation") && functionSource("addOrderObservation").includes("addOrderWorkLogService"));
test("atalhos mobile somem em O.S. encerrada", functionSource("renderOrderDetail").includes('isClosedOrder(order.status) ? "" : `<div class="mobile-execution-shortcuts">'));
test("anexos mobile são protegidos", functionSource("openMobileOrderAttachment").includes("blockWorkOrderMutation") && functionSource("openMobileOrderAttachment").includes("assertWorkOrderMutable"));
test("materiais mobile são protegidos", functionSource("openMobilePartUsed").includes("blockWorkOrderMutation") && functionSource("openMobilePartUsed").includes("assertWorkOrderMutable"));
test("alterações extras passam pelo gateway", functionSource("updateOrderExtras").includes("assertWorkOrderMutable"));
test("edição principal passa pelo gateway", functionSource("persistValidatedOrderRecord").includes("assertWorkOrderMutable"));
test("editor detalhado desabilita escrita encerrada", functionSource("wireDetailTab").includes("isClosedOrder(currentOrder.status)") && functionSource("wireDetailTab").includes("control.disabled = true"));
test("formulário detalhado não salva ordem encerrada", functionSource("showOrderDetails").includes("blockWorkOrderMutation(currentOrder)") && functionSource("showOrderDetails").includes("orderReadOnly"));
test("materiais do editor detalhado são protegidos", functionSource("addOrderMaterialConsumption").includes("blockWorkOrderMutation") && functionSource("removeOrderMaterialConsumption").includes("blockWorkOrderMutation"));

console.log(results.join("\n"));
console.log(`\n${results.length} verificações concluídas.`);
