import fs from "node:fs";

const sql = fs.readFileSync(new URL("../supabase/migrations/20260915102124_catalog_security_hardening.sql", import.meta.url), "utf8");
const compact = sql.replace(/\s+/g, " ").trim().toLowerCase();
const executable = sql
  .replace(/--.*$/gm, " ")
  .replace(/'(?:''|[^'])*'/g, "''")
  .replace(/\s+/g, " ")
  .trim()
  .toLowerCase();
const failures = [];
let checks = 0;
const expect = (condition, message) => { checks += 1; if (!condition) failures.push(message); };
const tables = ["perfil_permissoes", "perfis_acesso", "permissoes"];
const policies = [
  "gestman365_perfil_permissoes_select_auth",
  "gestman365_perfis_select_auth",
  "gestman365_permissoes_select_auth",
];

expect(/^begin;/i.test(sql) && /commit;\s*$/i.test(sql), "Migration não é transacional.");
expect(sql.includes("set local lock_timeout = '5s';"), "lock_timeout explícito ausente.");
expect(sql.includes("set local statement_timeout = '5min';"), "statement_timeout explícito ausente.");
expect(compact.includes("validate constraint ordens_servico_equipamento_id_fkey"), "Validação da FK ausente.");
expect(sql.includes("GM_CATALOG_HARDENING_FK_PREFLIGHT_FAILED"), "Preflight estrutural da FK ausente.");
expect(sql.includes("GM_CATALOG_HARDENING_FK_POSTCHECK_FAILED"), "Pós-condição da FK ausente.");

for (let index = 0; index < tables.length; index += 1) {
  expect(compact.includes(`drop policy ${policies[index]} on public.${tables[index]};`), `Policy ${policies[index]} não é removida.`);
  expect(compact.includes(`revoke all privileges on table public.${tables[index]} from public, anon, authenticated;`), `Privilégios diretos de ${tables[index]} não são revogados.`);
}

expect(!/create\s+policy/i.test(sql), "Migration cria uma nova policy sem necessidade.");
expect(!/using\s*\(\s*true\s*\)|with\s+check\s*\(\s*true\s*\)/i.test(sql), "Migration contém policy universal.");
expect(!/security\s+definer|create(?:\s+or\s+replace)?\s+function/i.test(sql), "Migration cria função privilegiada.");
expect(!/\bgrant\s+execute\b/i.test(sql), "Migration amplia EXECUTE.");
expect(!/disable\s+row\s+level\s+security/i.test(sql), "Migration desabilita RLS.");
expect(sql.includes("pg_catalog.aclexplode"), "Pós-condição de ACL de PUBLIC ausente.");
expect(!/\b(insert\s+into|update\s+public\.|delete\s+from|truncate|drop\s+table|drop\s+schema)\b/i.test(executable), "Migration contém DML empresarial ou operação destrutiva.");
expect(sql.includes("GM_CATALOG_HARDENING_POLICY_POSTCHECK_FAILED") && sql.includes("GM_CATALOG_HARDENING_GRANT_POSTCHECK_FAILED") && sql.includes("GM_CATALOG_HARDENING_RLS_POSTCHECK_FAILED"), "Pós-condições catalogais incompletas.");

if (failures.length) {
  console.error(failures.map(item => `- ${item}`).join("\n"));
  process.exit(1);
}

console.log(`Fase 04.1 — hardening catalogal: validação estática aprovada (${checks}/${checks}).`);
