import fs from "node:fs";

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),"utf8"),html=read("index.html"),fallback=read("404.html"),failures=[];
const expect=(condition,message)=>{if(!condition)failures.push(message)};
const body=name=>{const start=html.indexOf(`function ${name}`),next=start<0?-1:html.indexOf("\n    function ",start+12);return start<0?"":html.slice(start,next<0?html.length:next)};
const update=body("updateChecklistExecutionResponse"),binding=body("bindChecklistRunPersistence"),run=body("openChecklistRun"),summary=body("reviewChecklistFinalization"),auditType=body("orderAuditEventType"),auditLabel=body("orderAuditEventLabel"),auditEvent=body("checklistCompletionAuditEvent"),completion=body("completeChecklistExecution");

expect(update.includes("response.itemId===itemId"),"Atualização não usa itemId estável.");
expect(update.includes("responses.map"),"Atualização funcional das respostas está ausente.");
expect(binding.includes('addEventListener("input",persist)'),"Observações não são persistidas durante a digitação.");
expect(run.includes("bindChecklistRunPersistence(id)"),"Modal não ativa persistência por item.");
expect(!run.includes("setTimeout(()=>openChecklistRun"),"Corrida de reabertura atrasada do modal ainda existe.");
expect(summary.includes("metrics.observationCount"),"Resumo não usa contagem centralizada de observações.");
expect(auditType.includes('return "CHECKLIST_CONCLUIDO"'),"Classificação específica de checklist ausente.");
expect(auditType.indexOf('return "CHECKLIST_CONCLUIDO"')<auditType.indexOf('return "CONCLUSAO"'),"Checklist ainda é classificado depois da conclusão da O.S.");
expect(auditLabel.includes("CHECKLIST CONCLUÍDO"),"Rótulo claro do evento de checklist ausente.");
for(const field of ["tenantId","workOrderId","workOrderNumber","checklistExecutionId","checklistTemplateId","maintenancePlanId","originPlanId","equipmentId","responsibleId","responsibleName","startedBy","openedBy","completedBy","totalItems","conformCount","nonConformCount","notApplicableCount","observationCount","evidenceCount","immutable"]){expect(auditEvent.includes(field),`Campo de auditoria ausente: ${field}`)}
expect(completion.includes("alreadyAudited"),"Proteção contra replay da auditoria ausente.");
expect(!completion.includes("status:\"Concluída\""),"Conclusão do checklist altera indevidamente o status da O.S.");
expect(completion.includes("state.orders=previousOrders"),"Rollback da O.S. ausente.");
expect(html===fallback,"index.html e 404.html não estão sincronizados.");

if(failures.length){console.error(failures.map(item=>`- ${item}`).join("\n"));process.exit(1)}
console.log("Observações e auditoria de checklist: validação estática aprovada.");
