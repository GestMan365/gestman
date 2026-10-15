import { expect, test } from "@playwright/test";

test("seta acima dos acessos rápidos amplia e recolhe os nomes dos módulos", async ({ page }) => {
  await page.goto("./?modulo=visao-geral");
  await page.evaluate(() => {
    document.body.classList.remove("auth-required", "auth-loading", "auth-restoring", "sidebar-collapsed");
    document.body.classList.add("premium-shell", "theme-light", "gm-top-navigation");
    window.eval("setNavRailExpanded(false, false)");
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
  expect(await toggle.evaluate(element => Math.round(element.getBoundingClientRect().width))).toBe(48);
  await expect(toggle.locator(".nav-rail-expand-text")).toHaveCount(0);
  expect(await page.locator('[data-nav-group="maintenance"] > summary > span:nth-child(2)').evaluate(element => Math.round(element.getBoundingClientRect().width))).toBeGreaterThan(80);
  expect(await page.locator("main.workspace").evaluate(element => Math.round(element.getBoundingClientRect().left))).toBe(244);
  expect(await page.evaluate(() => window.eval('scopedGetItem(NAV_RAIL_EXPANDED_KEY, "user")'))).toBe("1");
  await page.evaluate(() => window.eval('setNavRailExpanded(false, false); setNavRailExpanded(scopedGetItem(NAV_RAIL_EXPANDED_KEY, "user") !== "0", false)'));
  await expect(toggle).toHaveAttribute("aria-expanded", "true");

  await page.locator('[data-nav-group="maintenance"] > summary').click();
  await expect(page.locator('[data-nav-group="maintenance"] .nav-group-items .tab[data-view="orders"]')).toBeVisible();
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(await nav.evaluate(element => Math.round(element.getBoundingClientRect().width))).toBe(60);
});
