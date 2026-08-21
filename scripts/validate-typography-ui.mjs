import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const target = process.argv[2] || "http://127.0.0.1:4173/";
const output = path.resolve("test-results", "typography");
fs.mkdirSync(output, { recursive: true });

const systemChrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const browser = await chromium.launch({
  headless: true,
  ...(fs.existsSync(systemChrome) ? { executablePath: systemChrome } : {}),
});
const reports = [];

try {
  for (const device of [
    { name: "desktop", width: 1366, height: 768 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    const context = await browser.newContext({ viewport: device });
    const page = await context.newPage();
    const failedAssets = [];
    page.on("requestfailed", (request) => failedAssets.push(`${request.url()} :: ${request.failure()?.errorText || "falha"}`));

    await page.goto(target, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);

    const result = await page.evaluate(() => {
      const broken = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const pattern = /ADMINISTRAÃ|Ãšlt|Ã—|â€”|â€¦|\uFFFD/;
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const parent = node.parentElement;
        if (!parent || ["SCRIPT", "STYLE", "NOSCRIPT"].includes(parent.tagName)) continue;
        const text = String(node.nodeValue || "").trim();
        if (text && pattern.test(text)) broken.push(text.slice(0, 160));
      }

      const samples = [...document.querySelectorAll("h1, h2, p, label, button, input, select, th, td")]
        .filter((element) => {
          const style = getComputedStyle(element);
          return style.display !== "none" && style.visibility !== "hidden";
        })
        .slice(0, 80)
        .map((element) => ({
          tag: element.tagName,
          text: String(element.textContent || element.getAttribute("placeholder") || "").trim().slice(0, 80),
          font: getComputedStyle(element).fontFamily,
        }));

      const overflowingText = [...document.querySelectorAll(".auth-footer-copy, h1, h2, label")]
        .filter((element) => {
          const style = getComputedStyle(element);
          return String(element.textContent || "").trim()
            && style.display !== "none"
            && style.visibility !== "hidden"
            && element.scrollWidth > element.clientWidth + 1;
        })
        .map((element) => String(element.textContent || "").trim().slice(0, 120));

      const allFontFamilies = [...new Set(
        [...document.body.querySelectorAll("*")]
          .filter((element) => !["SCRIPT", "STYLE", "NOSCRIPT"].includes(element.tagName))
          .map((element) => getComputedStyle(element).fontFamily),
      )].sort();
      const nonApprovedFontFamilies = allFontFamilies.filter(
        (font) => !/^(?:Inter|"?Cascadia Mono|Consolas)(?:,|$)/i.test(font),
      );

      return {
        interLoaded: document.fonts.check('16px "Inter"'),
        broken,
        nonInterSamples: samples.filter((sample) => !/^Inter(?:,|$)/i.test(sample.font)),
        overflowingText,
        allFontFamilies,
        nonApprovedFontFamilies,
        viewportWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        visibleSamples: samples.length,
      };
    });

    await page.screenshot({ path: path.join(output, `${device.name}.png`), fullPage: true });
    await context.close();

    if (failedAssets.some((entry) => /InterVariable|gestman-typography/i.test(entry))) {
      throw new Error(`${device.name}: falha ao carregar tipografia: ${failedAssets.join(" | ")}`);
    }
    if (!result.interLoaded) throw new Error(`${device.name}: a fonte Inter local não foi carregada.`);
    if (result.broken.length) throw new Error(`${device.name}: texto corrompido: ${result.broken.join(" | ")}`);
    if (result.nonInterSamples.length) {
      throw new Error(`${device.name}: elementos visíveis fora da Inter: ${JSON.stringify(result.nonInterSamples)}`);
    }
    if (result.overflowingText.length) {
      throw new Error(`${device.name}: texto ultrapassando o componente: ${result.overflowingText.join(" | ")}`);
    }
    if (result.nonApprovedFontFamilies.length) {
      throw new Error(`${device.name}: fontes não padronizadas no DOM: ${result.nonApprovedFontFamilies.join(" | ")}`);
    }
    if (result.documentWidth > result.viewportWidth + 1) {
      throw new Error(`${device.name}: rolagem horizontal global (${result.documentWidth}px > ${result.viewportWidth}px).`);
    }
    reports.push({ device: device.name, ...result, screenshot: path.join(output, `${device.name}.png`) });
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify(reports, null, 2));
