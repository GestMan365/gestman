import { expect, test } from "@playwright/test";

for (const theme of ["dark", "light"]) {
  for (const viewport of [{ width: 1366, height: 768 }, { width: 951, height: 535 }, { width: 390, height: 844 }]) {
    test(`listagem OS — ${theme} ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
      await page.route("**/*", route => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort());
      await page.setViewportSize(viewport);
      await page.goto("./");
      await page.evaluate(theme => {
        document.body.classList.remove("auth-required", "auth-loading", "auth-restoring");
        window.eval(`
          currentAccount = { user: { id: "ui-audit-admin", name: "Auditor visual", role: "admin", accessProfile: "admin", active: true }, company: { id: "ui-audit-company", name: "QA visual" } };
          createDemoDataSet();
          state.orders = Array.from({length:12}, (_, i) => ({id:"list-qa-"+i, number:"QA-"+String(i+1).padStart(3,"0"), assetId:state.assets[0].id, description:"Inspeção do conjunto hidráulico e verificação dos componentes de segurança — equipamento de produção", type:i%2?"Preventiva":"Corretiva", priority:i%2?"Alta":"Baixa", status:i%2?"Em execucao":"Aberta", executor:"Técnico de manutenção industrial", requester:"QA", createdAt:Date.UTC(2026,8,20,12,i), scheduledAt:"2026-10-30T10:00", history:[], attachments:[]}));
          mobileMyOrdersOnly = false; mobileOrderFilter = "all";
          applyTheme("${theme}", {silent:true});
          setView("orders", {persist:false,route:false});
          render(); standardizeUiComponents(document);
        `);
      }, theme);
      const before = await page.evaluate(() => window.eval("JSON.stringify(state.orders)"));
      await expect(page.locator("#osListCount")).toHaveText("12 ordens encontradas");
      const cards = viewport.width <= 1024;
      const root = page.locator(cards ? "#osMobileCards" : "#orderRows");
      await expect(root.locator(".os-list-details")).toHaveCount(10);
      await expect(root.locator(".os-chip .gm-icon").first()).toBeAttached();
      if (!cards) await expect(root.locator(".os-title-cell small").first()).toHaveText("Preventiva");
      if (viewport.width === 390) await page.locator("#osFilterToggle").click();
      await page.locator("#osStatusFilter").selectOption("Aberta");
      await expect(page.locator("#osListCount")).toHaveText("6 ordens encontradas");
      await page.locator("#osPriorityFilter").selectOption("Alta");
      await expect(page.locator("#osListCount")).toHaveText("0 ordens encontradas");
      await expect(root).toContainText("Nenhuma O.S encontrada");
      await page.locator("#osFilterPanel .os-filter-btn").click();
      await expect(page.locator("#osListCount")).toHaveText("12 ordens encontradas");
      await page.locator("#osPeriodStart").fill("2026-09-21");
      await page.locator("#osPeriodStart").dispatchEvent("change");
      await expect(page.locator("#osListCount")).toHaveText("0 ordens encontradas");
      await page.locator("#osFilterPanel .os-filter-btn").click();
      if (viewport.width === 390) await page.locator(".gm-mobile-filter-close").click();
      await page.locator("#osSearch").fill("QA-001");
      await expect(page.locator("#osListCount")).toHaveText("1 ordem encontrada");
      const details = root.locator(".os-list-details").first();
      await details.focus();
      await page.keyboard.press("Tab");
      await page.keyboard.press("Shift+Tab");
      await expect(details).toBeFocused();
      expect(await details.evaluate(el => getComputedStyle(el).outlineStyle)).toBe("solid");
      await details.click();
      await expect(page.locator("#genericModal.open #orderDetailForm")).toBeVisible();
      await page.evaluate(() => window.eval("closeModal()"));
      expect(await page.evaluate(() => window.eval("JSON.stringify(state.orders)"))).toBe(before);
      await page.locator("#osSearch").fill("");
      await expect(page.locator("#osListCount")).toHaveText("12 ordens encontradas");
      await page.locator("#orders h1").scrollIntoViewIfNeeded();
      const geometry = await page.evaluate(() => {
        const workspace = document.querySelector(".workspace")!;
        const cards = Array.from(document.querySelectorAll("#osMobileCards .os-mobile-card"));
        return { width:innerWidth, pageWidth:document.documentElement.scrollWidth, workspaceWidth:workspace.clientWidth, scrollWidth:workspace.scrollWidth, clippedCards:cards.filter(card => {const r=card.getBoundingClientRect();return r.width>0 && (r.left<0 || r.right>innerWidth);}).length };
      });
      expect(geometry.pageWidth).toBeLessThanOrEqual(geometry.width + 1);
      expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.workspaceWidth + 1);
      expect(geometry.clippedCards).toBe(0);
      await page.screenshot({path:testInfo.outputPath("orders.png")});
    });
  }
}
