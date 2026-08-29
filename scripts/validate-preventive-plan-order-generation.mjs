import fs from "node:fs";

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const html = read("index.html");
const fallback = read("404.html");
const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };
const lastFunctionBody = name => {
  const start = html.lastIndexOf(`function ${name}`);
  const next = start < 0 ? -1 : html.indexOf("\n    function ", start + 12);
  return start < 0 ? "" : html.slice(start, next < 0 ? html.length : next);
};

const planModal = lastFunctionBody("openPreventivePlanModal");
const buildOrder = lastFunctionBody("buildPreventivePlanOrder");
const transaction = lastFunctionBody("createPreventivePlanOrder");
const generation = lastFunctionBody("generatePreventivePlanOrder");
const generationIssue = lastFunctionBody("preventivePlanGenerationIssue");

expect(planModal.includes('id="planResponsibleId"'), "Plano ainda não seleciona responsável por ID.");
expect(planModal.includes('id="planExecutorIds"'), "Plano ainda não permite persistir executantes.");
expect(planModal.includes("responsibleName:responsible.name"), "Nome de exibição do responsável não é persistido.");
expect(planModal.includes("durationHours"), "Duração numérica não é persistida no plano.");
expect(buildOrder.includes("plannedDurationHours"), "Duração prevista não é transferida para a O.S.");
expect(buildOrder.includes("linkedChecklists"), "Checklist não é transferido para a O.S.");
expect(buildOrder.includes("executorIds"), "Executantes não são transferidos para a O.S.");
expect(buildOrder.includes("preventivePlanExecutionDate"), "Data de execução do plano não é persistida na O.S.");
expect(generationIssue.includes("PLAN_ORDER_DUPLICATE"), "Proteção contra duplicidade ausente.");
expect(generationIssue.includes("PLAN_TENANT_MISMATCH"), "Isolamento explícito por tenant ausente.");
expect(transaction.includes("remoteSaved!==true"), "Criação não aguarda confirmação de persistência.");
expect(transaction.includes("orderPersistenceIssue(order,true)"), "Criação preventiva não reutiliza a validação de domínio da O.S.");
expect(transaction.includes("state.orders=previousOrders"), "Rollback atômico da O.S. ausente.");
expect(transaction.includes("state.preventivePlans=previousPlans"), "Rollback atômico da recorrência ausente.");
expect(!generation.includes("openOrderModal"), "Gerar O.S. ainda abre o formulário manual.");
expect(!html.includes("confirmGeneratePreventivePlanOrder = confirmGeneratePreventivePlanOrderWithExecutor"), "Override defeituoso da geração ainda está ativo.");
expect(html === fallback, "index.html e 404.html não estão sincronizados.");

if (failures.length) {
  console.error(failures.map(item => `- ${item}`).join("\n"));
  process.exit(1);
}
console.log("Geração de O.S. preventiva: validação estática aprovada.");
