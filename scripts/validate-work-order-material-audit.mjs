import fs from "node:fs";

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const html = read("index.html");
const fallback = read("404.html");
const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };
const functionBody = name => {
  const start = html.indexOf(`function ${name}`);
  const next = start < 0 ? -1 : html.indexOf("\n    function ", start + 12);
  return start < 0 ? "" : html.slice(start, next < 0 ? html.length : next);
};

expect(!functionBody("orderAuditEvents").includes("state.materialRequests.filter"), "Histórico ainda fabrica utilização a partir da solicitação.");
expect(functionBody("orderAuditEvents").includes("orderMaterialUsageEvents"), "Histórico não usa movimentações concluídas como fonte.");
expect(functionBody("orderAuditEventType").includes('"PECA_UTILIZADA"'), "Tipo canônico PECA_UTILIZADA ausente.");
expect(functionBody("materialUsageEventFromMovement").includes("movementNumber"), "Número MOV não é armazenado no evento.");
expect(functionBody("materialUsageEventFromMovement").includes("requestNumber"), "Número REQ não é armazenado no evento.");
expect(functionBody("materialUsageEventFromMovement").includes("balanceBefore"), "Saldo anterior não é armazenado no evento.");
expect(functionBody("materialUsageEventFromMovement").includes("balanceAfter"), "Saldo posterior não é armazenado no evento.");
expect(functionBody("materialUsageEventFromMovement").includes("warehouseName"), "Almoxarifado não é armazenado no evento.");
expect(functionBody("materialUsageEventFromMovement").includes("companyId"), "Tenant não é armazenado no evento.");
expect(functionBody("commitMaterialUsageMovements").includes("materialUsageAlreadyRecorded"), "Proteção idempotente da movimentação ausente.");
expect(functionBody("commitMaterialUsageMovements").includes("state.spareParts=previousSpareParts"), "Rollback atômico de saldo ausente.");
expect(functionBody("confirmMaterialFulfillment").includes("await saveSingleSupabase()"), "Atendimento não aguarda confirmação da persistência.");
expect(functionBody("confirmMaterialFulfillment").includes("Nenhuma baixa nem evento de utilização foi gravado"), "Falha de persistência não informa rollback.");
expect(functionBody("confirmMaterialFulfillment").includes("requestItemId"), "Chave do item solicitado ausente da baixa.");
expect(functionBody("confirmMaterialFulfillment").includes("operationKey"), "Chave idempotente do atendimento ausente.");
expect(functionBody("saveMaterialRequest").includes('status:mode==="draft"?"Rascunho":"Enviada"'), "Fluxo de criação/envio da solicitação foi alterado indevidamente.");
expect(html === fallback, "index.html e 404.html não estão sincronizados.");

if (failures.length) {
  console.error(failures.map(item => `- ${item}`).join("\n"));
  process.exit(1);
}
console.log("Auditoria de materiais da O.S.: validação estática aprovada.");
