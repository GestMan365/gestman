let gmPreventiveYearData = null;

function preventiveYearResponsible(plan = {}) {
  const linked = byId(state.resources || [], plan.responsibleId);
  return String(linked?.name || plan.responsible || plan.owner || "").trim();
}

function populatePreventiveYearResponsibleFilter() {
  const select = $("gmPreventiveYearResponsible");
  if (!select) return;
  const selected = select.value;
  const names = Array.from(new Set((state.preventivePlans || []).map(preventiveYearResponsible).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
  select.innerHTML = `<option value="">Todos os responsáveis</option>${names.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("")}`;
  if (names.includes(selected)) select.value = selected;
}

function renderPreventiveYearKpis(assets, events) {
  const target = $("gmPreventiveYearKpis");
  if (!target) return;
  const count = stateName => events.filter(event => event.state === stateName).length;
  target.innerHTML = [
    ["", assets.length, "Máquinas no cronograma"],
    ["late", count("late"), "Vencidas / não realizadas"],
    ["done", count("done"), "Preventivas concluídas"],
    ["future", count("future"), "Preventivas previstas"]
  ].map(([kind, value, label]) => `<article class="gm-year-kpi ${kind}"><div><strong>${value}</strong><span>${label}</span></div></article>`).join("");
}

function renderPreventiveYear() {
  const select = $("gmPreventiveYear");
  if (!select || !window.GMPreventiveYear) return;
  const now = new Date(), current = now.getFullYear();
  if (!select.options.length) {
    select.innerHTML = Array.from({ length: 21 }, (_, index) => current - 10 + index)
      .map(year => `<option value="${year}">${year}</option>`).join("");
    select.value = String(current);
  }
  populatePreventiveYearResponsibleFilter();
  const year = Number(select.value), today = calendarDateKey(now);
  const data = GMPreventiveYear.build({
    year, today, assets: state.assets, plans: state.preventivePlans, orders: state.orders,
    tenantId: preventivePlanCurrentTenantId(), nextDate: preventivePlanNextExecution
  });
  gmPreventiveYearData = data;
  const query = normalizeTextKey($("gmPreventiveYearSearch")?.value || "");
  const status = $("gmPreventiveYearStatus")?.value || "";
  const responsible = $("gmPreventiveYearResponsible")?.value || "";
  const planById = new Map((state.preventivePlans || []).map(plan => [plan.id, plan]));
  const filteredEvents = data.events.filter(event => {
    const plan = planById.get(event.planId) || {};
    return (!status || event.state === status) && (!responsible || preventiveYearResponsible(plan) === responsible);
  });
  const eventAssetIds = new Set(filteredEvents.map(event => event.assetId));
  const rows = data.assets.filter(asset => {
    const textMatches = !query || normalizeTextKey(`${asset.code} ${asset.name}`).includes(query);
    const eventMatches = (!status && !responsible) || eventAssetIds.has(asset.id);
    return textMatches && eventMatches;
  }).sort((a, b) => String(a.code || a.name).localeCompare(String(b.code || b.name), "pt-BR", { numeric: true }));
  const visibleAssetIds = new Set(rows.map(asset => asset.id));
  const visibleEvents = filteredEvents.filter(event => visibleAssetIds.has(event.assetId));
  renderPreventiveYearKpis(rows, visibleEvents);
  const short = value => value.slice(8, 10) + "/" + value.slice(5, 7);
  const buckets = new Map();
  visibleEvents.forEach(event => {
    const week = data.weeks.findIndex(item => event.date >= item.start && event.date <= item.end);
    const bucket = event.assetId + ":" + week;
    if (!buckets.has(bucket)) buckets.set(bucket, []);
    buckets.get(bucket).push(event);
  });
  const titles = { late: "Não realizada / vencida", done: "Concluída", future: "Prevista" };
  $("gmPreventiveYearTable").innerHTML = `<caption>Cronograma preventivo ${year} · ${rows.length} máquina(s) · ${visibleEvents.length} ocorrência(s)</caption><thead><tr><th scope="col">Máquina / equipamento</th>${data.weeks.map(week => `<th scope="col" class="${today >= week.start && today <= week.end ? "gm-year-current" : ""}" title="${week.start} a ${week.end}">S${String(week.number).padStart(2, "0")}<small>${short(week.start)}</small><small>${short(week.end)}</small>${week.isoYear !== year ? `<small>${week.isoYear}</small>` : ""}</th>`).join("")}</tr></thead><tbody>${rows.map((asset, row) => `<tr><th scope="row">${escapeHtml(asset.code || "—")}<small>${escapeHtml(asset.name || "Equipamento")}</small></th>${data.weeks.map((week, weekIndex) => {
    const events = buckets.get(asset.id + ":" + weekIndex) || [];
    const currentClass = today >= week.start && today <= week.end ? "gm-year-current" : "";
    return `<td class="${currentClass}">${["late", "done", "future"].map(type => {
      const items = events.filter(event => event.state === type);
      if (!items.length) return "";
      const description = `${asset.code || asset.name} · semana ${week.number} · ${titles[type]}: ${items.length}`;
      return `<button type="button" class="gm-year-mark ${type}" aria-label="${escapeHtml(description)}" title="${escapeHtml(items.map(event => short(event.date) + " · " + event.plan + " · " + event.label).join("\n"))}" onclick="openPreventiveYearWeek(${row},${weekIndex})"><span aria-hidden="true">${items.length}</span></button>`;
    }).join("")}</td>`;
  }).join("")}</tr>`).join("") || `<tr><td colspan="${data.weeks.length + 1}">Nenhuma máquina encontrada para os filtros selecionados.</td></tr>`}</tbody>`;
  data.visibleAssets = rows;
  data.visibleEvents = visibleEvents;
  $("gmPreventiveYearNote").textContent = `Base exibida: ${rows.length} máquina(s) e ${visibleEvents.length} ocorrência(s). Projeções usam a periodicidade atual; histórico anterior depende das O.S. registradas. ${data.paused} plano(s) pausado(s)/inativo(s), sem novas projeções. ${data.missingDates} registro(s) sem data válida.`;
}

function resetPreventiveYearFilters() {
  ["gmPreventiveYearSearch", "gmPreventiveYearStatus", "gmPreventiveYearResponsible"].forEach(id => { if ($(id)) $(id).value = ""; });
  renderPreventiveYear();
}

function scrollPreventiveYearToCurrent() {
  const scroll = $("gmPreventiveYearScroll");
  const current = scroll?.querySelector("thead .gm-year-current");
  if (!scroll || !current) return;
  scroll.scrollTo({ left: Math.max(0, current.offsetLeft - scroll.clientWidth / 2), behavior: "smooth" });
  current.focus?.({ preventScroll: true });
}

function openPreventiveYearWeek(row, week) {
  const data = gmPreventiveYearData, asset = data?.visibleAssets?.[row], range = data?.weeks?.[week];
  if (!asset || !range) return;
  const source = data.visibleEvents || data.events;
  const events = source.filter(event => event.assetId === asset.id && event.date >= range.start && event.date <= range.end);
  openModal("Preventivas da semana", `<h3>${escapeHtml(asset.code || "")} · ${escapeHtml(asset.name || "")}</h3><p>Semana ${range.number} · ${formatPlanDate(range.start)} a ${formatPlanDate(range.end)}</p>${events.map(event => `<div class="side-box"><strong>${escapeHtml(event.plan)}</strong><span>${formatPlanDate(event.date)} · ${escapeHtml(event.label)}</span><span>${escapeHtml(event.order ? "O.S. " + event.order : "Sem O.S. gerada")} · ${escapeHtml(event.note)}</span></div>`).join("")}`);
}
