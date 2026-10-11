import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { chromium } from "@playwright/test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(resolve(root, "index.html"), "utf8");
const fallback = readFileSync(resolve(root, "404.html"), "utf8");
const marker = "    function orderPriorityChip(priority) {";
const start = source.indexOf(marker);
const end = source.indexOf("    function orderTitle", start);
assert.ok(start > 0 && end > start);
assert.equal(source.slice(start, end), fallback.slice(fallback.indexOf(marker), fallback.indexOf("    function orderTitle", fallback.indexOf(marker))));

const render = runInNewContext(`${source.slice(start, end)}; orderPriorityChip`, {
  ptBrText: value => value,
  normalizeTextKey: value => String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(),
  escapeHtml: value => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;")
});

test("Urgente, Crítica, Alta, Média e Baixa recebem classes e cores distintas", async () => {
  const labels = ["Urgente", "Crítica", "Alta", "Média", "Baixa"];
  const expected = ["urgent", "critical", "high", "medium", "low"];
  labels.forEach((label, index) => assert.match(render(label), new RegExp(`priority-${expected[index]}`)));

  const browser = await chromium.launch({ headless:true });
  try {
    const page = await browser.newPage();
    await page.setContent(`<html><body class="theme-light"><main>${labels.map(render).join(" ")}</main></body></html>`);
    await page.addStyleTag({ content:"body.theme-light .tag{color:green!important;background:#dcfce7!important;border:1px solid green!important}" });
    await page.addStyleTag({ path:resolve(root, "assets/ui/gestman-light-dashboard.css") });
    const colors = await page.locator(".os-priority-chip").evaluateAll(chips => chips.map(chip => ({
      text:getComputedStyle(chip).color,
      background:getComputedStyle(chip).backgroundColor
    })));
    assert.equal(new Set(colors.map(color => color.text)).size, 5);
    assert.equal(new Set(colors.map(color => color.background)).size, 5);
  } finally {
    await browser.close();
  }
});
