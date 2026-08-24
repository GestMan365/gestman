import fs from "node:fs";

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const html = read("index.html");
const fallback = read("404.html");
const migration = read("supabase/migrations/20260824234000_work_order_state_machine.sql");
const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };
const functionBody = name => {
  const start = html.indexOf(`function ${name}`);
  const next = start < 0 ? -1 : html.indexOf("\n    function ", start + 12);
  return start < 0 ? "" : html.slice(start, next < 0 ? html.length : next);
};

expect(html.includes('gmRpc("gm_transition_work_order"'), "Frontend não usa o RPC transacional de O.S.");
expect(html.includes("gmOrderTransitionErrorMessage"), "Mensagens operacionais da máquina de estados ausentes.");
expect(html.includes('id="detailStatus" disabled'), "Status principal ainda pode ser editado diretamente.");
expect(html.includes('id="tabDetailStatus" disabled'), "Status da aba Detalhes ainda pode ser editado diretamente.");
expect(functionBody("startOrder").includes("gmTransitionWorkOrder"), "Início da O.S. não usa a máquina de estados.");
expect(functionBody("changeOrderOperationalStatus").includes("gmTransitionWorkOrder"), "Pausa/retomada não usa a máquina de estados.");
expect(functionBody("cancelOrder").includes("gmTransitionWorkOrder"), "Cancelamento não usa a máquina de estados.");
expect(functionBody("confirmFinishOrder").includes("gmTransitionWorkOrder"), "Conclusão detalhada não usa a máquina de estados.");
expect(migration.includes("create table if not exists public.gm_work_order_events"), "Tabela imutável de eventos ausente.");
expect(migration.includes("gm_tenant_state_enforce_work_order_transition"), "Proteção contra gravação direta de status ausente.");
expect(migration.includes("GM_ORDER_TRANSITION_RPC_REQUIRED"), "Gravação genérica não é bloqueada.");
expect(migration.includes("GM_ORDER_TRANSITION_INVALID"), "Transições inválidas não são rejeitadas.");
expect(migration.includes("gm_work_order_time_ms"), "Compatibilidade com datas legadas da O.S. ausente.");
expect(migration.includes("unique (company_id, request_id)"), "Idempotência por requisição ausente.");
expect(migration.includes("enable row level security"), "RLS ausente no histórico de O.S.");
expect(migration.includes("set search_path = ''"), "Funções security definer sem search_path fixo.");
expect(migration.includes("revoke all on table public.gm_work_order_events from public, anon, authenticated"), "Eventos ainda permitem escrita direta.");
expect(html === fallback, "index.html e 404.html não estão sincronizados.");

if (failures.length) {
  console.error(failures.map(item => `- ${item}`).join("\n"));
  process.exit(1);
}
console.log("Máquina de estados de O.S.: validação estática aprovada.");
