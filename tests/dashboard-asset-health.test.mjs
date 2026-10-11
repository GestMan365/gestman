import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { chromium } from "@playwright/test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(resolve(root, "index.html"), "utf8");
const fallback = readFileSync(resolve(root, "404.html"), "utf8");
const marker = "    function renderCriticalityBars() {";
const start = source.indexOf(marker);
const end = source.indexOf("    function openMaintenanceBacklog()", start);
assert.ok(start > 0 && end > start);
assert.equal(source.slice(start, end), fallback.slice(fallback.indexOf(marker), fallback.indexOf("    function openMaintenanceBacklog()", fallback.indexOf(marker))));

test("saúde dos ativos compacta mostra resumo e distribuição reais", async () => {
  const browser = await chromium.launch({ headless:true });
  try {
    const page = await browser.newPage({ viewport:{ width:1600, height:900 } });
    await page.setContent(`<html><body class="theme-light"><section id="dashboard"><div class="industrial-dashboard-widget-grid" style="display:grid;grid-template-columns:repeat(12,minmax(0,1fr));width:1200px"><article class="maintenance-backlog-card"></article><article class="asset-health-card"><div class="asset-health-content" id="criticalityBars"></div></article></div></section></body></html>`);
    await page.addStyleTag({ path:resolve(root, "assets/ui/gestman-light-dashboard.css") });
    await page.addScriptTag({ content:`var demoAssets=[]; function $(id){return document.getElementById(id)}; function dashboardFilteredData(){return {assets:demoAssets}}; function assetHealthCategory(asset){return {key:asset.health}}; function industrialDonutGradient(){return 'conic-gradient(#22c55e 0 25%,#1d8cff 25% 50%,#facc15 50% 75%,#ef4444 75% 100%)'}; ${source.slice(start, end)}` });
    await page.evaluate(() => {
      demoAssets = ["excellent", "good", "good", "regular", "critical"].map(health => ({ health }));
      renderCriticalityBars();
    });
    assert.match(await page.locator(".asset-health-summary").innerText(), /2\s+sob atenção/);
    assert.match(await page.locator(".asset-health-summary").innerText(), /3 em condição boa ou excelente · 60%/);
    assert.deepEqual(await page.locator(".asset-health-breakdown-head strong").allInnerTexts(), ["1", "2", "1", "1"]);
    assert.match(await page.locator(".asset-health-footer button").innerText(), /Ver 1 ativo crítico/);
    assert.equal(await page.locator(".asset-health-card").evaluate(card => getComputedStyle(card).gridColumnStart), "span 4");
    assert.equal(await page.locator(".maintenance-backlog-card").evaluate(card => getComputedStyle(card).gridColumnStart), "span 8");
    const desktopWidths = await page.locator(".industrial-dashboard-widget-grid").evaluate(grid => ({
      health:grid.querySelector(".asset-health-card").getBoundingClientRect().width,
      backlog:grid.querySelector(".maintenance-backlog-card").getBoundingClientRect().width
    }));
    assert.ok(desktopWidths.health < desktopWidths.backlog);

    await page.setViewportSize({ width:900, height:900 });
    assert.equal(await page.locator(".asset-health-card").evaluate(card => getComputedStyle(card).gridColumnEnd), "-1");
    await page.evaluate(() => { demoAssets = []; renderCriticalityBars(); });
    assert.match(await page.locator(".asset-health-summary").innerText(), /0\s+sob atenção/);
    assert.deepEqual(await page.locator(".asset-health-breakdown-head strong").allInnerTexts(), ["0", "0", "0", "0"]);
  } finally {
    await browser.close();
  }
});
