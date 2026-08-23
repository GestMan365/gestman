import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const outputDir = resolve("test-results/theme-audit/interactions");

test("estados interativos respeitam o tema claro", async ({ page }) => {
  test.setTimeout(120_000);
  mkdirSync(outputDir, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("./");
  await page.evaluate(() => {
    document.body.classList.remove("auth-required", "auth-loading", "auth-restoring", "platform-owner-mode", "company-request-route");
    window.eval(`
      currentAccount = {
        user: { id: "qa-theme-admin", name: "Auditor de Tema", role: "admin", accessProfile: "admin", active: true },
        company: { id: "qa-theme-company", name: "QA Tema", domain: "qa-tema" }
      };
      createDemoDataSet();
      applyTheme("light", { silent:true });
    `);
  });

  const scenarios = [
    { name: "asset-form", run: `setView("assets", {persist:false,route:false}); openAssetCreate();` },
    { name: "asset-detail", run: `hideCrudForm("assetForm"); setView("assets", {persist:false,route:false}); openAssetDetail(state.assets[0].id);` },
    { name: "asset-menu", run: `setView("assets", {persist:false,route:false}); closeAssetDetail(); renderAssetsWorkspace(); document.querySelector(".asset-row-actions")?.setAttribute("open", "");` },
    { name: "preventive-detail", run: `setView("preventivePlans", {persist:false,route:false}); openPreventivePlanDetail(state.preventivePlans[0].id);` },
    { name: "preventive-form", run: `setView("preventivePlans", {persist:false,route:false}); openPreventivePlanModal();` },
    { name: "checklist-menu", run: `closeModal(); setView("checklists", {persist:false,route:false}); document.querySelector(".checklist-row-menu")?.setAttribute("open", "");` },
    { name: "materials-menu", run: `closeModal(); setView("spares", {persist:false,route:false}); document.querySelector(".materials-row-menu")?.setAttribute("open", "");` },
    { name: "team-form", run: `closeModal(); setView("teamsResources", {persist:false,route:false}); stage19OpenTeamForm();` },
    { name: "tool-form", run: `closeModal(); setView("toolsControl", {persist:false,route:false}); stage18OpenToolForm();` },
  ];

  const results: Array<Record<string, unknown>> = [];
  for (const scenario of scenarios) {
    await page.evaluate((source) => window.eval(source), scenario.run);
    await page.waitForTimeout(80);
    const result = await page.evaluate((name) => {
      const parse = (value: string) => {
        const match = value.match(/rgba?\(([^)]+)\)/i);
        if (!match) return null;
        const p = match[1].split(",").map((part) => Number.parseFloat(part.trim()));
        return { r: p[0] || 0, g: p[1] || 0, b: p[2] || 0, a: Number.isFinite(p[3]) ? p[3] : 1 };
      };
      const channel = (value: number) => {
        const normalized = value / 255;
        return normalized <= 0.04045 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
      };
      const luminance = (color: { r: number; g: number; b: number }) =>
        0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
      const visible = (node: HTMLElement) => {
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0.1 && rect.width > 1 && rect.height > 1 && rect.bottom >= 0 && rect.top <= innerHeight;
      };
      const suspicious = Array.from(document.querySelectorAll<HTMLElement>("body *"))
        .filter(visible)
        .map((node) => {
          const style = getComputedStyle(node);
          const color = parse(style.backgroundColor);
          const rect = node.getBoundingClientRect();
          const selector = `${node.tagName.toLowerCase()}${node.id ? `#${node.id}` : ""}${node.classList.length ? `.${Array.from(node.classList).slice(0, 4).join(".")}` : ""}`;
          return { selector, background: style.backgroundColor, color: style.color, area: rect.width * rect.height, luminance: color ? luminance(color) : 1 };
        })
        .filter((item) => item.area > 2500 && item.luminance < 0.12 && !/(icon|logo|avatar|badge|status|toast|tooltip|qr|photo)/i.test(item.selector))
        .slice(0, 80);
      return { name, suspicious };
    }, scenario.name);
    results.push(result);
    await page.screenshot({ path: resolve(outputDir, `${scenario.name}.png`), fullPage: false });
  }
  writeFileSync(resolve(outputDir, "report.json"), JSON.stringify(results, null, 2));
  expect(results).toHaveLength(scenarios.length);
});
