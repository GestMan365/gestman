(function (root) {
  "use strict";
  const DAY = 86400000;
  function date(value) {
    const text = String(value || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
    const result = new Date(text + "T00:00:00Z");
    return Number.isFinite(+result) && result.toISOString().slice(0, 10) === text ? result : null;
  }
  const key = value => value.toISOString().slice(0, 10);
  const status = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  function weeks(year) {
    const start = new Date(Date.UTC(year, 0, 1)), end = new Date(Date.UTC(year + 1, 0, 1));
    start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
    const rows = [];
    for (let cursor = +start; cursor < +end; cursor += 7 * DAY) {
      const monday = new Date(cursor), thursday = new Date(cursor + 3 * DAY);
      const isoYear = thursday.getUTCFullYear();
      const number = Math.ceil((((+thursday - Date.UTC(isoYear, 0, 1)) / DAY) + 1) / 7);
      rows.push({ start: key(monday), end: key(new Date(cursor + 6 * DAY)), number, isoYear });
    }
    return rows;
  }
  function build({ year, today, assets = [], plans = [], orders = [], nextDate, tenantId = "" }) {
    const belongs = item => {
      const tenant = String(item.companyId || item.empresaId || item.empresa_id || item.tenantId || item.tenant_id || "");
      return !tenant || tenant === String(tenantId);
    };
    const first = year + "-01-01", last = year + "-12-31";
    const validAssets = assets.filter(belongs), assetIds = new Set(validAssets.map(a => a.id));
    const validPlans = plans.filter(p => belongs(p) && assetIds.has(p.assetId));
    const planMap = new Map(validPlans.map(p => [p.id, p]));
    const events = [], linked = new Set();
    let missingDates = 0, paused = 0;
    for (const order of orders.filter(belongs)) {
      const plan = planMap.get(order.preventivePlanId);
      if (!plan || order.assetId !== plan.assetId) continue;
      const due = date(order.preventivePlanExecutionDate || order.scheduledAt || order.dueAt);
      if (!due) { missingDates++; continue; }
      const dueKey = key(due);
      linked.add(plan.id + ":" + dueKey);
      if (dueKey < first || dueKey > last) continue;
      const normalized = status(order.status), cancelled = normalized.startsWith("cancel");
      const done = !cancelled && /^(concluid|finaliz|encerrad)/.test(normalized);
      events.push({ date: dueKey, assetId: plan.assetId, planId: plan.id, plan: plan.name || "Plano",
        order: order.number || order.id, state: done ? "done" : dueKey < today ? "late" : "future",
        label: done ? "Concluída" : dueKey < today ? "Não realizada / vencida" : "Prevista",
        note: cancelled ? "O.S. cancelada; não conta como conclusão" : order.status || "", projected: false });
    }
    for (const plan of validPlans) {
      if (/paus|inativ|cancel/.test(status(plan.status))) { paused++; continue; }
      let due = date(plan.nextExecution);
      if (!due) { missingDates++; continue; }
      // Projection starts only from the recorded next execution, never invents past history.
      for (let i = 0; due && key(due) <= last && i < 100000; i++) {
        const dueKey = key(due);
        if (dueKey >= first && !linked.has(plan.id + ":" + dueKey)) {
          events.push({ date: dueKey, assetId: plan.assetId, planId: plan.id, plan: plan.name || "Plano",
            order: "", state: dueKey < today ? "late" : "future",
            label: dueKey < today ? "Não realizada / vencida" : "Prevista",
            note: i ? "Projeção pela periodicidade atual" : "Próxima execução registrada", projected: true });
        }
        const next = date(nextDate(plan, dueKey));
        if (!next || +next <= +due) break;
        due = next;
      }
    }
    return { weeks: weeks(year), events: events.sort((a,b) => a.date.localeCompare(b.date)), assets: validAssets,
      paused, missingDates };
  }
  root.GMPreventiveYear = { date, weeks, build };
})(typeof window === "undefined" ? globalThis : window);
