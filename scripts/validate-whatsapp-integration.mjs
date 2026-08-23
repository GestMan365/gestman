import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const fallback = fs.readFileSync(path.join(root, "404.html"), "utf8");
const edge = fs.readFileSync(path.join(root, "supabase/functions/whatsapp-work-order-alerts/index.ts"), "utf8");
const migrations = fs.readdirSync(path.join(root, "supabase/migrations"));
const migrationName = migrations.find((name) => name.endsWith("_whatsapp_work_order_notifications.sql"));
if (!migrationName) throw new Error("Migration da integração WhatsApp não encontrada.");
const migration = fs.readFileSync(path.join(root, "supabase/migrations", migrationName), "utf8");
const previousMigrations = migrations
  .filter((name) => name.endsWith(".sql") && name !== migrationName)
  .map((name) => fs.readFileSync(path.join(root, "supabase/migrations", name), "utf8"))
  .join("\n");

const failures = [];
const requireText = (source, marker, label = marker) => {
  if (!source.includes(marker)) failures.push(`Ausente: ${label}`);
};
const requirePattern = (source, pattern, label) => {
  if (!pattern.test(source)) failures.push(`Ausente: ${label}`);
};

[
  "defaultWhatsAppNotifications",
  "whatsappNotificationForm",
  "whatsappNotificationRecipients",
  "dispatchWhatsAppOrderEvents",
  "whatsapp-work-order-alerts",
  'action:"configure"',
  "notifyOnCreate",
  "notifyOnStatus",
  "notifyOnAssignment",
  "notifyOnPriority",
].forEach((marker) => requireText(index, marker));

if (index.includes("WHATSAPP_ACCESS_TOKEN") || index.includes("WHATSAPP_PHONE_NUMBER_ID") || index.includes("WHATSAPP_SETTINGS_ENCRYPTION_KEY")) {
  failures.push("O frontend contém nome de segredo reservado ao servidor.");
}
if (index.includes("state.whatsappNotifications") || /normalized\.whatsappNotifications\s*=/.test(index)) {
  failures.push("Destinatários do WhatsApp não podem persistir no estado compartilhado da empresa.");
}

[
  'Deno.env.get("WHATSAPP_ACCESS_TOKEN")',
  'Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")',
  'Deno.env.get("WHATSAPP_GRAPH_API_VERSION")',
  'Deno.env.get("WHATSAPP_TEMPLATE_WORK_ORDER")',
  'Deno.env.get("WHATSAPP_SETTINGS_ENCRYPTION_KEY")',
  'service.from("gm_whatsapp_settings")',
  "encryptRecipients",
  "decryptRecipients",
  "safeProviderError",
  "recipientHash",
  "eventKey",
  "MAX_RECIPIENTS = 5",
].forEach((marker) => requireText(edge, marker));

[
  [/userClient\.auth\.getUser\(\s*token\s*,?\s*\)/s, 'userClient.auth.getUser(token)'],
  [/userClient\.rpc\(\s*"gm_current_context"\s*,?\s*\)/s, 'userClient.rpc("gm_current_context")'],
  [/service\.from\(\s*"gm_tenant_state"\s*,?\s*\)/s, 'service.from("gm_tenant_state")'],
  [/service\.from\(\s*"gm_whatsapp_delivery_log"\s*,?\s*\)/s, 'service.from("gm_whatsapp_delivery_log")'],
].forEach(([pattern, label]) => requirePattern(edge, pattern, label));

if (/console\.(?:log|error)\([^\n]*(?:WHATSAPP_ACCESS_TOKEN|authorization)/i.test(edge)) {
  failures.push("A Edge Function pode registrar segredo ou cabeçalho de autorização.");
}

[
  "create table if not exists public.gm_whatsapp_settings",
  "revoke all on table public.gm_whatsapp_settings from anon, authenticated",
  "grant select, insert, update, delete on table public.gm_whatsapp_settings to service_role",
  "create table if not exists public.gm_whatsapp_delivery_log",
  "unique (company_id, event_key, recipient_hash)",
  "enable row level security",
  "revoke all on table public.gm_whatsapp_delivery_log from anon, authenticated",
  "grant select on table public.gm_whatsapp_delivery_log to authenticated",
  "gm_is_company_admin(company_id)",
].forEach((marker) => requireText(migration.toLowerCase(), marker.toLowerCase(), `migration: ${marker}`));

if (/using\s*\(\s*true\s*\)|with\s+check\s*\(\s*true\s*\)/i.test(migration)) {
  failures.push("A migration contém policy permissiva.");
}
if (/\binsert\s+into\b/i.test(migration)) failures.push("A migration não pode inserir dados.");
[
  "gm_companies",
  "gm_set_updated_at",
  "gm_is_company_admin",
].forEach((marker) => requireText(previousMigrations, marker, `dependência anterior: ${marker}`));

if (index !== fallback) failures.push("index.html e 404.html não estão sincronizados.");

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}

console.log("Integração WhatsApp validada estruturalmente: estado, UI, Edge Function, autenticação, RLS e idempotência.");
