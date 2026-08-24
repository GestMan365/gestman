import assert from "node:assert/strict";
import test from "node:test";

const transitions = new Map([
  ["Planejada", new Set(["Aberta", "Em execução", "Cancelada"])],
  ["Aberta", new Set(["Em execução", "Aguardando material", "Cancelada"])],
  ["Aguardando material", new Set(["Em execução", "Pausada", "Cancelada"])],
  ["Em execução", new Set(["Pausada", "Aguardando material", "Concluída", "Cancelada"])],
  ["Pausada", new Set(["Em execução", "Aguardando material", "Cancelada"])],
]);

const allowed = (from, to) => transitions.get(from)?.has(to) === true;

test("fluxo operacional principal é permitido", () => {
  assert.equal(allowed("Aberta", "Em execução"), true);
  assert.equal(allowed("Em execução", "Pausada"), true);
  assert.equal(allowed("Pausada", "Em execução"), true);
  assert.equal(allowed("Em execução", "Concluída"), true);
});

test("estados encerrados são terminais", () => {
  assert.equal(allowed("Concluída", "Em execução"), false);
  assert.equal(allowed("Cancelada", "Aberta"), false);
});

test("não é possível concluir sem iniciar", () => {
  assert.equal(allowed("Aberta", "Concluída"), false);
  assert.equal(allowed("Planejada", "Concluída"), false);
  assert.equal(allowed("Pausada", "Concluída"), false);
});

test("espera de material e cancelamento preservam caminhos controlados", () => {
  assert.equal(allowed("Aberta", "Aguardando material"), true);
  assert.equal(allowed("Aguardando material", "Em execução"), true);
  assert.equal(allowed("Aguardando material", "Cancelada"), true);
});
