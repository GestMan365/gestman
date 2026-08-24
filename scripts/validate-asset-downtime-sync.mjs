import fs from "node:fs";

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const html = read("index.html");
const fallback = read("404.html");
const migration = read("supabase/migrations/20260825001000_asset_downtime_sync.sql");
const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };
const functionBody = name => {
  const patterns = [`async function ${name}`, `function ${name}`];
  const start = Math.min(...patterns.map(pattern => html.indexOf(pattern)).filter(index => index >= 0));
  if (!Number.isFinite(start)) return "";
  const next = html.indexOf("\n    function ", start + 12);
  const nextAsync = html.indexOf("\n    async function ", start + 12);
  const stops = [next, nextAsync].filter(index => index >= 0);
  return html.slice(start, stops.length ? Math.min(...stops) : html.length);
};

expect(html.includes('gmRpc("gm_transition_asset_downtime"'), "Frontend não usa o RPC transacional de parada.");
expect(functionBody("gmTransitionAssetDowntime").includes("gmRemoteStateVersion"), "Versão remota não é atualizada pela transição.");
expect(functionBody("closeDowntime").includes('gmTransitionAssetDowntime("CLOSED"'), "Encerramento legado ignora o RPC.");
expect(functionBody("cancelDowntime").includes('gmTransitionAssetDowntime("CANCELLED"'), "Cancelamento legado ignora o RPC.");
expect(functionBody("openMobileDowntimeModal").includes('gmTransitionAssetDowntime("OPENED"'), "Abertura mobile ignora o RPC.");
expect(functionBody("openMobileCloseDowntime").includes('gmTransitionAssetDowntime("CLOSED"'), "Encerramento mobile ignora o RPC.");
expect(functionBody("saveStage14Downtime").includes('gmTransitionAssetDowntime("OPENED"'), "Abertura operacional ignora o RPC.");
expect(functionBody("confirmStage14DowntimeClose").includes('gmTransitionAssetDowntime("CLOSED"'), "Encerramento operacional ignora o RPC.");
expect(functionBody("deleteDowntime").includes("histórico de paradas é permanente"), "Exclusão física de parada ainda está disponível.");
expect(migration.includes("create table if not exists public.gm_asset_downtime_events"), "Tabela imutável de eventos ausente.");
expect(migration.includes("gm_tenant_state_enforce_asset_downtime_sync"), "Trigger de proteção ausente.");
expect(migration.includes("GM_DOWNTIME_TRANSITION_RPC_REQUIRED"), "Gravação direta do ciclo de vida não é bloqueada.");
expect(migration.includes("GM_ASSET_ACTIVE_DOWNTIME_EXISTS"), "Paradas ativas duplicadas não são bloqueadas.");
expect(migration.includes("GM_ASSET_ACTIVE_DOWNTIME_STATUS"), "Estado do ativo com parada ativa não é protegido.");
expect(migration.includes("'durationMs', v_duration_ms"), "Duração server-side ausente.");
expect(migration.includes("'previousAssetStatus', v_previous_asset_status"), "Estado anterior do ativo não é preservado.");
expect(migration.includes("unique (company_id, request_id)"), "Idempotência por requisição ausente.");
expect(migration.includes("enable row level security"), "RLS ausente no histórico de paradas.");
expect(migration.includes("set search_path = ''"), "Funções security definer sem search_path fixo.");
expect(migration.includes("revoke all on table public.gm_asset_downtime_events from public, anon, authenticated"), "Eventos permitem escrita direta.");
expect(html === fallback, "index.html e 404.html não estão sincronizados.");

if (failures.length) {
  console.error(failures.map(item => `- ${item}`).join("\n"));
  process.exit(1);
}
console.log("Sincronização Ativos/Paradas/O.S.: validação estática aprovada.");
