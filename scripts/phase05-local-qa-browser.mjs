import assert from "node:assert/strict";
import { calibrateViewport } from "./preventive-local-qa-browser.mjs";

export const phase05Viewports = [
  { width:951, height:535 },
  { width:1103, height:621 },
  { width:1366, height:768 },
  { width:390, height:844 },
];

export const phase05Views = [
  "quickAccess", "dashboard", "orders", "activeOrders", "preventivePlans",
  "checklists", "measurements", "pendingActions", "downtime", "operationalDiary",
  "assets", "tags", "operationalAreas", "regions", "locations", "map",
  "documentsCenter", "spares", "stock", "stockMoves", "stockTransfers",
  "materialRequests", "suppliers", "toolsControl", "teamsResources", "calendar",
  "productiveCalendars", "maintenanceIndicators", "reports", "assistant",
];

const viewGroups = new Map([
  ...["orders", "activeOrders", "preventivePlans", "checklists", "measurements", "pendingActions", "downtime", "operationalDiary"].map(view => [view, "Manutenção"]),
  ...["assets", "tags", "operationalAreas", "regions", "locations", "map", "documentsCenter"].map(view => [view, "Ativos e Instalações"]),
  ...["spares", "stock", "stockMoves", "stockTransfers", "materialRequests", "suppliers", "toolsControl"].map(view => [view, "Materiais"]),
  ...["teamsResources", "calendar", "productiveCalendars"].map(view => [view, "Planejamento"]),
  ...["maintenanceIndicators", "reports", "assistant"].map(view => [view, "Gestão"]),
]);

export async function activateView(tab, view) {
  const selector = `#mainNavigation [data-view="${view}"]`;
  const group = viewGroups.get(view);
  if (group) await tab.playwright.locator("#mainNavigation .nav-group > summary").filter({ hasText:group }).click();
  await tab.playwright.locator(selector).click();
  const active = await tab.playwright.locator(".view.active").getAttribute("id");
  const expected = ["spares", "stockMoves", "stockTransfers", "materialRequests"].includes(view) ? "spares" : view;
  assert.equal(active, expected);
}

export function measurePhase05View() {
  const visible = element => Boolean(element?.getClientRects().length) && getComputedStyle(element).visibility !== "hidden";
  const box = element => element.getBoundingClientRect().toJSON();
  const insideHorizontalScroller = element => {
    for (let parent=element.parentElement;parent;parent=parent.parentElement) {
      const overflow=getComputedStyle(parent).overflowX;
      if (["auto", "scroll"].includes(overflow) && parent.scrollWidth > parent.clientWidth + 1) return true;
    }
    return false;
  };
  const controls = [...document.querySelectorAll("button,summary,input,select,textarea,[tabindex]")].filter(visible);
  const compact = controls.map(element => ({
    label:(element.getAttribute("aria-label") || element.textContent || element.id || element.className || "").trim().slice(0,80),
    className:String(element.className || ""),
    box:box(element),
  })).filter(item => item.box.height < 32 && (
    /chart-link-button|maintenance-agenda|gm-icon-only|row-menu|row-actions|stage14-row-actions|mobile-tech-section-head/.test(item.className)
  ));
  const clipped = controls.map(element => ({
    label:(element.getAttribute("aria-label") || element.textContent || element.id || "").trim().slice(0,80),
    box:box(element),
    handled:insideHorizontalScroller(element),
  })).filter(item => !item.handled && (item.box.left < -1 || item.box.right > innerWidth + 1));
  const genericGlyphs = controls.filter(element => !element.closest("#mainNavigation"))
    .filter(element => /[⌕⋮☷＋▣‹›↻✋⚙]/u.test(element.textContent || "") && !element.querySelector(".gm-icon"))
    .map(element => (element.getAttribute("aria-label") || element.textContent || "").trim().slice(0,80));
  const workspace = document.querySelector(".workspace");
  return {
    viewport:{ width:innerWidth, height:innerHeight },
    activeView:document.querySelector(".view.active")?.id || "",
    horizontal:document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
      || workspace.scrollWidth > workspace.clientWidth + 1,
    clipped,
    compact,
    genericGlyphs,
  };
}

export async function auditPhase05View(tab, target, view) {
  await activateView(tab, view);
  const result = await tab.playwright.evaluate(measurePhase05View);
  assert.equal(result.viewport.width, target.width);
  assert.equal(result.viewport.height, target.height);
  assert.equal(result.horizontal, false, `${view}: rolagem horizontal global`);
  assert.equal(result.clipped.length, 0, `${view}: controles fora da viewport: ${JSON.stringify(result.clipped)}`);
  assert.equal(result.compact.length, 0, `${view}: controles compactos menores que 32px: ${JSON.stringify(result.compact)}`);
  assert.equal(result.genericGlyphs.length, 0, `${view}: ícones Unicode não decorados: ${JSON.stringify(result.genericGlyphs)}`);
  return result;
}

export async function auditPhase05Matrix(tab, viewportCapability, targets=phase05Viewports, views=phase05Views) {
  const results = [];
  for (const target of targets) {
    await calibrateViewport(tab, viewportCapability, target);
    for (const view of views) results.push(await auditPhase05View(tab, target, view));
  }
  return results;
}
