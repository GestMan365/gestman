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

const options = functionBody("materialOrderOptions");
const validation = functionBody("materialRequestOrderValidation");
const saveRequest = functionBody("saveMaterialRequest");
const updateRequest = functionBody("updateMaterialRequestRecord");
const fulfillment = functionBody("confirmMaterialFulfillment");
const movements = functionBody("stage16MovementReportRows");
const stock = functionBody("stage16StockPositionReportRows");
const requests = functionBody("stage16MaterialRequestReportRows");
const scoped = functionBody("stage16ScopedRows");
const reportRows = functionBody("stage16ReportRows");
const exportCsv = functionBody("stage16ExportCsv");
const printReport = functionBody("stage16PrintReport");

expect(options.includes("materialRequestOrderValidation"), "Seletor ainda não filtra O.S. pelo domínio operacional.");
expect(options.includes("preserveLegacy"), "Compatibilidade de leitura da solicitação antiga ausente.");
expect(validation.includes("MATERIAL_REQUEST_ORDER_ERRORS.IMMUTABLE_STATUS"), "Erro específico para O.S. encerrada ausente.");
expect(validation.includes("MATERIAL_REQUEST_ORDER_ERRORS.TENANT_SCOPE"), "Validação de tenant da O.S. ausente.");
expect(saveRequest.indexOf("guardMaterialRequestOrder") < saveRequest.indexOf("saveState()"), "Solicitação valida a O.S. somente depois de persistir.");
expect(updateRequest.indexOf("guardMaterialRequestOrder") < updateRequest.indexOf("saveState()"), "Gateway de atualização persiste antes de validar a O.S.");
expect(fulfillment.indexOf("guardMaterialRequestOrder") < fulfillment.indexOf("commitMaterialUsageMovements"), "Atendimento valida a O.S. somente depois da baixa.");
expect(movements.includes('stage16Rows("stockTransfers")'), "Relatório de movimentações não lê transferências.");
expect(movements.includes("transferKeys"), "Deduplicação de transferências ausente.");
expect(stock.includes("stockBalanceRows()"), "Posição não usa saldos por almoxarifado.");
expect(stock.includes('level:"Total consolidado"'), "Total consolidado não é exibido na posição.");
expect(requests.includes("materialRequestItems(request)"), "Solicitações não expandem múltiplos itens.");
expect(requests.includes("approved") && requests.includes("delivered") && requests.includes("pending"), "Quantidades detalhadas da solicitação ausentes.");
expect(requests.includes("attendant"), "Responsável pelo atendimento ausente.");
expect(scoped.includes("materialUsageBelongsToTenant"), "Relatórios não isolam registros por tenant.");
expect(reportRows.includes('type==="movements"') && reportRows.includes('type==="stock"') && reportRows.includes('type==="requests"'), "Relatórios materiais não usam as fontes normalizadas.");
expect(exportCsv.includes("stage16ReportRows()") && exportCsv.includes("def.columns"), "CSV não reutiliza linhas e colunas oficiais.");
expect(printReport.includes("stage16ReportRows()"), "Impressão não reutiliza o relatório filtrado.");
expect(html.includes('["Solicitado","requested"]') && html.includes('["Atendido por","attendant"]'), "Colunas completas de solicitações ausentes.");
expect(html.includes('["Número","number"]') && html.includes('["Status","status"]'), "Número/status de movimentação ausentes.");
expect(html === fallback, "index.html e 404.html não estão sincronizados.");

if (failures.length) {
  console.error(failures.map(item => `- ${item}`).join("\n"));
  process.exit(1);
}
console.log("Fase 03 — materiais e relatórios: validação estática aprovada.");
