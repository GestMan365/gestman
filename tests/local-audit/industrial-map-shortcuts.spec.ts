import { expect, test } from "@playwright/test";

test("mapa mostra resumo no hover e atalhos ao clicar na máquina", async ({ page }) => {
  await page.goto("./?modulo=mapa-industrial");
  await page.evaluate(() => window.eval(`
    document.body.classList.remove("auth-required","auth-loading","auth-restoring");
    document.body.classList.add("premium-shell","theme-light");
    state.assets.push({id:"map-shortcut-test",code:"EQ-TESTE",name:"Bomba de teste",status:"Operando",brand:"Marca teste",model:"Modelo A",locationId:""});
    state.orders.push({id:"order-shortcut-test",assetId:"map-shortcut-test",status:"Aberta"});
    const machine = document.createElement("button");
    machine.dataset.machine = "map-shortcut-test";
    machine.style.cssText = "position:fixed;left:300px;top:300px;width:200px;height:80px";
    document.body.append(machine);
    showIndustrialMachinePreview(machine);
  `));
  await expect(page.locator("#industrialMachinePreview")).toContainText("EQ-TESTE · Bomba de teste");
  await expect(page.locator("#industrialMachinePreview")).toContainText("1 O.S. ativa(s)");

  await page.evaluate(() => window.eval('openMachineMenu({clientX:350,clientY:320},"map-shortcut-test")'));
  await expect(page.locator("#industrialMachinePreview")).toHaveCount(0);
  await expect(page.locator("#machineMenu")).toHaveClass(/open/);
  await expect(page.locator("#machineMenuTitle")).toHaveText("EQ-TESTE · Bomba de teste");
  await expect(page.locator("#machineMenuOrderCount")).toHaveText("1");
  await expect(page.locator('#machineMenu [data-machine-action="details"]')).toBeVisible();
});
