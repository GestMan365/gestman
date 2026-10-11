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

test("preferências de notificação não exibem linhas escuras", async ({ page }) => {
  await page.goto("./");
  const colors = await page.evaluate(() => {
    const body = document.getElementById("genericBody")!;
    body.innerHTML = `<form id="s20NotificationPrefs" class="stage20-form"><div class="full stage20-pref-list"><label><span>Ordem de Serviço<small class="stage20-sub">Afeta somente futuras notificações não urgentes.</small></span><input type="checkbox" checked></label></div><div class="full stage20-warning">Notificações urgentes permanecem ativas.</div><div class="full stage20-pref-list"><div class="stage20-desktop-alert-row"><span><strong>Alertas de nova O.S. no computador</strong><small class="stage20-sub">Ativo</small></span></div><label>Modelo de alerta<select class="field"><option>Duplo tom</option></select></label></div></form>`;
    const read = () => {
      const style = (selector: string) => getComputedStyle(body.querySelector(selector)!);
      return {
        row: style(".stage20-pref-list > label").backgroundColor,
        title: style(".stage20-pref-list > label > span").color,
        subtitle: style(".stage20-pref-list .stage20-sub").color,
        warning: style(".stage20-warning").backgroundColor,
        alert: style(".stage20-desktop-alert-row").backgroundColor,
      };
    };
    document.body.classList.add("theme-light");
    return read();
  });
  expect(colors.row).toBe("rgb(255, 255, 255)");
  expect(colors.title).toBe("rgb(24, 50, 75)");
  expect(colors.subtitle).toBe("rgb(86, 103, 126)");
  expect(colors.warning).toBe("rgb(255, 247, 237)");
  expect(colors.alert).toBe("rgb(247, 250, 252)");
});
