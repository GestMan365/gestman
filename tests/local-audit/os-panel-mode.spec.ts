import { expect, test, type Page } from "@playwright/test";

const companyLogo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+AvzRkwAAAABJRU5ErkJggg==";

test("card inteiro pulsa por andamento, expira o alerta recente e respeita movimento reduzido", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await prepareOperationalPanel(page);
  const card = page.locator("#activeOrdersPanel .os-live-card");
  const cases = [
    { status: "Em execução", age: 60000, signal: "recent", color: "rgb(239, 68, 68)" },
    { status: "Em execução", age: 300000, signal: "running", color: "rgb(34, 197, 94)" },
    { status: "Aguardando material", age: 3600000, signal: "material", color: "rgb(245, 184, 46)" },
    { status: "Pausada", age: 3600000, signal: "paused", color: "rgb(249, 115, 22)" },
    { status: "Aberta", age: 3600000, signal: "waiting", color: "rgb(3, 157, 244)" },
  ];
  for (const theme of ["dark", "light"]) {
    await page.evaluate(theme => document.body.classList.toggle("theme-light", theme === "light"), theme);
    for (const scenario of cases) {
      await page.evaluate(({ status, age }) => window.eval(`
        state.orders[0].status = ${JSON.stringify(status)};
        state.orders[0].createdAt = new Date(Date.now() - ${age}).toISOString();
        renderActiveOrdersPanel("activeOrdersPanel");
      `), scenario);
      await expect(card).toHaveClass(new RegExp(scenario.signal));
      await expect(card).not.toContainText("Invalid Date");
      const style = await card.evaluate(el => {
        const s = getComputedStyle(el, "::after");
        return { animation: s.animationName, color: s.borderTopColor, pointer: s.pointerEvents, inset: s.top };
      });
      expect(style).toEqual({ animation: "gmOrderCardSignal", color: scenario.color, pointer: "none", inset: "0px" });
      if (scenario.signal === "recent") {
        await card.screenshot({ path: testInfo.outputPath(`card-recent-${theme}.png`) });
      }
    }
  }
  const opacity = await card.evaluate(el => getComputedStyle(el, "::after").opacity);
  await expect.poll(() => card.evaluate(el => getComputedStyle(el, "::after").opacity)).not.toBe(opacity);
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await card.evaluate(el => getComputedStyle(el, "::after").animationName)).toBe("none");
  await page.evaluate(() => window.eval('state.orders[0].status = "Concluída"; renderActiveOrdersPanel("activeOrdersPanel");'));
  await expect(card).toHaveCount(0);
});

async function prepareOperationalPanel(page: Page) {
  await page.goto("./?panel=os");
  await page.evaluate((logo) => {
    document.body.classList.remove("auth-required", "auth-loading");
    document.body.classList.add("panel-mode");
    document.querySelectorAll<HTMLElement>(".view").forEach(view => view.classList.remove("active"));
    document.querySelector<HTMLElement>("#activeOrders")!.classList.add("active");
    window.eval(`
      currentAccount = {
        user: { id: "audit-admin", role: "admin", accessProfile: "admin", name: "Auditor" },
        company: { id: "audit-company", name: "Indústria Auditada" }
      };
      state = {
        ...state,
        companyBrand: { companyLogo: ${JSON.stringify(logo)} },
        profile: { ...(state.profile || {}), company: "Indústria Auditada" },
        regions: [{ id: "region-audit", name: "Unidade Industrial" }],
        locations: [{ id: "location-audit", regionId: "region-audit", name: "Linha 01" }],
        assets: [{ id: "asset-audit", code: "EQP-001", name: "Compressor principal", locationId: "location-audit", icon: "factory" }],
        resources: [
          { id: "resource-a", code: "TEC-01", name: "Ana Técnica", specialty: "Mecânica", status: "Disponível" },
          { id: "resource-b", code: "TEC-02", name: "Carlos Executor", specialty: "Elétrica", status: "Disponível" }
        ],
        orders: [{
          id: "order-audit",
          number: "OS-2026-001",
          title: "Inspeção do compressor",
          description: "Verificar vibração e temperatura.",
          assetId: "asset-audit",
          requester: "PCM",
          executor: "Ana Técnica",
          executorIds: ["resource-a", "resource-b"],
          executorSnapshot: [
            { id: "resource-a", name: "Ana Técnica" },
            { id: "resource-b", name: "Carlos Executor" }
          ],
          status: "Em execução",
          priority: "Alta",
          createdAt: Date.now() - 3600000,
          startedAt: Date.now() - 1800000
        }]
      };
      renderOsPanelBrand();
      setOsPanelFiltersCollapsed(false, false);
      renderActiveOrdersPanel("activeOrdersPanel");
    `);
  }, companyLogo);
}

test("painel de O.S. é independente, exibe as duas marcas e permite ocultar filtros", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await prepareOperationalPanel(page);

  for (const selector of ["#mainNavigation", ".reference-topbar", ".platform-owner-header", ".mobile-bottom-nav", "#activeOrders > .gm01-page-header"]) {
    await expect(page.locator(selector).first()).toBeHidden();
  }

  const header = page.locator(".os-broadcast-head");
  await expect(header).toBeVisible();
  await expect(header.getByText("Copiar link", { exact: true })).toHaveCount(0);
  await expect(header.getByText("Voltar ao sistema", { exact: true })).toHaveCount(0);
  await expect(page.locator(".os-broadcast-system-logo img")).toBeVisible();
  await expect(page.locator("#osPanelCompanyLogo")).toBeVisible();
  await expect(page.locator("#osPanelCompanyName")).toHaveText("Indústria Auditada");

  const filterBorders = await page.locator("#osPanelFilters label").evaluateAll(labels => labels.map(label => getComputedStyle(label).borderTopWidth));
  expect(filterBorders).toEqual(["1px", "1px", "1px", "1px"]);

  await expect(page.locator("#activeOrdersPanel .os-live-card")).toHaveCount(1);
  await expect(page.locator("#activeOrdersPanel")).toContainText("Ana Técnica · Carlos Executor");

  await page.locator("#osPanelFilterToggle").click();
  await expect(page.locator("#osPanelFilters")).toBeHidden();
  await expect(page.locator("#osPanelFilterToggleLabel")).toHaveText("Mostrar filtros");
  await page.locator("#osPanelFilterToggle").click();
  await expect(page.locator("#osPanelFilters")).toBeVisible();
  await expect(page.locator("#osPanelFilterToggleLabel")).toHaveText("Ocultar filtros");
});

test("painel de O.S. ocupa a largura mobile sem sobreposição", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await prepareOperationalPanel(page);

  const layout = await page.evaluate(() => ({
    innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    workspaceWidth: document.querySelector<HTMLElement>(".workspace")!.getBoundingClientRect().width,
    panelLeft: document.querySelector<HTMLElement>("#activeOrders")!.getBoundingClientRect().left,
  }));

  expect(layout.documentWidth).toBeLessThanOrEqual(layout.innerWidth + 1);
  expect(layout.workspaceWidth).toBeCloseTo(layout.innerWidth, 0);
  expect(layout.panelLeft).toBeGreaterThanOrEqual(0);
  await expect(page.locator(".os-broadcast-system-logo")).toBeVisible();
  await expect(page.locator(".os-broadcast-company-brand")).toBeVisible();
  await expect(page.locator("#activeOrdersPanel .os-live-card")).toBeVisible();
});
