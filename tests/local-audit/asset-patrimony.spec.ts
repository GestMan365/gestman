import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("https://**/*", route => route.abort());
  await page.goto("./");
  await page.evaluate(() => window.eval(`
    document.body.classList.remove("auth-required","auth-loading","auth-restoring");
    currentAccount={user:{id:"qa",name:"QA",role:"admin",accessProfile:"admin",active:true},company:{id:"qa",name:"QA"}};
    createDemoDataSet();
    state.locations=[{id:"qa-location",name:"Local QA",x:0,y:0,w:100,h:100}];
    state.assets[0].locationId="qa-location";
    render();
    window.qaAssetId=state.assets[0].id;
    window.qaSaved=[]; window.qaResult=true;
    saveState=()=>{};
    saveSingleSupabase=async()=>{
      window.qaSaved.push(JSON.parse(JSON.stringify(state)));
      if(window.qaResult==="throw")throw Error("QA offline");
      return window.qaResult;
    };
    editAsset(window.qaAssetId);
  `));
  await page.locator("#assetForm summary").click();
});

test("patrimônio preserva zeros, reabre e participa da busca e do detalhe", async ({ page }) => {
  await page.locator("#assetPatrimony").fill("  PAT-0000123  ");
  await page.getByRole("button",{name:"Salvar Ativo",exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>window.eval("window.qaSaved.length"))).toBe(1);
  const saved=await page.evaluate(()=>window.eval(`window.qaSaved[0].assets.find(a=>a.id===window.qaAssetId).patrimony`));
  expect(saved).toBe("PAT-0000123");
  await expect(page.locator(".asset-identification")).toContainText("PAT-0000123");
  await page.evaluate(()=>window.eval(`
    closeModal(); state=normalizeState(JSON.parse(JSON.stringify(window.qaSaved[0])));
    editAsset(window.qaAssetId);
  `));
  await expect(page.locator("#assetPatrimony")).toHaveValue("PAT-0000123");
  await page.evaluate(()=>window.eval("resetAssetForm(); setView('assets',{persist:false,route:false})"));
  await page.locator("#assetWorkspaceSearch").fill("PAT-0000123");
  expect(await page.evaluate(()=>window.eval("filteredAssetsWorkspace().map(a=>a.id)"))).toEqual([await page.evaluate(()=>window.eval("window.qaAssetId"))]);
});

test("duplicar e criar novo não reutilizam patrimônio", async ({ page }) => {
  await page.locator("#assetPatrimony").fill("0000123");
  await page.evaluate(()=>window.eval(`state.assets[0].patrimony="0000123"; duplicateAsset(window.qaAssetId)`));
  await expect(page.locator("#assetPatrimony")).toHaveValue("");
  await page.locator("#assetPatrimony").fill("TEMP");
  await page.evaluate(()=>window.eval("openAssetCreate()"));
  await expect(page.locator("#assetPatrimony")).toHaveValue("");
});

for(const result of [false,"throw"]){
  test("falha mantém patrimônio e não confirma sucesso: "+result, async ({page})=>{
    await page.evaluate(result=>window.eval(`window.qaResult=${JSON.stringify(result)}; window.qaToasts=[]; showToast=message=>window.qaToasts.push(message)`),result);
    await page.locator("#assetPatrimony").fill("0000123");
    await page.getByRole("button",{name:"Salvar Ativo",exact:true}).click();
    await expect.poll(()=>page.evaluate(()=>window.eval("window.qaSaved.length"))).toBe(1);
    await expect(page.locator("#assetPatrimony")).toBeVisible();
    await expect(page.locator("#assetPatrimony")).toHaveValue("0000123");
    expect(await page.evaluate(()=>window.eval("window.qaToasts.some(t=>t.includes('com sucesso'))"))).toBe(false);
    await page.evaluate(()=>window.eval("window.qaResult=true"));
    await page.getByRole("button",{name:"Salvar Ativo",exact:true}).click();
    await expect.poll(()=>page.evaluate(()=>window.eval("window.qaSaved.length"))).toBe(2);
    expect(await page.evaluate(()=>window.eval("state.assets.filter(a=>a.id===window.qaAssetId).length"))).toBe(1);
  });
}

test("conteúdo é escapado no detalhe", async ({page})=>{
  await page.locator("#assetPatrimony").fill('<b>0001</b>');
  await page.getByRole("button",{name:"Salvar Ativo",exact:true}).click();
  await expect(page.locator(".asset-identification")).toContainText("<b>0001</b>");
  await expect(page.locator(".asset-identification b")).toHaveCount(0);
});

test("patrimônio pode ficar vazio", async ({page})=>{
  await page.locator("#assetPatrimony").fill("");
  await page.getByRole("button",{name:"Salvar Ativo",exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>window.eval("window.qaSaved.length"))).toBe(1);
  expect(await page.evaluate(()=>window.eval("window.qaSaved[0].assets.find(a=>a.id===window.qaAssetId).patrimony"))).toBe("");
});

test("validação rejeita texto acima do limite mesmo fora do input", async ({page})=>{
  await page.evaluate(()=>window.eval(`$("assetPatrimony").value="x".repeat(81); $("assetForm").dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}))`));
  expect(await page.evaluate(()=>window.eval("window.qaSaved.length"))).toBe(0);
  await expect(page.locator("#assetPatrimony")).toBeFocused();
});
