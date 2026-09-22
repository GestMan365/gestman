import { expect, test } from "@playwright/test";

const viewports = [
  { width: 1366, height: 768 },
  { width: 1103, height: 621 },
  { width: 951, height: 535 },
  { width: 390, height: 844 },
];

function bootDemo() {
  document.body.classList.remove("auth-required", "auth-loading", "auth-restoring");
  window.eval(`currentAccount = { user: { id: "ui-audit-admin", name: "Auditor visual", role: "admin", accessProfile: "admin", active: true }, company: { id: "ui-audit-company", name: "QA visual" } }; createDemoDataSet();`);
}

test("padrão visual mantém geometria, controles e overflow nas quatro dimensões", async ({ page }) => {
  test.setTimeout(120_000);
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("./");
    await page.evaluate(bootDemo);
    const result = await page.evaluate(async () => {
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const visible = (node: Element) => {
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > .05 && rect.width > 1 && rect.height > 1;
      };
      const insideHorizontalScroller = (node: Element) => {
        let parent = node.parentElement;
        while (parent && parent !== document.body) {
          const style = getComputedStyle(parent);
          if (["auto", "scroll"].includes(style.overflowX) && parent.scrollWidth > parent.clientWidth + 1) return true;
          parent = parent.parentElement;
        }
        return false;
      };
      const views = Array.from(document.querySelectorAll<HTMLElement>("section.view")).map(view => {
        document.querySelectorAll<HTMLElement>("section.view").forEach(item => item.classList.remove("active"));
        try { window.eval(`setView("${view.id}", { persist:false, route:false, silent:true })`); window.GMIcons?.decorate(view); window.eval("standardizeUiComponents(document)"); }
        catch { view.classList.add("active"); }
        const root = view.getBoundingClientRect();
        const title = Array.from(view.querySelectorAll<HTMLElement>("h1,h2")).find(visible);
        const controls = Array.from(view.querySelectorAll<HTMLElement>("button,input,select,textarea,summary,[tabindex]"))
          .filter(visible)
          .filter(node => !node.closest("#mainNavigation"));
        const clipped = controls.filter(node => {
          const rect = node.getBoundingClientRect();
          return (rect.left < -1 || rect.right > innerWidth + 1) && !insideHorizontalScroller(node);
        });
        const rawGlyphButtons = controls.filter(node => !node.querySelector(".gm-icon") && /[⌕⋮☷＋▣‹›↻✋⚙]/u.test(node.textContent || ""));
        const smallControls = controls.filter(node => {
          if (node.closest("thead")) return false;
          return node.matches("button,summary") && node.getBoundingClientRect().height < 32;
        });
        return {
          id: view.id,
          outOfBounds: root.left < -1 || root.right > innerWidth + 1,
          titleCollapsed: Boolean(title && (title.getBoundingClientRect().height > 90 || title.getBoundingClientRect().width < 80)),
          clipped: clipped.map(node => node.id || node.textContent?.trim().slice(0, 60)),
          rawGlyphButtons: rawGlyphButtons.map(node => node.id || node.textContent?.trim().slice(0, 60)),
          smallControls: smallControls.map(node => node.id || node.textContent?.trim().slice(0, 60)),
        };
      });
      return {
        innerWidth,
        innerHeight,
        documentWidth: document.documentElement.scrollWidth,
        views,
        errors: views.filter(item => item.outOfBounds || item.titleCollapsed || item.clipped.length || item.rawGlyphButtons.length || item.smallControls.length),
      };
    });
    expect(result.innerWidth).toBe(viewport.width);
    expect(result.innerHeight).toBe(viewport.height);
    expect(result.documentWidth).toBeLessThanOrEqual(viewport.width + 1);
    expect(result.errors, `${viewport.width}x${viewport.height}: ${JSON.stringify(result.errors)}`).toEqual([]);
  }
});

test("patrimônio é editável e preço de referência fica separado do custo", async ({ page }) => {
  for (const viewport of [{ width: 1366, height: 768 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto("./");
    await page.evaluate(bootDemo);
    await page.evaluate(() => window.eval(`setView("assets", { persist:false, route:false }); openAssetCreate();`));
    await expect(page.locator("#assetPatrimony")).toBeEnabled();
    await expect(page.locator("#assetPatrimonyHelp")).toHaveCount(0);
    await page.evaluate(() => window.eval(`resetAssetForm(); setView("spares", { persist:false, route:false }); openMaterialPartForm();`));
    await expect(page.locator("#materialPartReferenceValue")).toBeEnabled();
    await expect(page.locator("#materialPartReferenceValue")).toHaveValue("0");
    await expect(page.locator("#materialPartSimpleForm")).toContainText("Não altera o custo médio nem o valor do estoque.");
    const geometry = await page.evaluate(() => ({ innerWidth, documentWidth: document.documentElement.scrollWidth }));
    expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.innerWidth + 1);
  }
});

test("abas de Medições cabem no mobile sem corte visual", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./");
  await page.evaluate(bootDemo);
  await page.evaluate(() => window.eval(`setView("measurements", { persist:false, route:false }); renderStage15();`));
  const geometry = await page.locator("#measurements .stage15-tabs").evaluate(element => {
    const tabs = Array.from(element.querySelectorAll<HTMLElement>("button"));
    return { right: element.getBoundingClientRect().right, width: element.getBoundingClientRect().width, scrollWidth: element.scrollWidth, tabs: tabs.map(tab => ({ left: tab.getBoundingClientRect().left, right: tab.getBoundingClientRect().right })) };
  });
  expect(geometry.right).toBeLessThanOrEqual(391);
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width + 1);
  expect(geometry.tabs.every(tab => tab.left >= 0 && tab.right <= 390 + 1)).toBe(true);
});
