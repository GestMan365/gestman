import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const viewports = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];

for (const viewport of viewports) {
  test(`login permanece íntegro em ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("./");
    await expect(page.getByRole("heading", { name: "Acesse sua conta" })).toBeVisible();
    await expect(page.locator(".auth-card")).toBeVisible();
    const authLogo = page.locator("#authScreen img.auth-logo-img:visible").first();
    await expect(authLogo).toBeVisible();
    await expect.poll(() => authLogo.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);

    const layout = await page.evaluate(() => {
      const card = document.querySelector<HTMLElement>(".auth-card")!;
      const rect = card.getBoundingClientRect();
      const style = getComputedStyle(card);
      return {
        innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        left: rect.left,
        right: rect.right,
        borderWidth: parseFloat(style.borderTopWidth),
        borderColor: style.borderTopColor,
      };
    });

    expect(layout.documentWidth).toBeLessThanOrEqual(layout.innerWidth + 1);
    expect(layout.left).toBeGreaterThanOrEqual(0);
    expect(layout.right).toBeLessThanOrEqual(layout.innerWidth + 1);
    expect(layout.borderWidth).toBeGreaterThan(0);
    expect(layout.borderColor).not.toBe("rgba(0, 0, 0, 0)");
  });
}

test("modal longo mantém cabeçalho fixo e conteúdo rolável dentro da tela", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("./");
  await page.evaluate(() => {
    document.body.classList.remove("auth-required", "auth-loading");
    const backdrop = document.querySelector<HTMLElement>("#genericModal")!;
    const box = document.querySelector<HTMLElement>("#genericModalBox")!;
    const body = document.querySelector<HTMLElement>("#genericBody")!;
    backdrop.classList.add("open");
    box.classList.add("large");
    body.innerHTML = `<form>${Array.from({ length: 60 }, (_, index) =>
      `<label>Campo ${index + 1}<input class="field" value="GFG-QA-${index + 1}"></label>`,
    ).join("")}<button id="auditLastAction" type="button">Salvar</button></form>`;
  });

  const result = await page.evaluate(() => {
    const box = document.querySelector<HTMLElement>("#genericModalBox")!;
    const body = document.querySelector<HTMLElement>("#genericBody")!;
    const before = body.scrollTop;
    body.scrollTop = body.scrollHeight;
    const boxRect = box.getBoundingClientRect();
    const actionRect = document.querySelector<HTMLElement>("#auditLastAction")!.getBoundingClientRect();
    return {
      boxDisplay: getComputedStyle(box).display,
      boxOverflow: getComputedStyle(box).overflow,
      bodyOverflowY: getComputedStyle(body).overflowY,
      scrollable: body.scrollHeight > body.clientHeight,
      scrolled: body.scrollTop > before,
      boxTop: boxRect.top,
      boxBottom: boxRect.bottom,
      actionTop: actionRect.top,
      actionBottom: actionRect.bottom,
      viewportHeight: innerHeight,
    };
  });

  expect(result.boxDisplay).toBe("flex");
  expect(result.boxOverflow).toBe("hidden");
  expect(result.bodyOverflowY).toBe("auto");
  expect(result.scrollable).toBe(true);
  expect(result.scrolled).toBe(true);
  expect(result.boxTop).toBeGreaterThanOrEqual(0);
  expect(result.boxBottom).toBeLessThanOrEqual(result.viewportHeight + 1);
  expect(result.actionTop).toBeGreaterThanOrEqual(result.boxTop);
  expect(result.actionBottom).toBeLessThanOrEqual(result.boxBottom + 1);
});

test("navegação superior mantém nomes visíveis e não oferece recolhimento", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("./");
  await page.evaluate(() => document.body.classList.remove("auth-required", "auth-loading"));

  const desktop = await page.evaluate(() => {
    const nav = document.querySelector<HTMLElement>("#mainNavigation")!;
    const topbar = document.querySelector<HTMLElement>(".reference-topbar")!;
    const workspace = document.querySelector<HTMLElement>(".workspace")!;
    const navRect = nav.getBoundingClientRect();
    const topbarRect = topbar.getBoundingClientRect();
    const workspaceRect = workspace.getBoundingClientRect();
    return {
      nav: { x: navRect.x, y: navRect.y, width: navRect.width, height: navRect.height },
      topbarBottom: topbarRect.bottom,
      workspace: { x: workspaceRect.x, y: workspaceRect.y, width: workspaceRect.width },
      collapseVisible: Array.from(document.querySelectorAll<HTMLElement>("#navToggleBtn,#topbarMenuBtn"))
        .some((button) => getComputedStyle(button).display !== "none"),
    };
  });
  expect(desktop.nav.x).toBe(0);
  expect(desktop.nav.width).toBeCloseTo(1366, 0);
  expect(desktop.nav.height).toBeCloseTo(50, 0);
  expect(desktop.nav.y).toBeCloseTo(desktop.topbarBottom, 0);
  expect(desktop.workspace.x).toBe(0);
  expect(desktop.workspace.width).toBeCloseTo(1366, 0);
  expect(desktop.workspace.y).toBeCloseTo(desktop.nav.y + desktop.nav.height, 0);
  expect(desktop.collapseVisible).toBe(false);

  for (const label of ["Acessos Rápidos", "Visão Geral", "Manutenção", "Ativos e Instalações", "Materiais", "Planejamento", "Gestão", "Administração"]) {
    await expect(page.locator("#mainNavigation").getByText(label, { exact: true })).toBeVisible();
  }

  const closedActiveGroup = await page.evaluate(() => {
    const activeGroup = document.querySelector<HTMLDetailsElement>('#mainNavigation [data-nav-group="assets"]')!;
    const referenceGroup = document.querySelector<HTMLDetailsElement>('#mainNavigation [data-nav-group="materials"]')!;
    activeGroup.open = false;
    referenceGroup.open = false;
    activeGroup.classList.add("contains-active");
    const activeStyle = getComputedStyle(activeGroup.querySelector("summary")!);
    const referenceStyle = getComputedStyle(referenceGroup.querySelector("summary")!);
    return {
      activeBackground: activeStyle.backgroundColor,
      referenceBackground: referenceStyle.backgroundColor,
      activeBorder: activeStyle.borderColor,
      referenceBorder: referenceStyle.borderColor,
      activeShadow: activeStyle.boxShadow,
    };
  });
  expect(closedActiveGroup.activeBackground).toBe(closedActiveGroup.referenceBackground);
  expect(closedActiveGroup.activeBorder).toBe(closedActiveGroup.referenceBorder);
  expect(closedActiveGroup.activeShadow).toBe("none");

  await page.locator('#mainNavigation [data-nav-group="maintenance"] > summary').click();
  await expect(page.locator('#mainNavigation [data-nav-group="maintenance"] .nav-group-items')).toBeVisible();
  await expect(page.locator('#mainNavigation [data-view="orders"]')).toContainText("Ordens de Serviço");

  await page.evaluate(() => window.eval("setNavCollapsed(true)"));
  expect(await page.evaluate(() => document.body.classList.contains("sidebar-collapsed"))).toBe(false);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => {
    document.querySelectorAll<HTMLDetailsElement>("#mainNavigation [data-nav-group]").forEach((group) => { group.open = false; });
  });
  const mobile = await page.locator("#mainNavigation").boundingBox();
  expect(mobile).not.toBeNull();
  expect(mobile!.x).toBe(0);
  expect(mobile!.width).toBeCloseTo(390, 0);
  expect(mobile!.height).toBeCloseTo(60, 0);
  await page.evaluate(() => {
    document.querySelector<HTMLDetailsElement>('#mainNavigation [data-nav-group="maintenance"]')!.open = true;
  });
  await expect(page.locator('#mainNavigation [data-nav-group="maintenance"] .nav-group-items')).toBeVisible();
  await expect(page.locator('#mainNavigation [data-view="orders"]')).toContainText("Ordens de Serviço");
  const dimensions = await page.evaluate(() => ({
    innerWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.innerWidth + 1);
});

test("index e fallback preservam as três correções da auditoria", () => {
  const index = readFileSync(resolve("index.html"), "utf8");
  const fallback = readFileSync(resolve("404.html"), "utf8");
  expect(fallback).toBe(index);
  expect(index).toContain(
    'profile === "technician" ? (userTeamIds.length ? userTeamIds : currentTeamIds) : []',
  );
  expect(index).toMatch(/#genericModalBox\s*>\s*\.modal-body\s*\{[\s\S]*?overflow-y:\s*auto\s*!important/);
  expect(index).toContain("border: 1px solid rgba(255, 255, 255, .72) !important;");
  expect(index).toContain("border-radius: 18px !important;");
});

test("menu de Equipes e Recursos permanece inteiro dentro do viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("./");
  await page.evaluate(() => {
    document.body.classList.remove("auth-required", "auth-loading");
    document.querySelectorAll<HTMLElement>(".view").forEach((view) => view.classList.remove("active"));
    document.querySelector<HTMLElement>("#teamsResources")!.classList.add("active");
    window.eval(`
      currentAccount = { user: { id: "audit-admin", role: "admin", accessProfile: "admin", name: "Auditor" }, company: { id: "audit-company" } };
      state.orders = [];
      state.resources = [{ id: "audit-resource", code: "QA-REC-001", name: "Recurso de Auditoria", specialty: "Mecânica", status: "Disponível", resourceType: "Usuário interno" }];
      state.teams = [{ id: "audit-team", code: "QA-EQP-001", name: "Equipe de Auditoria", specialty: "Mecânica", status: "Ativa", leaderId: "audit-resource", memberIds: ["audit-resource"] }];
      stage19Ui.tab = "teams";
      stage19Ui.page = 1;
      renderStage19Teams();
    `);
  });

  const tableWrap = page.locator("#stage19TeamsRoot .stage19-table-wrap");
  await tableWrap.evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
  });
  const details = page.locator("#stage19TeamsRoot .stage19-table tbody .stage19-menu").first();
  await details.locator("summary").click();

  const geometry = await details.evaluate((element) => {
    const menu = element.querySelector<HTMLElement>(":scope > div")!;
    const rect = menu.getBoundingClientRect();
    return {
      position: getComputedStyle(menu).position,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
      documentWidth: document.documentElement.scrollWidth,
    };
  });

  expect(geometry.position).toBe("fixed");
  expect(geometry.top).toBeGreaterThanOrEqual(8);
  expect(geometry.left).toBeGreaterThanOrEqual(8);
  expect(geometry.right).toBeLessThanOrEqual(geometry.viewportWidth - 8 + 1);
  expect(geometry.bottom).toBeLessThanOrEqual(geometry.viewportHeight - 8 + 1);
  expect(geometry.width).toBeGreaterThan(150);
  expect(geometry.height).toBeGreaterThan(100);
  expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1);

  await details.evaluate((element: HTMLDetailsElement) => {
    element.open = false;
  });
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileDetails = page.locator("#stage19TeamsRoot .stage19-cards .stage19-menu").first();
  await mobileDetails.locator("summary").click();
  const mobileGeometry = await mobileDetails.evaluate((element) => {
    const menu = element.querySelector<HTMLElement>(":scope > div")!;
    const rect = menu.getBoundingClientRect();
    return {
      position: getComputedStyle(menu).position,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      left: rect.left,
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
      documentWidth: document.documentElement.scrollWidth,
    };
  });
  expect(mobileGeometry.position).toBe("fixed");
  expect(mobileGeometry.top).toBeGreaterThanOrEqual(8);
  expect(mobileGeometry.left).toBeGreaterThanOrEqual(8);
  expect(mobileGeometry.right).toBeLessThanOrEqual(mobileGeometry.viewportWidth - 8 + 1);
  expect(mobileGeometry.bottom).toBeLessThanOrEqual(mobileGeometry.viewportHeight - 8 + 1);
  expect(mobileGeometry.documentWidth).toBeLessThanOrEqual(mobileGeometry.viewportWidth + 1);
});

test("Planos de Manutenção contém tabelas largas sem overflow global", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("./");
  await page.evaluate(() => {
    document.body.classList.remove("auth-required", "auth-loading");
    document.querySelectorAll<HTMLElement>(".view").forEach((view) => view.classList.remove("active"));
    document.querySelector<HTMLElement>("#preventivePlans")!.classList.add("active");
    window.eval(`
      currentAccount = { user: { id: "audit-admin", role: "admin", accessProfile: "admin", name: "Auditor" }, company: { id: "audit-company" } };
      state.assets = Array.from({ length: 12 }, (_, index) => ({ id: "audit-asset-" + index, code: "QA-ATV-" + String(index + 1).padStart(3, "0"), name: "Equipamento industrial de auditoria " + (index + 1) }));
      state.orders = [];
      state.preventivePlans = state.assets.map((asset, index) => ({ id: "audit-plan-" + index, name: "Plano preventivo de auditoria " + (index + 1), assetId: asset.id, frequency: "Mensal", nextExecution: "2026-09-15", responsible: "Equipe de Auditoria", status: "Ativo" }));
      preventiveWorkspacePage = 1;
      renderPreventivePlansWorkspace();
    `);
  });

  const dimensions = await page.evaluate(() => {
    const view = document.querySelector<HTMLElement>("#preventivePlans")!;
    const filters = document.querySelector<HTMLElement>("#preventiveFilterPanel")!;
    const wrapper = document.querySelector<HTMLElement>("#preventivePlans .preventive-table-wrap")!;
    const viewRect = view.getBoundingClientRect();
    const filterRect = filters.getBoundingClientRect();
    const wrapperRect = wrapper.getBoundingClientRect();
    return {
      innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      viewRight: viewRect.right,
      filterRight: filterRect.right,
      wrapperRight: wrapperRect.right,
      wrapperClientWidth: wrapper.clientWidth,
      wrapperScrollWidth: wrapper.scrollWidth,
      wrapperOverflowX: getComputedStyle(wrapper).overflowX,
    };
  });

  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.innerWidth + 1);
  expect(dimensions.viewRight).toBeLessThanOrEqual(dimensions.innerWidth + 1);
  expect(dimensions.filterRight).toBeLessThanOrEqual(dimensions.innerWidth + 1);
  expect(dimensions.wrapperRight).toBeLessThanOrEqual(dimensions.innerWidth + 1);
  expect(["auto", "scroll"]).toContain(dimensions.wrapperOverflowX);
  expect(dimensions.wrapperScrollWidth).toBeGreaterThanOrEqual(dimensions.wrapperClientWidth);

  await page.setViewportSize({ width: 1920, height: 1080 });
  const wideDimensions = await page.evaluate(() => ({
    innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    viewRight: document.querySelector<HTMLElement>("#preventivePlans")!.getBoundingClientRect().right,
    filterRight: document.querySelector<HTMLElement>("#preventiveFilterPanel")!.getBoundingClientRect().right,
    wrapperRight: document.querySelector<HTMLElement>("#preventivePlans .preventive-table-wrap")!.getBoundingClientRect().right,
  }));
  expect(wideDimensions.documentWidth).toBeLessThanOrEqual(wideDimensions.innerWidth + 1);
  expect(wideDimensions.viewRight).toBeLessThanOrEqual(wideDimensions.innerWidth + 1);
  expect(wideDimensions.filterRight).toBeLessThanOrEqual(wideDimensions.innerWidth + 1);
  expect(wideDimensions.wrapperRight).toBeLessThanOrEqual(wideDimensions.innerWidth + 1);
});
