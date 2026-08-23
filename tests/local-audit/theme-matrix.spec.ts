import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

type ThemeAudit = {
  theme: "light" | "dark";
  view: string;
  lowContrast: Array<Record<string, string | number>>;
  suspiciousSurfaces: Array<Record<string, string | number>>;
  suspiciousControls: Array<Record<string, string | number>>;
  header: Record<string, string>;
  overflow: { innerWidth: number; documentWidth: number };
};

const outputDir = resolve("test-results/theme-audit");

test("matriz visual claro e escuro de todos os módulos", async ({ page }) => {
  test.setTimeout(180_000);
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
      try { createDemoDataSet(); } catch (error) { console.warn("theme-audit demo seed", error); }
    `);
  });

  const viewIds = await page.locator("section.view").evaluateAll((views) => views.map((view) => view.id).filter(Boolean));
  expect(viewIds.length).toBeGreaterThanOrEqual(25);
  const report: ThemeAudit[] = [];

  for (const theme of ["light", "dark"] as const) {
    await page.evaluate((nextTheme) => window.eval(`applyTheme("${nextTheme}", { silent:true })`), theme);
    for (const view of viewIds) {
      await page.evaluate((viewId) => {
        document.body.classList.remove("auth-required", "auth-loading", "auth-restoring", "platform-owner-mode", "company-request-route");
        if (["platformRequests", "platformCompanies"].includes(viewId)) {
          document.querySelectorAll<HTMLElement>("section.view").forEach((section) => section.classList.toggle("active", section.id === viewId));
        } else {
          try {
            window.eval(`setView("${viewId}", { persist:false, silent:true, route:false })`);
          } catch (error) {
            console.warn("theme-audit setView", viewId, error);
            document.querySelectorAll<HTMLElement>("section.view").forEach((section) => section.classList.toggle("active", section.id === viewId));
          }
        }
      }, view);
      await page.waitForTimeout(45);

      const audit = await page.evaluate(({ theme, view }) => {
        const parse = (value: string) => {
          const match = value.match(/rgba?\(([^)]+)\)/i);
          if (!match) return null;
          const parts = match[1].split(",").map((part) => Number.parseFloat(part.trim()));
          return { r: parts[0] || 0, g: parts[1] || 0, b: parts[2] || 0, a: Number.isFinite(parts[3]) ? parts[3] : 1 };
        };
        const channel = (value: number) => {
          const normalized = value / 255;
          return normalized <= 0.04045 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
        };
        const luminance = (color: { r: number; g: number; b: number }) =>
          0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
        const contrast = (a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }) => {
          const bright = Math.max(luminance(a), luminance(b));
          const dark = Math.min(luminance(a), luminance(b));
          return (bright + 0.05) / (dark + 0.05);
        };
        const visible = (element: Element) => {
          const node = element as HTMLElement;
          const style = getComputedStyle(node);
          const rect = node.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0.1 && rect.width > 1 && rect.height > 1 && rect.bottom >= 0 && rect.top <= innerHeight;
        };
        const backgroundFor = (element: Element) => {
          const ancestors: Element[] = [];
          let current: Element | null = element;
          while (current) {
            ancestors.push(current);
            current = current.parentElement;
          }
          let result = theme === "light" ? { r: 255, g: 255, b: 255, a: 1 } : { r: 8, g: 23, b: 39, a: 1 };
          let hasImage = false;
          for (const ancestor of ancestors.reverse()) {
            const style = getComputedStyle(ancestor);
            hasImage ||= style.backgroundImage !== "none";
            const foreground = parse(style.backgroundColor);
            if (!foreground || foreground.a <= 0) continue;
            result = {
              r: Math.round(foreground.r * foreground.a + result.r * (1 - foreground.a)),
              g: Math.round(foreground.g * foreground.a + result.g * (1 - foreground.a)),
              b: Math.round(foreground.b * foreground.a + result.b * (1 - foreground.a)),
              a: 1,
            };
          }
          return { color: result, hasImage };
        };
        const root = document.getElementById(view)!;
        const scope = [document.querySelector(".reference-topbar"), document.querySelector("#mainNavigation"), root].filter(Boolean) as Element[];
        const nodes = Array.from(new Set(scope.flatMap((entry) => [entry, ...Array.from(entry.querySelectorAll("*"))]))).filter(visible);
        const lowContrast: Array<Record<string, string | number>> = [];
        const suspiciousSurfaces: Array<Record<string, string | number>> = [];
        const suspiciousControls: Array<Record<string, string | number>> = [];
        const intentionalDark = /(?:map|qr|tag-preview|photo|avatar|icon|logo|badge|pill|status|toast|tooltip|chart|spark|swatch|signature|canvas)/i;
        for (const element of nodes) {
          const node = element as HTMLElement;
          const style = getComputedStyle(node);
          const rect = node.getBoundingClientRect();
          const text = (node.innerText || node.textContent || "").replace(/\s+/g, " ").trim();
          const ownSelector = `${node.tagName.toLowerCase()}${node.id ? `#${node.id}` : ""}${node.classList.length ? `.${Array.from(node.classList).slice(0, 4).join(".")}` : ""}`;
          const parent = node.parentElement;
          const parentSelector = parent ? `${parent.tagName.toLowerCase()}${parent.id ? `#${parent.id}` : ""}${parent.classList.length ? `.${Array.from(parent.classList).slice(0, 3).join(".")}` : ""}` : "";
          const selector = parentSelector ? `${parentSelector} > ${ownSelector}` : ownSelector;
          const color = parse(style.color);
          const effectiveBackground = backgroundFor(node);
          const background = effectiveBackground.color;
          const isTextNode = text.length > 0 && (node.children.length === 0 || ["BUTTON", "INPUT", "SELECT", "TEXTAREA", "SUMMARY", "TH", "TD", "LABEL", "A"].includes(node.tagName));
          if (isTextNode && color && color.a >= 0.75 && !effectiveBackground.hasImage) {
            const ratio = contrast(color, background);
            const fontSize = Number.parseFloat(style.fontSize) || 16;
            const fontWeight = Number.parseInt(style.fontWeight, 10) || 400;
            const threshold = fontSize >= 18 || fontWeight >= 700 && fontSize >= 14 ? 3 : 4.1;
            if (ratio < threshold && lowContrast.length < 80) {
              lowContrast.push({ selector, text: text.slice(0, 90), color: style.color, background: `rgb(${background.r}, ${background.g}, ${background.b})`, ratio: Number(ratio.toFixed(2)) });
            }
          }
          const ownBackground = parse(style.backgroundColor);
          const area = rect.width * rect.height;
          if (ownBackground && ownBackground.a >= 0.85 && area > 4200 && !intentionalDark.test(selector)) {
            const lightness = luminance(ownBackground);
            if ((theme === "light" && lightness < 0.12) || (theme === "dark" && lightness > 0.88)) {
              if (suspiciousSurfaces.length < 50) suspiciousSurfaces.push({ selector, background: style.backgroundColor, area: Math.round(area), lightness: Number(lightness.toFixed(3)) });
            }
          }
          const isControl = ["BUTTON", "SUMMARY", "INPUT", "SELECT", "TEXTAREA"].includes(node.tagName);
          const isSemanticColor = node.matches(".primary,.danger,.active,[class*='status'],[class*='tone'],[aria-pressed='true']");
          if (isControl && ownBackground && ownBackground.a >= 0.85 && !isSemanticColor) {
            const lightness = luminance(ownBackground);
            if ((theme === "light" && lightness < 0.12) || (theme === "dark" && lightness > 0.88)) {
              if (suspiciousControls.length < 80) suspiciousControls.push({ selector, text: text.slice(0, 90), background: style.backgroundColor, color: style.color, lightness: Number(lightness.toFixed(3)) });
            }
          }
        }
        const header = document.querySelector<HTMLElement>(".reference-topbar")!;
        const nav = document.querySelector<HTMLElement>("#mainNavigation")!;
        return {
          theme,
          view,
          lowContrast,
          suspiciousSurfaces,
          suspiciousControls,
          header: {
            background: getComputedStyle(header).backgroundColor,
            color: getComputedStyle(header).color,
            navBackground: getComputedStyle(nav).backgroundColor,
            navColor: getComputedStyle(nav).color,
          },
          overflow: { innerWidth, documentWidth: document.documentElement.scrollWidth },
        };
      }, { theme, view });
      report.push(audit as ThemeAudit);
      if (["dashboard", "quickAccess", "assets", "preventivePlans", "documentsCenter", "toolsControl", "teamsResources", "reports", "map", "calendar", "checklists", "measurements", "pendingActions", "suppliers", "operationalAreas", "tags"].includes(view)) {
        await page.screenshot({ path: resolve(outputDir, `${theme}-${view}.png`), fullPage: false });
      }
    }
  }

  writeFileSync(resolve(outputDir, "report.json"), JSON.stringify(report, null, 2));
  const summary = report.map((item) => ({
    theme: item.theme,
    view: item.view,
    lowContrast: item.lowContrast.length,
    suspiciousSurfaces: item.suspiciousSurfaces.length,
    suspiciousControls: item.suspiciousControls.length,
    header: item.header,
    overflow: item.overflow.documentWidth - item.overflow.innerWidth,
  }));
  writeFileSync(resolve(outputDir, "summary.json"), JSON.stringify(summary, null, 2));
});
