import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
const fallbackHtml = fs.readFileSync(path.join(root, "404.html"), "utf8");
const results = [];

function test(name, condition) {
  assert.ok(condition, name);
  results.push(`OK - ${name}`);
}

function functionSource(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `função ${name} não encontrada`);
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (quote) {
      if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === "\"" || char === "'") {
      quote = char;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`fim da função ${name} não encontrado`);
}

test("index e fallback permanecem sincronizados", indexHtml === fallbackHtml);
test("botão de exclusão existe uma única vez", (indexHtml.match(/onclick="deleteOrder\('/g) || []).length === 1);
const adminButtonSource = functionSource(indexHtml, "orderAdminDeleteButton");
test("botão de exclusão depende de administrador", adminButtonSource.includes("!isAdminUser()"));
test("botão de exclusão é ocultado para O.S. encerrada", adminButtonSource.includes("isClosedOrder(order.status)"));
test("ação padrão incorpora o botão administrativo", indexHtml.includes("${baseOrderActionButtons(order)}${orderAdminDeleteButton(order)}"));

const deletionStart = indexHtml.indexOf("async function baseDeleteOrder(");
const deletionEnd = indexHtml.indexOf("async function deleteOrder(", deletionStart);
const deletionBlock = indexHtml.slice(deletionStart, deletionEnd);
test("execução da exclusão também exige administrador", deletionBlock.includes("if (!isAdminUser())"));
test("status e tenant são validados antes dos vínculos", deletionBlock.indexOf("workOrderDeletionDecision(order)") < deletionBlock.indexOf("orderDeletionLinks(id)"));
test("vínculos são verificados antes da remoção", deletionBlock.indexOf("orderDeletionLinks(id)") < deletionBlock.indexOf("state.orders = state.orders.filter"));
test("bloqueio não remove vínculos em cascata", !/state\.(?:checklistExecutions|downtimes|pendingActions|maintenanceJournal|materialRequests|inventoryMovements|toolLoans|measurements|documents|suppliers)\s*=/.test(deletionBlock));
test("confirmação destrutiva continua obrigatória", deletionBlock.includes("requestDestructiveConfirmation"));
test("mutação remota passa pelo serviço protegido", deletionBlock.includes("deleteWorkOrderService(order"));
test("erro específico de imutabilidade está definido", indexHtml.includes('IMMUTABLE_STATUS:"WORK_ORDER_IMMUTABLE_BY_STATUS"'));

const serviceSource = functionSource(indexHtml, "deleteWorkOrderService");
test("serviço valida antes de remover auditoria", serviceSource.indexOf("assertWorkOrderCanBeDeleted") < serviceSource.indexOf("deleteAuditEvents"));
test("serviço valida antes de remover a O.S.", serviceSource.indexOf("assertWorkOrderCanBeDeleted") < serviceSource.indexOf("deleteOrderRecord"));

const normalizeTextKey = value => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/\s+/g, " ")
  .trim();
const referenceSource = functionSource(indexHtml, "orderRecordReferences");
const orderRecordReferences = new Function("normalizeTextKey", `${referenceSource}; return orderRecordReferences;`)(normalizeTextKey);
const orderId = "order-qa-001";

test("detecta orderId direto", orderRecordReferences({ orderId }, orderId));
test("detecta referência aninhada", orderRecordReferences({ responses: [{ sourceOrderId: orderId }] }, orderId));
test("detecta vínculo documental por tipo e id", orderRecordReferences({ links: [{ type: "Ordem de Serviço", id: orderId }] }, orderId));
test("detecta vínculo workOrderId futuro", orderRecordReferences({ service: { workOrderId: orderId } }, orderId));
test("ignora registro sem vínculo", !orderRecordReferences({ orderId: "outra-os", links: [{ type: "Ativo", id: orderId }] }, orderId));
const cyclic = {};
cyclic.self = cyclic;
test("estrutura cíclica não quebra a verificação", !orderRecordReferences(cyclic, orderId));

console.log(results.join("\n"));
console.log(`\n${results.length} verificações concluídas.`);
