import { expect, test } from "@playwright/test";
import { calculateMaintenanceMetrics } from "../../supabase/functions/_shared/maintenance-metrics.ts";

test("cenário controlado valida MTTR, MTBF, séries e remoção segura", async ({ page }) => {
  await page.goto("./");
  const snapshot = await page.evaluate(() => {
    document.body.classList.remove("auth-required", "auth-loading", "auth-restoring");
    return window.eval(`(() => {
      currentAccount = {
        user: { id: "qa-metrics-admin", name: "Auditor de Indicadores", role: "admin", accessProfile: "admin", active: true },
        company: { id: "qa-metrics-company", name: "QA Indicadores", domain: "qa-indicadores" }
      };
      state = normalizeState(emptyState());
      createDemoDataSet();
      renderDemoEnvironment();
      const scenarioReadings = state.measurements.filter(item => String(item.note || "").startsWith("AUDITORIA HORÍMETRO"));
      const lastReading = scenarioReadings.slice().sort((a, b) => Number(b.readAt) - Number(a.readAt))[0];
      return {
        state: JSON.parse(JSON.stringify(state)),
        now: Number(lastReading.readAt) + 3600000,
        panelHidden: document.getElementById("demoMetricsAuditPanel").hidden,
        panelCount: document.getElementById("demoMetricOrderCount").textContent
      };
    })()`);
  });

  const auditOrders = snapshot.state.orders.filter((item: any) => /^OS-AUD-/.test(String(item.number || "")));
  const correctiveClosed = auditOrders.filter((item: any) => item.status === "Concluída" && item.type === "Corretiva");
  const preventiveClosed = auditOrders.filter((item: any) => item.status === "Concluída" && item.type === "Preventiva");
  const active = auditOrders.filter((item: any) => item.status !== "Concluída");
  const auditReadings = snapshot.state.measurements.filter((item: any) => String(item.note || "").startsWith("AUDITORIA HORÍMETRO"));

  expect(auditOrders).toHaveLength(24);
  expect(snapshot.state.orders.filter((item: any) => item.demoBatchId === "gestman365-demo-v1")).toHaveLength(25);
  expect(correctiveClosed).toHaveLength(18);
  expect(preventiveClosed).toHaveLength(3);
  expect(active).toHaveLength(3);
  expect(auditReadings).toHaveLength(7);
  expect(snapshot.panelHidden).toBe(false);
  expect(snapshot.panelCount).toBe("24");

  const current = calculateMaintenanceMetrics(snapshot.state, { period: "30", seriesBuckets: 6 }, new Date(snapshot.now));
  expect(current.metrics.mttr.value).toBeCloseTo(2, 4);
  expect(current.metrics.mtbf.value).toBeCloseTo(85, 4);
  expect(current.metrics.mttr.recordCount).toBe(3);
  expect(current.series.mttr.filter(item => item.value !== null).length).toBeGreaterThan(0);
  expect(current.series.mtbf.filter(item => item.value !== null).length).toBeGreaterThan(0);

  const history = calculateMaintenanceMetrics(snapshot.state, {
    rangeStart: new Date(snapshot.now - 181 * 86400000).toISOString(),
    rangeEnd: new Date(snapshot.now).toISOString(),
    seriesBuckets: 6
  }, new Date(snapshot.now));
  expect(history.metrics.mttr.value).toBeCloseTo(2.5, 4);
  expect(history.metrics.mtbf.value).toBeCloseTo(72.5, 4);
  expect(history.metrics.mttr.recordCount).toBe(18);

  const removal = await page.evaluate(() => window.eval(`(() => {
    state.orders.push({ id:"real-order-preserved", number:"OS-REAL-001", status:"Aberta", createdAt:Date.now() });
    const removed = removeDemoDataSet();
    return {
      removed: removed.total,
      demoRemaining: DEMO_REMOVAL_ORDER.reduce((total, name) => total + (state[name] || []).filter(isDemoRecord).length, 0),
      realPreserved: state.orders.some(item => item.id === "real-order-preserved")
    };
  })()`));
  expect(removal.removed).toBeGreaterThan(25);
  expect(removal.demoRemaining).toBe(0);
  expect(removal.realPreserved).toBe(true);
});
