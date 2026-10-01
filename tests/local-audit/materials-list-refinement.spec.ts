import { expect, test } from "@playwright/test";

for (const theme of ["dark", "light"]) {
  for (const viewport of [{ width: 1366, height: 768 }, { width: 1103, height: 621 }, { width: 951, height: 535 }, { width: 390, height: 844 }]) {
    test(`Materiais e Estoque — ${theme} ${viewport.width}`, async ({ page }, testInfo) => {
      test.setTimeout(60000);
      await page.route("**/*", route => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort());
      await page.setViewportSize(viewport);
      await page.goto("./");
      await page.evaluate(themeName => {
        document.body.classList.remove("auth-required", "auth-loading", "auth-restoring");
        window.eval(`
          currentAccount = {user:{id:"ui-materials-admin",name:"Auditor visual",role:"admin",accessProfile:"admin",active:true},company:{id:"ui-materials-company",name:"QA visual"}};
          createDemoDataSet();
          applyTheme("${themeName}",{silent:true});
          setView("spares",{persist:false,route:false});
          document.querySelectorAll("section.view").forEach(view=>view.classList.remove("active"));
          document.getElementById("spares").classList.add("active");
          renderMaterialsWorkspace();
          standardizeUiComponents(document);
        `);
      }, theme);

      const search = page.locator("#materialsSearch");
      const meta = page.locator("#materialsListMeta");
      const panel = page.locator("#materialsFilterPanel");
      const list = page.locator(viewport.width <= 1024 ? "#materialsMobileList" : "#materialsTableRows");
      await expect(search).toHaveAttribute("aria-label", "Buscar materiais");
      await expect(meta).toHaveAttribute("aria-live", "polite");
      await expect(page.locator("#materialsFilterBtn")).not.toContainText("☷");
      await expect(page.locator("#materialsPrimaryAction")).not.toContainText("＋");
      await expect(meta).toContainText("registro");

      if (!(await search.isVisible())) {
        await page.locator("#materialsFilterBtn").scrollIntoViewIfNeeded();
        await page.locator("#materialsFilterBtn").click();
      }
      await search.fill("material-inexistente-qa");
      await expect(meta).toHaveText("0 registro(s)");
      await expect(list).toContainText("Nenhum registro encontrado");
      if (!(await panel.isVisible())) {
        await page.locator("#materialsFilterBtn").scrollIntoViewIfNeeded();
        await page.locator("#materialsFilterBtn").click();
      }
      await panel.getByRole("button", { name: /Limpar/ }).click();
      await expect(meta).not.toHaveText("0 registro(s)");

      for (const tab of ["parts", "stock"]) {
        const tabButton = page.locator(`[data-materials-tab="${tab}"]`);
        if (await tabButton.isVisible()) await tabButton.click();
        else await page.evaluate(tabName => window.eval(`selectMaterialsTab("${tabName}")`), tab);
        const details = list.locator(".gm-list-details").first();
        await details.scrollIntoViewIfNeeded();
        await expect(details).toBeVisible();
        await details.focus();
        await expect(details).toBeFocused();
        const focusStyle = await details.evaluate(element => {
          const style = getComputedStyle(element);
          return { outline: style.outlineStyle, shadow: style.boxShadow };
        });
        expect(focusStyle.outline !== "none" || focusStyle.shadow !== "none").toBe(true);
      }

      const geometry = await page.evaluate(() => {
        const workspace = document.querySelector(".workspace")!;
        const cards = Array.from(document.querySelectorAll("#spares .materials-mobile-card"));
        return {
          width: innerWidth,
          height: innerHeight,
          page: document.documentElement.scrollWidth,
          workspace: workspace.clientWidth,
          scroll: workspace.scrollWidth,
          clipped: cards.filter(card => {
            const bounds = card.getBoundingClientRect();
            return bounds.width > 0 && (bounds.left < 0 || bounds.right > innerWidth);
          }).length
        };
      });
      expect(geometry.width).toBe(viewport.width);
      expect(geometry.height).toBe(viewport.height);
      expect(geometry.page).toBeLessThanOrEqual(geometry.width + 1);
      expect(geometry.scroll).toBeLessThanOrEqual(geometry.workspace + 1);
      expect(geometry.clipped).toBe(0);
      await page.screenshot({ path: testInfo.outputPath("materials-stock.png"), fullPage: true });
    });
  }
}
