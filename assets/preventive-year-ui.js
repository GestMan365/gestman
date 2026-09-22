let gmPreventiveYearData = null;
function renderPreventiveYear() {
  const select = document.getElementById("gmPreventiveYear");
  if (!select || !window.GMPreventiveYear) return;
  const now = new Date(), current = now.getFullYear();
  if (!select.options.length) {
    select.innerHTML = Array.from({length:21},(_,i)=>current-10+i).map(year=>`<option value="${year}">${year}</option>`).join("");
    select.value = String(current);
  }
  const year = Number(select.value), today = calendarDateKey(now);
  const data = GMPreventiveYear.build({year,today,assets:state.assets,plans:state.preventivePlans,orders:state.orders,
    tenantId:preventivePlanCurrentTenantId(),nextDate:preventivePlanNextExecution});
  gmPreventiveYearData = data;
  const query = normalizeTextKey($("gmPreventiveYearSearch").value);
  const rows = data.assets.filter(a=>!query||normalizeTextKey(`${a.code} ${a.name}`).includes(query))
    .sort((a,b)=>String(a.code||a.name).localeCompare(String(b.code||b.name),"pt-BR",{numeric:true}));
  const short = value => value.slice(8,10)+"/"+value.slice(5,7);
  const buckets = new Map();
  data.events.forEach(event=>{
    const week = data.weeks.findIndex(w=>event.date>=w.start&&event.date<=w.end);
    const bucket = event.assetId+":"+week;
    if (!buckets.has(bucket)) buckets.set(bucket,[]);
    buckets.get(bucket).push(event);
  });
  const titles = {late:"Não realizada / vencida",done:"Concluída",future:"Prevista"};
  const symbols = {late:"!",done:"✓",future:"○"};
  $("gmPreventiveYearTable").innerHTML = `<caption>Cronograma preventivo ${year} · ${rows.length} máquinas</caption><thead><tr><th scope="col">Máquina / equipamento</th>${data.weeks.map(w=>`<th scope="col" class="${today>=w.start&&today<=w.end?"gm-year-current":""}" title="${w.start} a ${w.end}">S${String(w.number).padStart(2,"0")}<small>${short(w.start)}</small><small>${short(w.end)}</small>${w.isoYear!==year?`<small>${w.isoYear}</small>`:""}</th>`).join("")}</tr></thead><tbody>${rows.map((asset,row)=>`<tr><th scope="row">${escapeHtml(asset.code||"—")}<small>${escapeHtml(asset.name||"Equipamento")}</small></th>${data.weeks.map((w,week)=>{
    const events=buckets.get(asset.id+":"+week)||[];
    return `<td>${["late","done","future"].map(type=>{
      const items=events.filter(e=>e.state===type);
      if(!items.length)return "";
      const description=`${asset.code||asset.name} · semana ${w.number} · ${titles[type]}: ${items.length}`;
      return `<button type="button" class="gm-year-mark ${type}" aria-label="${escapeHtml(description)}" title="${escapeHtml(items.map(e=>short(e.date)+" · "+e.plan+" · "+e.label).join("\n"))}" onclick="openPreventiveYearWeek(${row},${week})">${symbols[type]} ${items.length}</button>`;
    }).join("")}</td>`;
  }).join("")}</tr>`).join("")||`<tr><td colspan="${data.weeks.length+1}">Nenhuma máquina encontrada.</td></tr>`}</tbody>`;
  data.visibleAssets=rows;
  $("gmPreventiveYearNote").textContent = `Projeções pela periodicidade atual, a partir da próxima execução. Histórico anterior depende das O.S. registradas; vazio não significa concluído. ${data.paused} plano(s) pausado(s)/inativo(s), sem novas projeções. ${data.missingDates} registro(s) sem data válida.`;
}
function openPreventiveYearWeek(row,week) {
  const data=gmPreventiveYearData,asset=data?.visibleAssets?.[row],range=data?.weeks?.[week];
  if(!asset||!range)return;
  const events=data.events.filter(e=>e.assetId===asset.id&&e.date>=range.start&&e.date<=range.end);
  openModal("Preventivas da semana",`<h3>${escapeHtml(asset.code||"")} · ${escapeHtml(asset.name||"")}</h3><p>Semana ${range.number} · ${range.start} a ${range.end}</p>${events.map(e=>`<div class="side-box"><strong>${escapeHtml(e.plan)}</strong><span>${formatPlanDate(e.date)} · ${escapeHtml(e.label)}</span><span>${escapeHtml(e.order?"O.S. "+e.order:"Sem O.S. gerada")} · ${escapeHtml(e.note)}</span></div>`).join("")}`);
}
