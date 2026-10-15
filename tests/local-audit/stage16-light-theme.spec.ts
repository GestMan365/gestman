import { expect, test } from "@playwright/test";

test("indicadores e análises permanecem legíveis no tema claro", async ({ page }) => {
  await page.goto("./?modulo=indicadores");
  await page.evaluate(() => {
    document.body.classList.add("theme-light");
    const fixture = document.createElement("div");
    fixture.innerHTML = `<div class="stage16-workspace"><article class="s16-analysis"><h3>Tendência de MTTR</h3><p>Período · horas</p><div class="s16-bar-row"><span>Aberta</span><div class="s16-bar-track"><div class="s16-bar"></div></div><strong>28</strong></div><svg class="s16-line-chart"><line x1="0" x2="5" y1="0" y2="5" stroke="#1f334a"/><text fill="#8197ad">SET</text></svg></article></div><div class="s16-detail"><div class="s16-method"><strong>Metodologia</strong><br>Dados de manutenção</div></div>`;
    document.body.append(fixture);
  });

  const colors = await page.evaluate(() => {
    const color = (selector: string, property: string) => getComputedStyle(document.querySelector(selector)!).getPropertyValue(property).trim();
    return {
      analysisBackground: color(".s16-analysis", "background-color"),
      analysisTitle: color(".s16-analysis h3", "color"),
      methodBackground: color(".s16-method", "background-color"),
      methodTitle: color(".s16-method strong", "color"),
      trackBackground: color(".s16-bar-track", "background-color"),
      chartGrid: color(".s16-line-chart line", "stroke"),
      chartLabel: color(".s16-line-chart text", "fill"),
    };
  });
  expect(colors).toEqual({
    analysisBackground: "rgb(255, 255, 255)",
    analysisTitle: "rgb(23, 49, 75)",
    methodBackground: "rgb(255, 255, 255)",
    methodTitle: "rgb(23, 49, 75)",
    trackBackground: "rgb(228, 237, 245)",
    chartGrid: "rgb(216, 228, 239)",
    chartLabel: "rgb(82, 105, 129)",
  });
  await expect(page.locator(".s16-analysis h3")).toBeVisible();
});
