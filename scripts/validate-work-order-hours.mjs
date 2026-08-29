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

expect(functionBody("parseWorkedHoursInput").includes('replace(",", ".")'), "Entrada de horas não trata vírgula decimal.");
expect(functionBody("parseWorkedHoursInput").includes("numeric <= 0"), "Zero e valores negativos não são rejeitados.");
expect(functionBody("parseWorkedHoursInput").includes("numeric > maxHours"), "Horas excessivas não são rejeitadas.");
expect(functionBody("orderLoggedHours").includes("orderWorkLogs"), "Total de horas não usa os apontamentos isolados da O.S.");
expect(functionBody("orderWorkLogs").includes("seen.has"), "Total de horas não evita duplicidade de apontamentos.");
expect(functionBody("orderWorkLogs").includes("workLogBelongsToTenant"), "Apontamentos não são filtrados por tenant.");
expect(functionBody("addOrderObservation").includes("workedHours:parsedHours.value"), "Horas não são persistidas como número decimal.");
expect(functionBody("addOrderWorkLogService").includes('source:"order_work_log"'), "Origem auditável do apontamento ausente.");
expect(functionBody("addOrderWorkLogService").includes("companyId:tenantId"), "Tenant não é registrado no apontamento.");
expect(functionBody("addOrderWorkLogService").includes("user:actor"), "Usuário não é registrado no apontamento.");
expect(functionBody("addOrderObservation").includes("workLogSaveLocks"), "Proteção contra apontamento duplicado ausente.");
expect(functionBody("orderDetailTabContent").includes("Total de horas apontadas"), "Total de horas não é exibido na O.S.");
expect(functionBody("orderDetailTabContent").includes("Tempo trabalhado:"), "Tempo individual não é exibido no apontamento.");
expect(functionBody("orderAuditEvents").includes("workedHours:workLogHours"), "Histórico APONTAMENTO não recebe as horas.");
expect(functionBody("orderAuditEventDescription").includes('item.type === "APONTAMENTO"'), "Histórico não apresenta as horas do apontamento.");
expect(functionBody("workOrderTimeSummary").includes("chronologicalHours"), "Duração cronológica não está separada.");
expect(functionBody("workOrderTimeSummary").includes("effectiveHours"), "Tempo efetivo não está separado.");
expect(functionBody("workOrderTimeSummary").includes("loggedHours"), "Horas apontadas não estão separadas.");
expect(html.includes('["Duração cronológica","chronologicalHours"]'), "Coluna de duração cronológica ausente no relatório.");
expect(html.includes('["Tempo efetivo","effectiveHours"]'), "Coluna de tempo efetivo ausente no relatório.");
expect(html.includes('["Horas apontadas","workedHours"]'), "Coluna de horas apontadas ausente no relatório.");
expect(html.includes('id="orderObservationHours" type="text" inputmode="decimal"'), "Campo de horas não aceita entrada decimal localizada.");
expect(functionBody("isImmutableOrderWorkLog").includes("isOrderWorkLog"), "Apontamento de O.S. não está protegido contra edição comum.");
expect(functionBody("editOperationalDiary").includes("isImmutableOrderWorkLog"), "Editor comum ainda permite alterar apontamentos auditáveis.");
expect(functionBody("deleteOperationalDiary").includes("isImmutableOrderWorkLog"), "Exclusão comum ainda permite apagar apontamentos auditáveis.");
expect(functionBody("saveStage14Diary").includes("isImmutableOrderWorkLog"), "Diário avançado ainda permite alterar apontamentos auditáveis.");
expect(functionBody("gmEffectiveOrderHours").includes("pauseHours"), "Tempo efetivo deixou de descontar pausas.");
expect(html === fallback, "index.html e 404.html não estão sincronizados.");

if (failures.length) {
  console.error(failures.map(item => `- ${item}`).join("\n"));
  process.exit(1);
}
console.log("Horas apontadas da O.S.: validação estática aprovada.");
