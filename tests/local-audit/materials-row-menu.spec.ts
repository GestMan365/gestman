import { expect, test } from "@playwright/test";

test("menu de ações do catálogo não é cortado pela tabela", async ({ page }) => {
  await page.setViewportSize({ width: 1103, height: 621 });
  await page.goto("./");
  await page.evaluate(() => {
    document.body.classList.remove("auth-required", "auth-loading", "auth-restoring");
    document.body.classList.add("theme-light");
    const table = document.createElement("div");
    table.id = "materialsTableRows";
    table.style.cssText = "position:fixed;top:485px;right:24px;width:260px;height:120px;overflow:auto;z-index:200";
    table.innerHTML = `<div style="height:55px"></div><div class="materials-row-menu"><button type="button" aria-label="Mais ações para peça" onclick="materialRowMenu(this)">⋯</button><div><button onclick="document.body.dataset.materialAction='movement'">Registrar movimentação</button><button>Solicitar material</button><button>Editar peça</button></div></div>`;
    document.body.append(table);
  });

  const trigger = page.locator("#materialsTableRows .materials-row-menu > button");
  await trigger.click();

  const popup = page.locator("body > .materials-row-menu-portal");
  await expect(popup).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  for (const label of ["Registrar movimentação", "Solicitar material", "Editar peça"]) {
    await expect(popup.getByRole("button", { name: label })).toBeVisible();
  }
  const bounds = await popup.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(621);

  await popup.getByRole("button", { name: "Registrar movimentação" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-material-action", "movement");
  await expect(popup).toHaveCount(0);
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
});
