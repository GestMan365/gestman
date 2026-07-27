import { expect, test } from "@playwright/test";
import { marker } from "./support/staging-api.mjs";
import { login, openView, readFixture } from "./support/ui";

const assetCode = `${marker}ATIVO-001`;
const assetName = `${marker}BOMBA`;
const orderTitle = `${marker}OS-001`;

test("admin cria, pesquisa, edita e persiste Ativo e Ordem de Serviço", async ({ page }) => {
  const data = readFixture();
  await login(page, data.identities.adminA);
  await openView(page, "assets");
  await expect(page.getByRole("heading", { name: "Ativos e Equipamentos" })).toBeVisible();

  await page.locator("#createAssetBtn").click();
  await expect(page.locator("#assetFormPanel")).toBeVisible();
  await page.locator("#assetName").fill(assetName);
  await page.locator("#assetCode").fill(assetCode);
  await page.locator("#assetCategory").selectOption("Bomba");
  const locationValue = await page.locator("#assetLocation option").evaluateAll((options) =>
    options.map((option) => (option as HTMLOptionElement).value).find(Boolean) || "",
  );
  expect(locationValue).not.toBe("");
  await page.locator("#assetLocation").selectOption(locationValue);
  await page.locator("#assetStatus").selectOption("Operando");
  await page.locator("#assetForm button[type=submit]").dblclick();
  await expect(page.locator("#assetDetailPanel")).toContainText(assetCode);
  expect(await page.evaluate((code) => state.assets.filter((item: any) => item.code === code).length, assetCode)).toBe(1);

  await page.reload();
  await expect(page.getByRole("banner")).toBeVisible({ timeout: 20_000 });
  await openView(page, "assets");
  await page.locator("#assetWorkspaceSearch").fill(assetCode);
  await expect(page.locator("#assetRows")).toContainText(assetCode);
  const row = page.locator("#assetRows tr").filter({ hasText: assetCode });
  await row.locator("summary").click();
  await row.getByRole("button", { name: "Editar ativo" }).click();
  await page.locator("#assetStatus").selectOption("Inspeção");
  await page.locator("#assetForm button[type=submit]").click();
  await expect(page.locator("#assetDetailPanel")).toContainText("Inspeção");
  expect(await page.evaluate((code) => state.assets.filter((item: any) => item.code === code).length, assetCode)).toBe(1);

  await openView(page, "orders");
  await page.locator("#createOrderBtn").click();
  await expect(page.locator("#orderForm")).toBeVisible();
  const assetId = await page.evaluate((code) => state.assets.find((item: any) => item.code === code)?.id || "", assetCode);
  await page.locator("#orderAsset").selectOption(assetId);
  await page.locator("#orderTitle").fill(orderTitle);
  await page.locator("#orderDescription").fill(`${orderTitle} falha funcional controlada`);
  await page.locator("#orderPriority").selectOption("Alta");
  const executor = page.locator("#orderExecutorOptions input[type=checkbox]").first();
  await expect(executor).toBeVisible();
  await executor.check();
  await page.locator('#orderForm button[type=submit][value="save"]').dblclick();
  await expect(page.locator("#orderRows")).toContainText(orderTitle);
  expect(await page.evaluate((title) => state.orders.filter((item: any) => item.title === title).length, orderTitle)).toBe(1);

  await page.reload();
  await expect(page.getByRole("banner")).toBeVisible({ timeout: 20_000 });
  await openView(page, "orders");
  await page.locator("#osSearch").fill(orderTitle);
  await expect(page.locator("#orderRows")).toContainText(orderTitle);
  const persisted = await page.evaluate(
    ({ code, title }) => {
      const asset = state.assets.find((item: any) => item.code === code);
      const order = state.orders.find((item: any) => item.title === title);
      return {
        assetStatus: asset?.status,
        orderAssetId: order?.assetId,
        orderStatus: order?.status,
        executorCount: order?.executorIds?.length || 0,
      };
    },
    { code: assetCode, title: orderTitle },
  );
  expect(persisted).toEqual({
    assetStatus: "Inspeção",
    orderAssetId: assetId,
    orderStatus: "Aberta",
    executorCount: 1,
  });
});

test("anexo inválido é recusado sem corromper o formulário", async ({ page }) => {
  const data = readFixture();
  await login(page, data.identities.adminA);
  await openView(page, "orders");
  await page.locator("#createOrderBtn").click();
  await page.locator("#orderAttachments").setInputFiles({
    name: `${marker}malware.exe`,
    mimeType: "application/x-msdownload",
    buffer: Buffer.from("QA"),
  });
  const assetId = await page.evaluate((code) => state.assets.find((item: any) => item.code === code)?.id || "", assetCode);
  await page.locator("#orderAsset").selectOption(assetId);
  await page.locator("#orderDescription").fill(`${marker}arquivo inválido`);
  await page.locator("#orderExecutorOptions input[type=checkbox]").first().check();
  await page.locator('#orderForm button[type=submit][value="save"]').click();
  await expect(page.locator("#orderForm")).toBeVisible();
  await expect(page.locator(".toast").last()).toContainText(/não permitido|formato|arquivo/i);
});
