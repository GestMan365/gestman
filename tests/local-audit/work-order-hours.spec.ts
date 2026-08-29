import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("./");
  await page.evaluate(() => {
    document.body.classList.remove("auth-required", "auth-loading", "auth-restoring");
    window.eval(`
      currentAccount = {
        user:{ id:"tech-a", name:"Técnico A", role:"admin", accessProfile:"admin", active:true },
        company:{ id:"tenant-a", name:"Empresa A", remoteSync:true }
      };
      state = {
        ...emptyState(),
        profile:{ name:"Técnico A" },
        orders:[{ id:"os-1", number:"OS-0001", assetId:"asset-1", status:"Em execução", executor:"Técnico A", createdAt:1760000000000, history:[], costs:[] }],
        assets:[{ id:"asset-1", code:"ATV-1", name:"Equipamento A" }],
        maintenanceJournal:[]
      };
      window.__savedWorkLogState = "";
      window.__workLogToast = "";
      saveState = () => { window.__savedWorkLogState = JSON.stringify(state); };
      render = () => {};
      showToast = message => { window.__workLogToast = String(message || ""); };
    `);
  });
});

test("salva 1,5 hora, responsável e exibe total no apontamento e histórico", async ({ page }) => {
  await page.evaluate(() => window.eval(`addOrderObservation("os-1")`));
  await page.locator("#orderObservationText").fill("Inspeção realizada e reaperto executado");
  await page.locator("#orderObservationHours").fill("1,5");
  await page.locator("#orderObservationForm button[type=submit]").click();

  const saved = await page.evaluate(() => window.eval(`state.maintenanceJournal[0]`));
  expect(saved).toMatchObject({
    orderId:"os-1",
    workedHours:1.5,
    hours:1.5,
    user:"Técnico A",
    userId:"tech-a",
    companyId:"tenant-a",
    source:"order_work_log",
    auditEvent:true,
    immutable:true,
  });
  expect(typeof saved.createdAt).toBe("number");

  const markup = await page.evaluate(() => window.eval(`
    selectedOrderDetailTab = "notes";
    ({ notes:orderDetailTabContent(state.orders[0]), history:(selectedOrderDetailTab="history", orderDetailTabContent(state.orders[0])) })
  `));
  expect(markup.notes).toContain("Inspeção realizada e reaperto executado");
  expect(markup.notes).toContain("Tempo trabalhado: 1,5 h");
  expect(markup.notes).toContain("Usuário: Técnico A");
  expect(markup.notes).toContain("Total de horas apontadas");
  expect(markup.history).toContain('data-event-type="APONTAMENTO"');
  expect(markup.history).toContain("Horas: 1,5 h");
  expect(markup.history).toContain("Usuário: Técnico A");
});

test("persiste após recarregar o estado normalizado", async ({ page }) => {
  await page.evaluate(() => window.eval(`addOrderObservation("os-1")`));
  await page.locator("#orderObservationText").fill("Teste de persistência");
  await page.locator("#orderObservationHours").fill("2.25");
  await page.locator("#orderObservationForm button[type=submit]").click();

  const result = await page.evaluate(() => window.eval(`
    state = normalizeState(JSON.parse(window.__savedWorkLogState));
    ({
      workedHours:state.maintenanceJournal[0].workedHours,
      hours:state.maintenanceJournal[0].hours,
      total:orderLoggedHours(state.orders[0].id),
      type:typeof state.maintenanceJournal[0].workedHours
    })
  `));
  expect(result).toEqual({ workedHours:2.25, hours:2.25, total:2.25, type:"number" });
});

test("bloqueia valores inválidos sem criar apontamentos", async ({ page }) => {
  for (const invalid of ["0", "-1", "texto", "NaN", "24,01", "25", "1e2"]) {
    await page.evaluate(() => window.eval(`addOrderObservation("os-1")`));
    await page.locator("#orderObservationText").fill("Valor inválido");
    await page.locator("#orderObservationHours").fill(invalid);
    await page.locator("#orderObservationForm button[type=submit]").click();
    await expect(page.locator("#orderObservationForm")).toBeVisible();
    expect(await page.evaluate(() => window.eval(`state.maintenanceJournal.length`))).toBe(0);
    expect(await page.evaluate(() => (window as typeof window & { __workLogToast:string }).__workLogToast)).not.toBe("");
    await page.evaluate(() => window.eval(`closeModal()`));
  }
});

test("soma vários técnicos, ignora duplicidade e isola outro tenant", async ({ page }) => {
  const result = await page.evaluate(() => window.eval(`
    state.maintenanceJournal = [
      { id:"a", orderId:"os-1", companyId:"tenant-a", user:"Técnico A", workedHours:1.5, createdAt:1000 },
      { id:"b", orderId:"os-1", companyId:"tenant-a", user:"Técnico B", workedHours:2.25, createdAt:2000 },
      { id:"b", orderId:"os-1", companyId:"tenant-a", user:"Técnico B", workedHours:2.25, createdAt:2000 },
      { id:"foreign", orderId:"os-1", companyId:"tenant-b", user:"Outro tenant", workedHours:12, createdAt:3000 }
    ];
    ({ rows:orderWorkLogs("os-1").map(item => item.id), total:orderLoggedHours("os-1"), events:orderAuditEvents(state.orders[0]) })
  `));
  expect(result.rows).toEqual(["a", "b"]);
  expect(result.total).toBe(3.75);
  expect(result.events.filter((item: { type:string }) => item.type === "APONTAMENTO")).toHaveLength(2);
  expect(JSON.stringify(result.events)).not.toContain("Outro tenant");
});

test("mantém duração cronológica, tempo efetivo e horas apontadas distintos em relatório e custos", async ({ page }) => {
  const result = await page.evaluate(() => window.eval(`
    state.maintenanceJournal = [{ id:"a", orderId:"os-1", companyId:"tenant-a", workedHours:3.75, createdAt:1000 }];
    const finishedAt = Date.now();
    state.orders[0] = { ...state.orders[0], createdAt:finishedAt - 5 * 36e5, startedAt:finishedAt - 4 * 36e5, finishedAt, pauseHours:1.5, mttr:2.5 };
    const summary = workOrderTimeSummary(state.orders[0]);
    const report = stage16ReportRows("orders")[0];
    const costs = detailTabContent("Outros custos", state.orders[0]);
    ({ summary, report, costs })
  `));
  expect(result.summary).toEqual({
    chronologicalHours:4,
    effectiveHours:2.5,
    pausedHours:1.5,
    loggedHours:3.75,
  });
  expect(result.report.chronologicalHours).toBe("4 h");
  expect(result.report.effectiveHours).toBe("2,5 h");
  expect(result.report.workedHours).toBe("3,75 h");
  expect(result.costs).toContain("3,75 h apontadas");
  expect(result.costs).toContain("Duração cronológica: 4 h");
  expect(result.costs).toContain("Tempo efetivo sem pausas: 2,5 h");
});

test("interface comum não edita nem exclui apontamentos de auditoria", async ({ page }) => {
  const result = await page.evaluate(() => window.eval(`
    state.maintenanceJournal = [{
      id:"audit-log", orderId:"os-1", title:"Apontamento da O.S.", source:"order_work_log",
      auditEvent:true, immutable:true, workedHours:1.5, hours:1.5, createdAt:1000
    }];
    editOperationalDiary("audit-log");
    const afterEdit = window.__workLogToast;
    window.__workLogToast = "";
    deleteOperationalDiary("audit-log", true);
    ({ afterEdit, afterDelete:window.__workLogToast, count:state.maintenanceJournal.length })
  `));
  expect(result.afterEdit).toContain("não podem ser alterados");
  expect(result.afterDelete).toContain("não podem ser excluídos");
  expect(result.count).toBe(1);
});
