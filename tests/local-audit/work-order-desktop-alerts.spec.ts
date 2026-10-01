import { expect, test } from "@playwright/test";

test("preferências expõem ativação segura dos alertas de nova O.S.", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("https://**/*", route => route.abort());
  await page.goto("./");
  await page.evaluate(() => window.eval(`
    document.body.classList.remove("auth-required","auth-loading","auth-restoring");
    currentAccount={user:{id:"qa-alert",name:"QA",role:"admin",accessProfile:"admin",active:true},company:{id:"qa-alert",name:"QA"}};
    gmWorkOrderDesktopAlerts.setAccountProvider(()=>currentAccount);
    stage20OpenNotificationPreferences();
  `));
  const alertPanel = page.locator("[data-desktop-order-alerts]");
  await expect(alertPanel).toBeVisible();
  await expect(alertPanel.getByText("Alertas de nova O.S. no computador")).toBeVisible();
  await expect(alertPanel.getByRole("button", { name: /Ativar alertas|Testar alerta/ })).toBeVisible();
  for (const viewport of [{ width: 1366, height: 768 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    const geometry = await page.evaluate(() => ({ innerWidth, scrollWidth: document.documentElement.scrollWidth }));
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.innerWidth + 1);
  }
  expect(errors).toEqual([]);
});
