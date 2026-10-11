import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("pagina listas em 15 itens, permite 30 e mantém contraste no modo claro", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const rows = Array.from({ length: 31 }, (_, index) => `<tr><td>Item ${index + 1}</td></tr>`).join("");
    const fixture = `<html id="gm-premium"><body class="premium-shell theme-light">
      <main class="workspace"><section class="view" id="suppliers">
        <div class="table-wrap"><table><tbody id="supplierRows">${rows}</tbody></table></div>
      </section></main>
      <section class="order-execution-cta"><div class="order-execution-copy">
        <i class="order-execution-icon">✓</i><div><small>PRÓXIMA AÇÃO</small>
        <strong>O.S. pronta para iniciar</strong><span>Confirme o executante.</span></div>
      </div></section>
      <span class="tag status-overdue">Atrasada</span>
    </body></html>`;
    await page.route("https://gestman.test/fixture", route => route.fulfill({ status: 200, contentType: "text/html", body: fixture }));
    await page.goto("https://gestman.test/fixture");
    await page.addStyleTag({ content: `.order-execution-cta{background:#0a1726!important}.order-execution-copy strong{color:#fff!important}.tag.status-overdue{color:#fecaca!important}` });
    await page.addStyleTag({ path: resolve(root, "assets/ui/gestman-light-dashboard.css") });
    await page.addStyleTag({ content: `body{--p-blue:#1b61d6;--p-surface:#fff;--p-text:#172b43;--p-muted:#526981;--p-line:#c9d8e7}` });
    await page.addStyleTag({ path: resolve(root, "assets/ui/gestman-pagination.css") });
    await page.addScriptTag({ path: resolve(root, "assets/ui/gestman-pagination.js") });
    await page.evaluate(() => gmPaginateLegacyTables());

    const visibleCount = () => page.locator("#supplierRows tr:visible").count();
    assert.equal(await visibleCount(), 15);
    assert.match(await page.locator(".gm-page-summary").innerText(), /1–15 de 31 itens/);
    await page.getByRole("button", { name: "Página 2" }).click();
    assert.equal(await visibleCount(), 15);
    assert.equal(await page.locator("#supplierRows tr:visible").first().innerText(), "Item 16");
    assert.equal(await page.getByRole("button", { name: "Página 2" }).evaluate(el => getComputedStyle(el).backgroundColor), "rgb(27, 97, 214)");
    await page.getByLabel("Itens por página").selectOption("30");
    assert.equal(await visibleCount(), 30);
    assert.equal(await page.locator("#supplierRows tr:visible").first().innerText(), "Item 1");
    assert.equal(await page.evaluate(() => gmPageSize("legacy:suppliers:supplierRows")), 30);

    const colors = await page.evaluate(() => ({
      card: getComputedStyle(document.querySelector(".order-execution-cta")).backgroundColor,
      title: getComputedStyle(document.querySelector(".order-execution-copy strong")).color,
      overdue: getComputedStyle(document.querySelector(".tag.status-overdue")).color
    }));
    assert.equal(colors.card, "rgb(255, 255, 255)");
    assert.equal(colors.title, "rgb(23, 43, 67)");
    assert.equal(colors.overdue, "rgb(159, 29, 41)");
  } finally {
    await browser.close();
  }
});
