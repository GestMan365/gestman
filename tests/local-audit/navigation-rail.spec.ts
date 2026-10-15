import { expect, test } from "@playwright/test";

test("seta acima dos acessos rápidos amplia e recolhe os nomes dos módulos", async ({ page }) => {
  await page.goto("./?modulo=visao-geral");
  await page.evaluate(() => {
    document.body.classList.remove("auth-required", "auth-loading", "auth-restoring", "sidebar-collapsed");
    document.body.classList.add("premium-shell", "theme-light", "gm-top-navigation");
  });

  const toggle = page.locator("#navRailExpandBtn");
  const nav = page.locator("#mainNavigation");
  const name = page.locator('.nav-pinned .tab[data-view="quickAccess"] > span:nth-child(2)');
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(await nav.evaluate(element => Math.round(element.getBoundingClientRect().width))).toBe(60);
  await expect(name).toBeHidden();

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(name).toBeVisible();
  expect(await nav.evaluate(element => Math.round(element.getBoundingClientRect().width))).toBe(244);
  expect(await toggle.evaluate(element => Math.round(element.getBoundingClientRect().width))).toBeGreaterThan(200);
  expect(await page.locator('[data-nav-group="maintenance"] > summary > span:nth-child(2)').evaluate(element => Math.round(element.getBoundingClientRect().width))).toBeGreaterThan(80);
  expect(await page.locator("main.workspace").evaluate(element => Math.round(element.getBoundingClientRect().left))).toBe(244);
  expect(await page.evaluate(() => window.eval('scopedGetItem("gestman365.navigation.railExpanded.v1", "user")'))).toBe("1");
  await page.evaluate(() => window.eval('setNavRailExpanded(false, false); setNavRailExpanded(scopedGetItem("gestman365.navigation.railExpanded.v1", "user") === "1", false)'));
  await expect(toggle).toHaveAttribute("aria-expanded", "true");

  await page.locator('[data-nav-group="maintenance"] > summary').click();
  await expect(page.locator('[data-nav-group="maintenance"] .nav-group-items .tab[data-view="orders"]')).toBeVisible();
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(await nav.evaluate(element => Math.round(element.getBoundingClientRect().width))).toBe(60);
});
