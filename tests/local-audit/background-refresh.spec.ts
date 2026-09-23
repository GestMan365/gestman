import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/*", route => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort());
  await page.goto("./");
  await page.evaluate(() => window.eval(`
    currentAccount = { company:{id:"qa-refresh",remoteSync:false}, user:{id:"qa",role:"admin",accessProfile:"admin"} };
    document.body.classList.remove("auth-required","auth-loading","auth-restoring");
    gmRenderLiveHealth();
  `));
});

test("status de conexão permanece sem controle de pausa visível", async ({ page, context }) => {
  await expect(page.locator(".gm-live-health button")).toHaveCount(0);
  await expect(page.getByText(/Pausar animações de alerta|Retomar animações de alerta/)).toHaveCount(0);
  await context.setOffline(true);
  await expect(page.locator(".gm-live-health")).toContainText("Sem conexão");
});

test("scroll e filtro são mantidos mesmo quando o bloco é recriado", async ({ page }) => {
  const result = await page.evaluate(() => window.eval(`(() => {
    const view = document.querySelector(".view.active");
    const markup = '<div id="qa-scroll" style="height:80px;overflow:auto"><div style="height:800px"><input id="qa-filter" value="inicial"></div></div>';
    view.insertAdjacentHTML("beforeend", markup);
    document.getElementById("qa-filter").value = "compressor";
    document.getElementById("qa-scroll").scrollTop = 220;
    gmRenderPreservingViewport(() => {
      document.getElementById("qa-scroll").outerHTML = markup;
    });
    return { value:document.getElementById("qa-filter").value, top:document.getElementById("qa-scroll").scrollTop };
  })()`));
  expect(result).toEqual({ value: "compressor", top: 220 });
});

test("formulário visível bloqueia refresh e módulos inativos não são redesenhados", async ({ page }) => {
  const result = await page.evaluate(() => window.eval(`(() => {
    const view = document.querySelector(".view.active");
    const form = document.createElement("form");
    form.innerHTML = '<input value="rascunho">';
    view.append(form);
    const blocked = gmBackgroundRefreshBlocked();
    form.remove();
    let tables=0, map=0, cards=0;
    renderTables=()=>tables++;
    renderMap=()=>map++;
    renderActiveOrdersPanel=()=>cards++;
    renderDashboardStops=()=>{};
    renderDashboardExecutors=()=>{};
    gmRefreshVisibleTimers();
    return { blocked,tables,map,cards };
  })()`));
  expect(result).toEqual({ blocked: true, tables: 0, map: 0, cards: 1 });
});
