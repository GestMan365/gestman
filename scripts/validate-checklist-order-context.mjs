import fs from "node:fs";

const read = path => fs.readFileSync(new URL(`../${path}`,import.meta.url),"utf8");
const html = read("index.html");
const fallback = read("404.html");
const failures = [];
const expect = (condition,message) => { if(!condition) failures.push(message); };
const body = name => {
  const start = html.indexOf(`function ${name}`);
  const next = start < 0 ? -1 : html.indexOf("\n    function ",start + 12);
  return start < 0 ? "" : html.slice(start,next < 0 ? html.length : next);
};

const orderTab = body("orderDetailTabContent");
const modal = body("openChecklistStart");
const build = body("buildChecklistExecution");
const create = body("createChecklistExecution");
const complete = body("completeChecklistExecution");
const normalize = body("normalizeChecklistExecution");

expect(orderTab.includes("openChecklistExecution('${checklist.id}','${order.id}')"),"A aba da O.S. não transmite o ID da própria O.S.");
expect(orderTab.includes("checklistExecutionOrderId(item) === order.id"),"Execuções vinculadas não aparecem na aba Checklist da O.S.");
expect(modal.includes('data-order-context-locked="${lockOrderContext?"true":"false"}"'),"Modal não identifica o contexto bloqueado da O.S.");
expect(modal.includes('requireOrder:lockOrderContext'),"Submissão não exige a O.S. de origem.");
expect(modal.includes('expectedOrderId:lockOrderContext?orderId:""'),"Submissão não protege contra troca da O.S.");
expect(build.includes("responsibleId:assignment.responsibleId"),"Responsável técnico por ID não é transferido.");
expect(build.includes("startedById:String(initiator.id"),"Usuário iniciador não é armazenado separadamente.");
expect(build.includes("originPlanId:planId"),"Plano de origem não é preservado.");
expect(create.includes("CHECKLIST_EXECUTION_ERRORS.PERSISTENCE_FAILED"),"Criação não exige confirmação de persistência.");
expect(create.includes("state.checklistExecutions=previousExecutions"),"Rollback atômico do início está ausente.");
expect(complete.includes("checklistCompletionAuditEvent"),"Conclusão não registra auditoria na O.S.");
expect(complete.includes("state.orders=previousOrders"),"Rollback atômico da conclusão está ausente.");
expect(normalize.includes("checklistTemplateId"),"Compatibilidade do checklistTemplateId está ausente.");
expect(normalize.includes("workOrderId"),"Compatibilidade do workOrderId está ausente.");
expect(html.includes("CHECKLIST_EXECUTION_DUPLICATE"),"Proteção de duplicidade/replay ausente.");
expect(html.includes("CHECKLIST_TENANT_MISMATCH"),"Proteção de tenant ausente.");
expect(html === fallback,"index.html e 404.html não estão sincronizados.");

if(failures.length){console.error(failures.map(item=>`- ${item}`).join("\n"));process.exit(1)}
console.log("Vínculo checklist/O.S.: validação estática aprovada.");
