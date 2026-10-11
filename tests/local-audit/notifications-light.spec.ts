import { expect, test } from "@playwright/test";

test("notificações e central usam cores legíveis no modo claro", async ({ page }) => {
  await page.goto("./");
  const colors = await page.evaluate(() => {
    document.body.classList.add("theme-light");
    const fixture = document.createElement("div");
    fixture.innerHTML = `<div class="stage20-notification-panel"><article class="stage20-notification" data-level="Informação"><i class="stage20-notification-icon">!</i><div class="stage20-notification-copy"><strong>Nova O.S. atribuída</strong><span>OS-CODEX-BASE-001</span><small>Ordem de Serviço · Não lida</small></div></article><article class="stage20-notification is-read" data-level="Urgente"><i class="stage20-notification-icon">!</i><div class="stage20-notification-copy"><strong>O.S. atrasada</strong><span>Requer atenção</span><small>Lida</small></div></article></div><div class="stage20-notification-center"><nav class="stage20-tabs"><button class="active">Todas</button></nav><div class="stage20-notification-filters"><select class="field"><option>Todas</option></select></div><div class="stage20-empty"><strong>Nenhuma notificação</strong></div></div><div class="stage20-pref-list"><label>Alertas<input type="checkbox"></label></div>`;
    document.body.append(fixture);
    const color = (selector: string, property: "backgroundColor" | "color") => getComputedStyle(fixture.querySelector(selector)!).getPropertyValue(property === "backgroundColor" ? "background-color" : "color");
    return {
      card: color(".stage20-notification", "backgroundColor"),
      readCard: color(".stage20-notification.is-read", "backgroundColor"),
      title: color(".stage20-notification-copy strong", "color"),
      message: color(".stage20-notification-copy span", "color"),
      metadata: color(".stage20-notification-copy small", "color"),
      filter: color(".stage20-notification-filters .field", "backgroundColor"),
      preference: color(".stage20-pref-list label", "backgroundColor"),
    };
  });
  expect(colors.card).toBe("rgb(255, 255, 255)");
  expect(colors.readCard).toBe("rgb(245, 248, 251)");
  expect(colors.title).toBe("rgb(20, 45, 69)");
  expect(colors.message).toBe("rgb(54, 83, 109)");
  expect(colors.metadata).toBe("rgb(88, 114, 139)");
  expect(colors.filter).toBe("rgb(247, 249, 252)");
  expect(colors.preference).toBe("rgb(255, 255, 255)");
});
