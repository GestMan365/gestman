import fs from "node:fs";

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const html = read("index.html");
const fallback = read("404.html");
const migration = read("supabase/migrations/20260823182032_resource_user_source_of_truth.sql");
const edge = read("supabase/functions/manage-company-user/index.ts");
const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

expect(html.includes("gm_save_resource_user_link"), "Frontend não usa o RPC transacional de vínculo.");
expect(html.includes("gm_list_operational_users"), "Frontend não carrega o diretório operacional tenant-scoped.");
expect(html.includes("gmResourceUserId(resource)"), "Frontend não resolve usuário por vínculo canônico.");
expect(!/resource\.email\s*&&\s*normalizeTextKey\(resource\.email\)/.test(html), "O.S. ainda associa recurso por e-mail.");
expect(!/normalizeTextKey\(candidate\.name\)\s*===\s*normalizeTextKey\(tenantUserDisplayName/.test(html), "O.S. ainda associa recurso por nome.");
expect(migration.includes("unique (company_id, user_id)"), "Restrição 1:1 por usuário ausente.");
expect(migration.includes("primary key (company_id, resource_id)"), "Restrição 1:1 por recurso ausente.");
expect(migration.includes("enable row level security"), "RLS ausente na tabela canônica.");
expect(migration.includes("set search_path = ''"), "Funções security definer sem search_path fixo.");
expect(migration.includes("public.gm_save_tenant_state"), "RPC não reutiliza a gravação versionada do estado.");
expect(migration.includes("revoke all on table public.gm_resource_user_links from public, anon, authenticated"), "Privilégios de escrita direta não foram revogados.");
expect(edge.includes("Desvincule o recurso antes de excluir o usuário"), "Edge Function não bloqueia exclusão de usuário vinculado.");
expect(html === fallback, "index.html e 404.html não estão sincronizados.");

if (failures.length) {
  console.error(failures.map(item => `- ${item}`).join("\n"));
  process.exit(1);
}
console.log("Fonte de verdade de usuários e recursos: validação estática aprovada.");
