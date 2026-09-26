import { expect, test } from "@playwright/test";

for (const theme of ["dark", "light"]) {
  for (const viewport of [{ width: 951, height: 535 }, { width: 1103, height: 621 }, { width: 1366, height: 768 }, { width: 1501, height: 900 }, { width: 1700, height: 900 }, { width: 1920, height: 1080 }, { width: 390, height: 844 }]) {
    test(`botões do cabeçalho visíveis — ${theme} ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
      await page.route("**/*", route => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort());
      await page.setViewportSize(viewport);
      await page.goto("./");
      await page.evaluate(theme => {
        document.body.classList.remove("auth-required", "auth-loading", "auth-restoring");
        document.body.classList.toggle("theme-light", theme === "light");
        document.body.classList.toggle("theme-dark", theme === "dark");
      }, theme);
      const buttons = page.locator("#mainNavigation .gm-module-nav-group .nav-group > summary");
      await expect(buttons).toHaveCount(6);
      for (const button of await buttons.all()) {
        await button.scrollIntoViewIfNeeded();
        await expect(button).toBeVisible();
        const style = await button.evaluate(element => {
          const css = getComputedStyle(element);
          const label = getComputedStyle(element.querySelector("span:nth-child(2)")!);
          const luminance = (color: string) => {
            const rgb = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
            return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
          };
          const contrast = (a: string, b: string) => {
            const values = [luminance(a), luminance(b)].sort((a, b) => b - a);
            return (values[0] + .05) / (values[1] + .05);
          };
          const rect = element.getBoundingClientRect();
          const textRect = element.querySelector("span:nth-child(2)")!.getBoundingClientRect();
          const utility = document.querySelector(".reference-topbar-actions")!.getBoundingClientRect();
          const overlapsUtility = rect.left < utility.right && rect.right > utility.left && rect.top < utility.bottom && rect.bottom > utility.top;
          return { background: css.backgroundColor, border: css.borderTopWidth, textContrast: contrast(label.color, css.backgroundColor), borderContrast: contrast(css.borderTopColor, css.backgroundColor), left: rect.left, right: rect.right, textLeft: textRect.left, textRight: textRect.right, overlapsUtility, width: innerWidth, documentWidth: document.documentElement.scrollWidth };
        });
        expect(style.background).not.toBe("rgba(0, 0, 0, 0)");
        expect(style.border).toBe("1px");
        expect(style.textContrast).toBeGreaterThanOrEqual(4.5);
        expect(style.borderContrast).toBeGreaterThanOrEqual(3);
        expect(style.left).toBeGreaterThanOrEqual(0);
        expect(style.right).toBeLessThanOrEqual(style.width + 1);
        expect(style.textLeft).toBeGreaterThanOrEqual(style.left);
        expect(style.textRight).toBeLessThanOrEqual(style.right);
        expect(style.overlapsUtility).toBe(false);
        expect(style.documentWidth).toBeLessThanOrEqual(style.width + 1);
      }
      const maintenance = buttons.first();
      await maintenance.scrollIntoViewIfNeeded();
      await maintenance.focus();
      await expect(maintenance).toBeFocused();
      expect(await maintenance.evaluate(el => getComputedStyle(el).outlineStyle)).toBe("solid");
      const closed = await maintenance.evaluate(el => getComputedStyle(el).backgroundColor);
      await maintenance.press("Enter");
      await expect(page.locator('#mainNavigation [data-nav-group="maintenance"]')).toHaveAttribute("open", "");
      await expect(page.locator('#mainNavigation [data-nav-group="maintenance"] .nav-group-items')).toBeVisible();
      expect(await maintenance.evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe(closed);
      await page.screenshot({ path: testInfo.outputPath("header.png") });
    });
  }
}
