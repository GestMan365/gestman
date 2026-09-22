import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("https://**/*", route => route.abort());
  await page.goto("./");
  await page.evaluate(() => window.eval(`
    document.body.classList.remove("auth-required", "auth-loading", "auth-restoring");
    currentAccount = { user: { id:"qa", name:"QA", role:"admin", accessProfile:"admin", active:true }, company:{id:"qa",name:"QA"} };
    createDemoDataSet();
    saveState = () => {};
    window.qaSaves = [];
    window.qaResult = true;
    saveSingleSupabase = async () => {
      window.qaSaves.push(JSON.parse(JSON.stringify(state.spareParts)));
      if (window.qaResult === "throw") throw new Error("QA offline");
      return window.qaResult;
    };
    setView("spares", {persist:false,route:false});
    openMaterialPartForm();
  `));
  await page.locator("#materialPartCode").fill("QA-REFERENCE");
  await page.locator("#materialPartName").fill("Peça QA");
  await page.locator("#materialPartSimpleForm summary").click();
});

test("preço é serializado, reaberto e editado sem alterar custo de estoque", async ({ page }) => {
  await page.locator("#materialPartReferenceValue").fill("12,34");
  await page.getByRole("button", { name:"Salvar Peça", exact:true }).click();
  const first = await page.evaluate(() => window.eval(`
    const part = state.spareParts.find(p => p.code === "QA-REFERENCE");
    window.qaPartId = part.id;
    const persisted = window.qaSaves[0].find(p => p.id === part.id);
    state = normalizeState(JSON.parse(JSON.stringify(state)));
    openMaterialPartForm(part.id);
    ({value:persisted.referenceValue, cost:spareAverageCost(part.id).cost})
  `));
  expect(first).toEqual({value:12.34,cost:0});
  await expect(page.locator("#materialPartReferenceValue")).toHaveValue("12.34");
  await page.locator("#materialPartSimpleForm summary").click();
  await page.locator("#materialPartReferenceValue").fill("56.78");
  await page.getByRole("button", { name:"Salvar Peça", exact:true }).click();
  expect(await page.evaluate(() => window.eval(`state.spareParts.filter(p=>p.id===window.qaPartId).map(p=>p.referenceValue)`))).toEqual([56.78]);
});

test("valor inválido não grava nem fecha formulário", async ({ page }) => {
  for (const value of ["-1", "1.234", "1e9"]) {
    await page.locator("#materialPartReferenceValue").fill(value);
    await page.getByRole("button", { name:"Salvar Peça", exact:true }).click();
    await expect(page.locator("#materialPartReferenceValue")).toBeFocused();
  }
  expect(await page.evaluate(() => window.eval("window.qaSaves.length"))).toBe(0);
});

for (const result of [false, "throw"]) {
  test("falha mantém formulário e permite nova tentativa: " + result, async ({ page }) => {
    await page.evaluate(result => window.eval(`window.qaResult = ${JSON.stringify(result)}`), result);
    await page.locator("#materialPartReferenceValue").fill("25,50");
    await page.getByRole("button", { name:"Salvar Peça", exact:true }).click();
    await expect(page.locator("#materialPartReferenceValue")).toHaveValue("25,50");
    await expect(page.getByRole("button", { name:"Salvar Peça", exact:true })).toBeEnabled();
    await page.evaluate(() => window.eval("window.qaResult = true"));
    await page.getByRole("button", { name:"Salvar Peça", exact:true }).click();
    expect(await page.evaluate(() => window.eval(`state.spareParts.filter(p=>p.code==="QA-REFERENCE").length`))).toBe(1);
  });
}
