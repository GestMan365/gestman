import { expect, test } from "@playwright/test";
import { env } from "./support/staging-api.mjs";
import { expectNoGlobalOverflow, login, openView, readFixture } from "./support/ui";

const viewports = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
];

for (const viewport of viewports) {
  test(`layout autenticado sem overflow global em ${viewport.width}x${viewport.height}`, async ({ page }) => {
    const data = readFixture();
    await page.setViewportSize(viewport);
    await login(page, data.identities.adminA);
    for (const view of ["dashboard", "assets", "orders", "spares", "teamsResources"]) {
      await openView(page, view);
      await expectNoGlobalOverflow(page);
    }
    await openView(page, "assets");
    await page.locator("#createAssetBtn").click();
    await expect(page.locator("#assetFormPanel")).toBeVisible();
    await expectNoGlobalOverflow(page);
    const box = await page.locator("#assetFormPanel").boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
  });
}

test("módulos principais abrem sem exceções JavaScript", async ({ page }) => {
  const data = readFixture();
  const errors: string[] = [];
  const consoleIssues: string[] = [];
  const networkIssues: number[] = [];
  const requestFailures: string[] = [];
  let foreignSupabaseRequest = false;
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) consoleIssues.push(message.text());
  });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.hostname.endsWith(".supabase.co") && url.origin !== env.url) foreignSupabaseRequest = true;
  });
  page.on("response", (response) => {
    if (response.status() >= 400) networkIssues.push(response.status());
  });
  page.on("requestfailed", (request) => requestFailures.push(request.failure()?.errorText || "request failed"));
  await login(page, data.identities.adminA);
  const dueStates = await page.evaluate(() => {
    const classify = (window as typeof window & {
      orderDueState: (order: Record<string, unknown>, reference: number) => { key: string };
    }).orderDueState;
    const reference = new Date(2026, 6, 28, 12).getTime();
    return [
      classify({ status: "Aberta" }, reference).key,
      classify({ status: "Aberta", scheduledAt: "2026-08-10" }, reference).key,
      classify({ status: "Aberta", scheduledAt: "2026-07-28" }, reference).key,
      classify({ status: "Aberta", scheduledAt: "2026-07-30" }, reference).key,
      classify({ status: "Aberta", scheduledAt: "2026-07-20" }, reference).key,
      classify({ status: "Concluída", scheduledAt: "2026-07-20" }, reference).key,
      classify({ status: "Aberta", scheduledAt: "2026-02-31" }, reference).key,
    ];
  });
  expect(dueStates).toEqual([
    "no-date",
    "on-time",
    "due-today",
    "due-soon",
    "overdue",
    "completed",
    "invalid",
  ]);
  const views = [
    "dashboard", "assets", "orders", "calendar", "preventivePlans", "checklists",
    "activeOrders", "downtime", "measurements", "operationalDiary",
    "toolsControl", "teamsResources", "operationalAreas", "locations",
    "installationStructure", "spares", "reports",
  ];
  for (const view of views) {
    const count = await page.locator(`[data-view="${view}"]`).count();
    if (!count) continue;
    await openView(page, view);
    await expect(page.locator(`#${view}`)).toBeVisible();
  }
  expect(foreignSupabaseRequest).toBe(false);
  expect(networkIssues).toEqual([]);
  expect(requestFailures).toEqual([]);
  expect(consoleIssues).toEqual([]);
  expect(errors).toEqual([]);
});
