import { expect, test } from "@playwright/test";

async function prepareRouteAccount(page: import("@playwright/test").Page) {
  await page.evaluate(() => {
    window.eval(`
      currentAccount = {
        user:{ id:"qa-route-admin", name:"Administrador Rotas", role:"admin", accessProfile:"admin", active:true },
        company:{ id:"qa-route-company", login:"gestman.nadir", name:"Empresa Rotas", remoteSync:false }
      };
      state.assets = [{ id:"qa-route-asset", code:"ATV-ROTA-001", name:"Ativo de Rota", status:"Operando", criticality:"Alta", locationId:"" }];
      state.orders = [{ id:"qa-route-order", number:"O.S.-ROTA-001", assetId:"qa-route-asset", status:"Aberta", priority:"Alta", description:"O.S. de rota", createdAt:Date.now() }];
      document.body.classList.remove("auth-required", "auth-loading", "auth-restoring");
      applyPermissionVisibility();
    `);
  });
}

test("refresh direto restaura módulo, O.S. e filtros da query", async ({ page }) => {
  await page.goto("./?empresa=nadir&modulo=ordens-de-servico&os=qa-route-order&status=Aberta&prioridade=Alta");
  await prepareRouteAccount(page);
  expect(await page.evaluate(() => window.eval("restoreApplicationRoute()"))).toBe(true);

  await expect(page.locator("#orders")).toHaveClass(/active/);
  await expect(page.locator("#osStatusFilter")).toHaveValue("Aberta");
  await expect(page.locator("#osPriorityFilter")).toHaveValue("Alta");
  expect(await page.evaluate(() => window.eval("selectedOrderId"))).toBe("qa-route-order");
  expect(new URL(page.url()).searchParams.get("modulo")).toBe("ordens-de-servico");
  expect(new URL(page.url()).searchParams.get("os")).toBe("qa-route-order");
});

test("voltar e avançar restauram módulos sem recarregar a aplicação", async ({ page }) => {
  await page.goto("./?empresa=nadir&modulo=ordens-de-servico&os=qa-route-order");
  await prepareRouteAccount(page);
  await page.evaluate(() => window.eval("restoreApplicationRoute()"));
  await page.evaluate(() => window.eval('setView("assets")'));
  await expect.poll(() => new URL(page.url()).searchParams.get("modulo")).toBe("ativos-e-equipamentos");

  await page.evaluate(() => history.back());
  await expect(page.locator("#orders")).toHaveClass(/active/);
  expect(await page.evaluate(() => window.eval("selectedOrderId"))).toBe("qa-route-order");

  await page.evaluate(() => history.forward());
  await expect(page.locator("#assets")).toHaveClass(/active/);
  await expect.poll(() => new URL(page.url()).searchParams.get("modulo")).toBe("ativos-e-equipamentos");
});

test("entrada autenticada sempre começa em Visão Geral", async ({ page }) => {
  await page.goto("./?empresa=nadir&modulo=ordens-de-servico");
  await prepareRouteAccount(page);
  await page.evaluate(() => {
    window.eval('setView("orders")');
    window.eval("openOverviewAfterAuthentication()");
  });

  await expect(page.locator("#dashboard")).toHaveClass(/active/);
  await expect(page.locator('.tab[data-view="dashboard"]')).toHaveClass(/active/);
  expect(new URL(page.url()).searchParams.get("modulo")).toBe("visao-geral");
  expect(await page.evaluate(() => window.eval("savedActiveView()"))).toBe("dashboard");
});

test("indicador do mapa sinaliza O.S. nova e acompanha o andamento", async ({ page }) => {
  await page.goto("./");
  const alerts = await page.evaluate(() => window.eval(`(() => {
    const now = Date.now();
    state.orders = [
      { id:"map-recent", assetId:"asset-recent", status:"Em execução", createdAt:now - 30_000 },
      { id:"map-running", assetId:"asset-running", status:"Em execução", createdAt:now - 3600_000 },
      { id:"map-material", assetId:"asset-material", status:"Aguardando material", createdAt:now - 3600_000 },
      { id:"map-paused", assetId:"asset-paused", status:"Pausada", createdAt:now - 3600_000 },
      { id:"map-open", assetId:"asset-open", status:"Aberta", createdAt:now - 3600_000 }
    ];
    return ["recent", "running", "material", "paused", "open"].map(key => {
      const alert = orderAlertForAsset("asset-" + key);
      return { key, className:alert?.className, label:alert?.label, count:alert?.count };
    });
  })()`));

  expect(alerts).toEqual([
    { key:"recent", className:"recent", label:"O.S aberta há menos de 5 minutos", count:1 },
    { key:"running", className:"running", label:"O.S em execução", count:1 },
    { key:"material", className:"material", label:"O.S aguardando material", count:1 },
    { key:"paused", className:"paused", label:"O.S pausada", count:1 },
    { key:"open", className:"waiting", label:"O.S aberta aguardando início", count:1 },
  ]);

  const marker = await page.evaluate(() => window.eval(`(() => {
    const now = Date.now();
    state.regions = [{ id:"map-region", name:"Linha de Produção", x:2, y:2, w:96, h:90 }];
    state.locations = [{ id:"map-location", regionId:"map-region", name:"Linha 01", type:"Linha", x:8, y:12, w:80, h:70, color:"#2387ff" }];
    state.assets = [{ id:"asset-recent", code:"EQP-01", name:"Máquina 01", locationId:"map-location", x:50, y:50, status:"Operando", criticality:"Alta" }];
    state.orders = [{ id:"map-recent", assetId:"asset-recent", status:"Em execução", createdAt:now - 30_000 }];
    renderMap();
    const alert = document.querySelector("#industrialMap .machine-alert");
    return { className:alert?.className, text:alert?.textContent, title:alert?.getAttribute("title"), aria:alert?.getAttribute("aria-label") };
  })()`));
  expect(marker).toEqual({
    className:"machine-alert recent",
    text:"1",
    title:"O.S aberta há menos de 5 minutos",
    aria:"1 O.S aberta há menos de 5 minutos",
  });
});

test("rota de ativo abre detalhe e voltar retorna à lista", async ({ page }) => {
  await page.goto("./?empresa=nadir&modulo=ativos-e-equipamentos");
  await prepareRouteAccount(page);
  await page.evaluate(() => window.eval("restoreApplicationRoute()"));
  await page.evaluate(() => window.eval('openAssetDetail("qa-route-asset")'));
  await expect.poll(() => new URL(page.url()).searchParams.get("ativo")).toBe("qa-route-asset");
  await expect(page.locator("#assetDetailPanel")).not.toHaveClass(/is-hidden/);

  await page.evaluate(() => history.back());
  await expect.poll(() => page.evaluate(() => window.eval("selectedAssetDetailId"))).toBe(null);
  await expect(page.locator("#assetListPanel")).not.toHaveClass(/is-hidden/);
});

test("empresa divergente, ID inexistente e módulo sem permissão são bloqueados", async ({ page }) => {
  await page.goto("./?empresa=outra&modulo=ordens-de-servico&os=qa-route-order");
  await prepareRouteAccount(page);
  expect(await page.evaluate(() => window.eval("restoreApplicationRoute()"))).toBe(true);
  expect(new URL(page.url()).searchParams.get("empresa")).toBe(null);
  expect(new URL(page.url()).searchParams.get("os")).toBe(null);

  await page.evaluate(() => {
    history.replaceState({}, "", "?empresa=nadir&modulo=ordens-de-servico&os=nao-existe");
    window.eval("restoreApplicationRoute()");
  });
  expect(new URL(page.url()).searchParams.get("os")).toBe(null);

  await page.evaluate(() => {
    window.eval(`currentAccount.user = { id:"qa-requester", name:"Solicitante", role:"user", accessProfile:"requester", permissionLevels:profilePermissionTemplate("requester"), active:true };`);
    history.replaceState({}, "", "?empresa=nadir&modulo=relatorios");
    window.eval("restoreApplicationRoute()");
  });
  expect(new URL(page.url()).searchParams.get("modulo")).not.toBe("relatorios");
  expect(await page.evaluate(() => window.eval('canAccessView("reports")'))).toBe(false);
});

test("QR Codes novos incluem módulo e links antigos continuam aceitos", async ({ page }) => {
  await page.goto("./");
  await prepareRouteAccount(page);
  const urls = await page.evaluate(() => ({
    order:window.eval('orderQrUrl("qa-route-order")'),
    asset:window.eval('assetQrUrl("qa-route-asset")'),
  }));
  const order = new URL(urls.order);
  const asset = new URL(urls.asset);
  expect(order.searchParams.get("empresa")).toBe("nadir");
  expect(order.searchParams.get("modulo")).toBe("ordens-de-servico");
  expect(order.searchParams.get("os")).toBe("qa-route-order");
  expect(asset.searchParams.get("modulo")).toBe("ativos-e-equipamentos");
  expect(asset.searchParams.get("ativo")).toBe("qa-route-asset");

  await page.evaluate(() => {
    history.replaceState({}, "", "?empresa=nadir&os=qa-route-order");
    window.eval("restoreApplicationRoute()");
  });
  await expect(page.locator("#orders")).toHaveClass(/active/);
  expect(await page.evaluate(() => window.eval("selectedOrderId"))).toBe("qa-route-order");
});
