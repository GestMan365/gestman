import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../assets/operational-planning.js", import.meta.url), "utf8");
const context = {};
vm.createContext(context);
vm.runInContext(source, context);
const planning = context.GMOperationalPlanning;

test("valida política sem inventar SLA e calcula prazo em horas", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(planning.policy({ baixa: "24", media: "", alta: "2,5" }))), { slaHours: { baixa: 24, alta: 2.5 } });
  assert.equal(planning.deadline("Baixa", "2026-09-25T08:00:00.000Z", { slaHours: { baixa: 24 } }), "2026-09-26T08:00:00.000Z");
  assert.equal(planning.deadline("Crítica", "2026-09-25T08:00:00.000Z", { slaHours: {} }), "");
  assert.throws(() => planning.policy({ baixa: "0" }), /entre 0 e 8760/);
});

test("valida calendário por equipamento sem preencher jornada presumida", () => {
  const assets = [{ id: "asset-1", code: "A-1", name: "Bomba" }];
  const calendar = planning.calendar({ name: "Turno A", assetId: "asset-1", weekdays: ["1", "2", "1"], startTime: "08:00", endTime: "17:00", breakMinutes: "60", status: "Ativo" }, assets);
  assert.deepEqual([...calendar.weekdays], [1, 2]);
  assert.equal(calendar.breakMinutes, 60);
  assert.throws(() => planning.calendar({ name: "Sem equipamento", assetId: "", weekdays: [1], startTime: "08:00", endTime: "17:00" }, assets), /equipamento/);
  assert.throws(() => planning.calendar({ name: "Turno inválido", assetId: "asset-1", weekdays: [1], startTime: "17:00", endTime: "08:00" }, assets), /posterior/);
});

test("resume backlog deduplicado, ignora canceladas e não fabrica idade", () => {
  const data = planning.summary([
    { id: "open", status: "Aberta", createdAt: "2026-09-24T00:00:00Z", priority: "Alta", type: "Corretiva", assetId: "asset-1" },
    { id: "open", status: "Aberta", createdAt: "2026-09-24T00:00:00Z", priority: "Alta", type: "Corretiva", assetId: "asset-1" },
    { id: "cancelled", status: "Cancelada", createdAt: "2026-09-20T00:00:00Z", type: "Corretiva", assetId: "asset-1" },
    { id: "unknown", status: "Aberta", priority: "Baixa", type: "Preventiva" },
  ], [{ id: "asset-1", name: "Bomba" }], new Date("2026-09-25T00:00:00Z").getTime());
  assert.equal(data.total, 3);
  assert.equal(data.active, 2);
  assert.equal(data.noDeadline, 2);
  assert.equal(data.unknownAge, 1);
  assert.equal(data.corrective, 1);
  assert.equal(data.preventive, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(data.top)), [{ id: "asset-1", count: 1, name: "Bomba" }]);
});
