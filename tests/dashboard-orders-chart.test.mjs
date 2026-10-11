import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { chromium } from "@playwright/test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(resolve(root, "index.html"), "utf8");
const fallback = readFileSync(resolve(root, "404.html"), "utf8");
const marker = "    function renderIndustrialOrdersChart() {";
const start = source.indexOf(marker);
const end = source.indexOf("    function renderIndustrialPartsDonut()", start);
assert.ok(start > 0 && end > start);
assert.equal(source.slice(start, end), fallback.slice(fallback.indexOf(marker), fallback.indexOf("    function renderIndustrialPartsDonut()", fallback.indexOf(marker))));

test("gráfico de O.S. mostra valores diários e totais reais, sem barras falsas para zero", async () => {
  const browser = await chromium.launch({ headless:true });
  try {
    const page = await browser.newPage();
    await page.setContent(`<div id="dashboard"><article class="industrial-chart-card"><div class="chart-legend"></div><div id="industrialOrdersChart" class="industrial-stacked-chart"></div></article></div>`);
    await page.addScriptTag({ content:`var chartOrders=[]; function $(id){return document.getElementById(id)}; function dashboardFilteredData(){return {orders:chartOrders}}; function orderIsLate(order){return !!order.late}; function escapeHtml(value){return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;')}; ${source.slice(start, end)}` });
    await page.evaluate(() => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
      chartOrders = [
        { createdAt:new Date(today.getTime() + 3600000).toISOString() },
        { createdAt:new Date(today.getTime() + 7200000).toISOString() },
        { createdAt:yesterday.toISOString(), finishedAt:new Date(today.getTime() + 10800000).toISOString() },
        { createdAt:yesterday.toISOString(), scheduledAt:yesterday.toISOString(), late:true }
      ];
      renderIndustrialOrdersChart();
    });
    assert.deepEqual(await page.locator(".chart-legend strong").allInnerTexts(), ["4", "1", "1"]);
    assert.deepEqual(await page.locator(".stacked-day").last().locator(".stacked-counts span").allInnerTexts(), ["2", "1", "0"]);
    assert.deepEqual(await page.locator(".stacked-day").last().locator(".stacked-value").allInnerTexts(), ["2", "1"]);
    assert.equal(await page.locator(".stacked-day").last().locator(".stacked-column.late").getAttribute("style"), "display:none");
    assert.match(await page.locator(".stacked-day-footer > span").last().innerText(), /\d{2}\/\d{2}/);

    await page.evaluate(() => { chartOrders = []; renderIndustrialOrdersChart(); });
    assert.deepEqual(await page.locator(".chart-legend strong").allInnerTexts(), ["0", "0", "0"]);
    assert.equal(await page.locator(".stacked-value").count(), 0);
  } finally {
    await browser.close();
  }
});
