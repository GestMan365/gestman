import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const start = html.indexOf("    function parseMaterialReferenceValue(");
const end = html.indexOf("    async function saveMaterialPart(", start);
const context = vm.createContext({});
vm.runInContext(html.slice(start, end), context);
for (const [input, expected] of [
  ["", 0], ["  ", 0], ["0", 0], ["12,34", 12.34], ["12.34", 12.34],
  [" 19,9 ", 19.9], ["-1", null], ["NaN", null], ["Infinity", null],
  ["1e3", null], ["1.234,56", null], ["1,234.56", null], ["1.234", null],
  ["R$ 20", null], ["9007199254740992", null],
]) {
  test("preço de referência: " + JSON.stringify(input), () => {
    assert.equal(context.parseMaterialReferenceValue(input), expected);
  });
}

test("preço cadastral não altera o custo médio de entradas reais", () => {
  const a = html.indexOf("    function spareAverageCost(");
  const b = html.indexOf("    function stockValuationRows(", a);
  const c = vm.createContext({
    state: { spareParts: [{ id: "p", referenceValue: 9999 }], inventoryMovements: [
      { spareId: "p", type: "entrada", status: "concluida", quantity: 2, unitValue: 10 },
      { spareId: "p", type: "entrada", status: "concluida", quantity: 3, unitValue: 20 },
    ] },
    statusKey: value => value,
    normalizeQuantityForSpareId: (_, quantity) => quantity,
  });
  vm.runInContext(html.slice(a, b), c);
  assert.equal(c.spareAverageCost("p").cost, 16);
  c.state.spareParts[0].referenceValue = 1;
  assert.equal(c.spareAverageCost("p").cost, 16);
  c.state.inventoryMovements = [];
  assert.equal(c.spareAverageCost("p").cost, 0);
});
