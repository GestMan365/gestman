import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migrationPath = new URL("../supabase/migrations/20260915102124_catalog_security_hardening.sql", import.meta.url);
const sql = fs.readFileSync(migrationPath, "utf8");
const normalized = sql.replace(/\s+/g, " ").trim().toLowerCase();
const executable = sql
  .replace(/--.*$/gm, " ")
  .replace(/'(?:''|[^'])*'/g, "''")
  .replace(/\s+/g, " ")
  .trim()
  .toLowerCase();

const targetPolicies = [
  ["perfil_permissoes", "gestman365_perfil_permissoes_select_auth"],
  ["perfis_acesso", "gestman365_perfis_select_auth"],
  ["permissoes", "gestman365_permissoes_select_auth"],
];

test("migration é transacional e limita espera por lock e execução", () => {
  assert.match(sql, /^begin;/i);
  assert.match(sql, /set local lock_timeout = '5s';/i);
  assert.match(sql, /set local statement_timeout = '5min';/i);
  assert.match(sql, /commit;\s*$/i);
});

test("preflight exige a FK estrutural exata antes de alterar o catálogo", () => {
  assert.match(sql, /ordens_servico_equipamento_id_fkey/);
  assert.match(sql, /FOREIGN KEY \(equipamento_id\) REFERENCES equipamentos\(id\) ON DELETE SET NULL/);
  assert.match(sql, /GM_CATALOG_HARDENING_FK_PREFLIGHT_FAILED/);
});

test("FK é validada sem remoção, recriação ou limpeza automática", () => {
  assert.match(normalized, /alter table public\.ordens_servico validate constraint ordens_servico_equipamento_id_fkey;/);
  assert.doesNotMatch(normalized, /drop constraint|add constraint/);
  assert.match(sql, /GM_CATALOG_HARDENING_FK_POSTCHECK_FAILED/);
});

test("policies divergentes causam fail-fast antes da remoção", () => {
  for (const [, policy] of targetPolicies) assert.ok(sql.includes(policy));
  assert.match(sql, /GM_CATALOG_HARDENING_POLICY_PREFLIGHT_FAILED/);
  assert.match(sql, /if not found then/);
  assert.match(sql, /v_policy\.using_expression = 'true'/);
  assert.match(sql, /v_policy\.check_expression is null/);
});

test("as três policies universais são removidas sem substituição universal", () => {
  for (const [table, policy] of targetPolicies) {
    assert.match(normalized, new RegExp(`drop policy ${policy} on public\\.${table};`));
  }
  assert.doesNotMatch(normalized, /create policy/);
  assert.doesNotMatch(normalized, /using\s*\(\s*true\s*\)|with check\s*\(\s*true\s*\)/);
});

test("acesso direto é revogado de PUBLIC, anon e authenticated", () => {
  for (const [table] of targetPolicies) {
    assert.match(normalized, new RegExp(`revoke all privileges on table public\\.${table} from public, anon, authenticated;`));
  }
  assert.doesNotMatch(normalized, /\bgrant\b/);
  assert.match(sql, /GM_CATALOG_HARDENING_GRANT_POSTCHECK_FAILED/);
  assert.match(sql, /pg_catalog\.aclexplode/);
  for (const privilege of ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER", "MAINTAIN"]) {
    assert.ok(sql.includes(`('${privilege}')`));
  }
});

test("RLS é preservada e nunca desabilitada", () => {
  assert.match(sql, /GM_CATALOG_HARDENING_RLS_POSTCHECK_FAILED/);
  assert.doesNotMatch(normalized, /disable row level security|no force row level security/);
});

test("migration não cria função privilegiada nem amplia execução", () => {
  assert.doesNotMatch(normalized, /create(?: or replace)? function|security definer|grant execute/);
});

test("migration não contém DML empresarial, backfill ou operação destrutiva", () => {
  assert.doesNotMatch(executable, /\b(insert into|update public\.|delete from|truncate|drop table|drop schema)\b/);
  assert.doesNotMatch(normalized, /backfill|20260903232800|20260908213849/);
});

test("escopo não altera OS/Ativo além da validação da FK", () => {
  assert.doesNotMatch(normalized, /gm_work_order|gm_tenant_state|gm_transition_work_order|gm_enforce_work_order/);
});
