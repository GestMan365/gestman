import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const shared = read("supabase/functions/_shared/maintenance-metrics.ts");
const edge = read("supabase/functions/maintenance-metrics/index.ts");
const ai = read("supabase/functions/ai-gestman/index.ts");
const index = read("index.html");
const fallback = read("404.html");

assert.equal(index, fallback, "index.html e 404.html precisam permanecer sincronizados");

assert.match(shared, /export function calculateMaintenanceMetrics\(/, "calculadora compartilhada ausente");
assert.match(shared, /value:\s*number \| null/, "contrato não preserva ausência de evidência como null");
assert.match(shared, /assetsWithoutOperationalCalendar/, "qualidade do calendário operacional não é auditável");
assert.match(shared, /recordIds:\s*string\[\]/, "rastreabilidade dos registros ausente");

assert.match(edge, /userClient\.auth\.getUser\(token\)/, "Edge Function não valida o JWT");
assert.match(edge, /userClient\.rpc\(\s*"gm_current_context"/, "Edge Function não valida o tenant");
assert.match(edge, /userClient\.rpc\(\s*"gm_load_tenant_state"/, "Edge Function não carrega dados protegidos por RLS");
assert.match(edge, /canViewMetrics\(context\)/, "Edge Function não valida permissão");
assert.match(edge, /if \(explicitLevels\.length\)/, "Edge Function não respeita negação explícita de permissão");
assert.match(edge, /new TextEncoder\(\)\.encode\(body\)\.byteLength > MAX_BODY_BYTES/, "limite real do corpo não é verificado");
assert.match(edge, /calculateMaintenanceMetrics\(/, "Edge Function não usa a calculadora compartilhada");
assert.doesNotMatch(edge, /SUPABASE_SERVICE_ROLE_KEY|service_role/i, "Edge Function de leitura não deve usar service role");

assert.match(ai, /import \{ calculateMaintenanceMetrics \} from "\.\.\/_shared\/maintenance-metrics\.ts"/, "IA não usa a fonte compartilhada");
assert.match(ai, /calculateMaintenanceMetrics\(/, "IA não calcula indicadores pelo contrato oficial");

for (const [name, html] of [["index.html", index], ["404.html", fallback]]) {
  assert.match(html, /gmAuthenticatedFunction\("maintenance-metrics"/, `${name}: chamada autenticada do serviço ausente`);
  assert.match(html, /function gmMaintenanceMetricData\(/, `${name}: adaptador dos indicadores ausente`);
  assert.match(html, /function gmMaintenanceMetricSeries\(/, `${name}: adaptador das séries ausente`);
  assert.match(html, /function stage16MetricData\(key,filters=stage16Filters\)\{return gmMaintenanceMetricData\(key,filters\)\}/, `${name}: indicadores ainda não delegam à fonte oficial`);
  assert.match(html, /const mttrSeries = gmMaintenanceMetricSeries\("mttr", filters, months\)/, `${name}: tendência de MTTR não usa a fonte oficial`);
  assert.match(html, /const mtbfSeries = gmMaintenanceMetricSeries\("mtbf", filters, months\)/, `${name}: tendência de MTBF não usa a fonte oficial`);
  assert.doesNotMatch(html, /function dashboardMetricsFor\(|function trendHourMeterHours\(|function trendDowntimeHours\(/, `${name}: cálculo legado duplicado ainda está ativo`);
  assert.doesNotMatch(html, /assets\.length\s*\*\s*months\s*\*\s*720/, `${name}: estimativa civil artificial de MTBF encontrada`);
}

assert.doesNotMatch(ai, /assets\.length\s*\*\s*720|operatingHours\s*\/\s*failures/i, "IA contém cálculo paralelo ou estimativa artificial");

console.log("OK: indicadores usam contrato autenticado, tenant-scoped, rastreável e compartilhado entre UI e IA.");
