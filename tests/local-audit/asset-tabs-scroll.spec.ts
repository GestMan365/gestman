import { expect, test } from "@playwright/test";

test("trocar abas do equipamento preserva a posição da página", async ({ page }) => {
  await page.setViewportSize({ width: 1103, height: 621 });
  await page.goto("./");
  await page.evaluate(() => {
    document.body.classList.remove("auth-required", "auth-loading", "auth-restoring");
    const auditStyle = document.createElement("style");
    auditStyle.textContent = "#authScreen{display:none!important}";
    document.head.append(auditStyle);
    for (const child of Array.from(document.body.children) as HTMLElement[]) child.style.display = "none";
    const panel = document.getElementById("assetDetailPanel")!;
    panel.classList.remove("is-hidden");
    const tabs = [["overview", "Visão Geral"], ["orders", "Ordens de Serviço"], ["plans", "Planos"], ["checklists", "Checklists"], ["measurements", "Medições"], ["downtimes", "Paradas"], ["parts", "Peças"], ["documents", "Documentos"], ["history", "Histórico"]];
    panel.innerHTML = `<nav class="asset-tabs">${tabs.map(([key, label]) => `<button type="button" class="${key === "overview" ? "active" : ""}" onclick="selectAssetTab('${key}')">${label}</button>`).join("")}</nav><div class="asset-tab-body" style="height:520px">Visão Geral</div>`;
    const spacer = document.createElement("div");
    spacer.style.height = "800px";
    document.body.append(spacer, panel);
    window.eval(`state.assets=[{id:"qa-asset"}];selectedAssetDetailId="qa-asset";`);
    (window as any).assetTabContent = (_asset: unknown, tab: string) => `<div style="height:${tab === "orders" ? 80 : 520}px">${tab}</div>`;
    (window as any).applyPermissionVisibility = () => {};
    window.scrollTo(0, 725);
  });

  const before = await page.evaluate(() => ({ scroll: window.scrollY, top: document.querySelector(".asset-tabs")!.getBoundingClientRect().top }));
  for (const label of ["Ordens de Serviço", "Planos", "Checklists", "Medições", "Paradas", "Peças", "Documentos", "Histórico", "Visão Geral"]) {
    const tab = page.locator("#assetDetailPanel .asset-tabs").getByRole("button", { name: label, exact: true });
    await tab.evaluate(button => { (button as HTMLButtonElement).focus({ preventScroll: true }); (button as HTMLButtonElement).click(); });
    const after = await page.evaluate(() => ({ scroll: window.scrollY, top: document.querySelector(".asset-tabs")!.getBoundingClientRect().top }));
    expect(Math.abs(after.scroll - before.scroll), `${label}: rolagem`).toBeLessThanOrEqual(1);
    expect(Math.abs(after.top - before.top), `${label}: posição das abas`).toBeLessThanOrEqual(1);
    await expect(tab).toHaveClass(/active/);
    await expect(tab).toBeFocused();
  }
});

test("trocar abas do equipamento preserva a rolagem no celular", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./");
  await page.evaluate(() => {
    document.body.classList.remove("auth-required", "auth-loading", "auth-restoring");
    const auditStyle = document.createElement("style");
    auditStyle.textContent = "#authScreen{display:none!important}";
    document.head.append(auditStyle);
    const panel = document.getElementById("assetDetailPanel")!;
    panel.classList.remove("is-hidden");
    panel.innerHTML = `<div style="height:160px"></div><nav class="asset-tabs"><button type="button" class="active" onclick="selectAssetTab('overview')">Visão Geral</button><button type="button" onclick="selectAssetTab('orders')">Ordens de Serviço</button></nav><div class="asset-tab-body"><div style="height:1200px">Visão Geral</div></div>`;
    document.body.append(panel);
    window.eval(`state.assets=[{id:"qa-asset"}];selectedAssetDetailId="qa-asset";`);
    (window as any).assetTabContent = () => `<div style="height:80px">Ordens de Serviço</div>`;
    (window as any).applyPermissionVisibility = () => {};
    panel.scrollTop = 160;
  });

  const panel = page.locator("#assetDetailPanel");
  const before = await panel.evaluate(element => element.scrollTop);
  await panel.getByRole("button", { name: "Ordens de Serviço" }).evaluate(button => (button as HTMLButtonElement).click());
  const after = await panel.evaluate(element => element.scrollTop);
  expect(Math.abs(after - before)).toBeLessThanOrEqual(1);
});
