import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";

const container = String(process.env.GESTMAN_SQL_CONTAINER || "").trim();
const migration = fs.readFileSync(new URL("../../supabase/migrations/20260915102124_catalog_security_hardening.sql", import.meta.url), "utf8");
const specification = fs.readFileSync(new URL("../security/catalog_security_hardening.spec.sql", import.meta.url), "utf8");

const execute = source => spawnSync(
  "docker",
  ["exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"],
  { input: source, encoding: "utf8", maxBuffer: 20 * 1024 * 1024 },
);

test("migration e contrato catalogal passam em PostgreSQL descartável", { skip: !container && "GESTMAN_SQL_CONTAINER ausente" }, () => {
  const applied = execute(migration);
  assert.equal(applied.status, 0, applied.stderr || applied.stdout);

  const verified = execute(specification);
  assert.equal(verified.status, 0, verified.stderr || verified.stdout);
  assert.match(verified.stdout, /catalog_security_hardening\.spec\.sql: PASS/);
});
