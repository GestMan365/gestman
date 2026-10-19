/* Evidence comes exclusively from the official contract; never infer orders by date or asset. */
(function(root) {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const stamp = value => value == null || value === '' ? 'Não informado' : Number.isFinite(+new Date(value)) ? new Date(value).toLocaleString('pt-BR') : 'Não informado';
  const periodDate = value => value && Number.isFinite(+new Date(value)) ? new Date(value).toLocaleDateString('pt-BR',{timeZone:'UTC'}) : 'Não informado';
  function model(selection, sources = {}) {
    const metric = selection.metric || {};
    const ids = [...new Set((metric.recordIds || []).map(String))];
    const direct = [], linked = [], matched = new Set(), seen = new Set();
    const kinds = selection.key === 'availability' ? ['downtimes'] : selection.key === 'mttr' ? ['orders'] : ['orders','measurements'];
    for (const kind of kinds) for (const record of sources[kind] || []) {
      const ref = String(record.id || record.number || '');
      if (!ids.includes(ref) || seen.has(kind+':'+ref)) continue;
      seen.add(kind+':'+ref);
      matched.add(ref);
      direct.push({kind,record});
    }
    if (selection.key === 'availability') {
      const linkedIds = new Set(direct.map(item=>String(item.record.orderId || '')).filter(Boolean));
      for (const record of sources.orders || []) if (linkedIds.has(String(record.id))) linked.push({kind:'orders',record});
    }
    return {selection,metric,ids,direct,linked,unavailable:ids.filter(id=>!matched.has(id)).length,truncated:Number(metric.recordCount)>ids.length,
      orderIds:[...new Set([...direct.filter(item=>item.kind==='orders'),...linked].map(item=>item.record.id).filter(Boolean))]};
  }
  function render(target, evidence, options = {}) {
    const {selection,metric,direct,linked} = evidence;
    const unit = selection.unit || metric.unit || '';
    const valid = metric.quality?.state !== 'insufficient' && metric.value != null && metric.value !== '' && typeof metric.value !== 'boolean' && Number.isFinite(Number(metric.value)) && Number(metric.value) >= 0 && (selection.key !== 'availability' || Number(metric.value) <= 100);
    const value = valid ? `${Number(metric.value).toLocaleString('pt-BR',{maximumFractionDigits:2})} ${unit}` : 'Sem dados';
    const quality = {valid:'Base válida',partial:'Base parcial',insufficient:'Base insuficiente'}[metric.quality?.state] || 'Base insuficiente';
    const period = metric.period || selection.period || {};
    const entries = [...direct,...linked];
    const rows = (items,offset=0) => items.length ? `<div class="gm-evidence-table"><table><thead><tr><th>Registro</th><th>Equipamento / descrição</th><th>Status / valor</th><th>Consultar</th></tr></thead><tbody>${items.map(({kind,record},index)=>`<tr><td>${esc(({orders:'O.S.',downtimes:'Parada',measurements:'Leitura'})[kind])}<br><strong>${esc(record.number || record.code || record.id)}</strong></td><td>${esc(options.assetName?.(record.assetId) || 'Equipamento não disponível')}<br><small>${esc(record.description || record.reason || record.name || '')}</small></td><td>${esc(kind==='measurements' ? `${record.value ?? record.reading ?? '—'} ${record.unit || ''}` : record.status || 'Não informado')}</td><td><button type="button" class="btn" data-gm-skip-icon data-evidence-record="${offset+index}">Abrir</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="gm-evidence-note">Nenhum registro deste grupo está disponível neste perfil e estado atual dos dados.</p>';
    target.className = 'gm-metric-evidence';
    target.innerHTML = `<div class="gm-evidence-summary"><div><span>${esc(selection.name)}</span><strong>${esc(value)}</strong></div><div><span>Qualidade da base</span><strong>${quality}</strong></div><div><span>Registros informados no cálculo</span><strong>${esc(metric.recordCount ?? evidence.ids.length)}</strong></div></div>
      <p class="gm-evidence-note">Período (datas UTC): ${esc(periodDate(period.start))} – ${esc(periodDate(period.end))} · Atualizado (hora local): ${esc(stamp(metric.updatedAt))}</p>
      <section><h3>Como foi calculado</h3><p>${esc(metric.formula || 'Fórmula não informada pelo serviço de indicadores.')}</p><p>${esc(metric.detail || '')}</p>${metric.quality?.reason?`<p>${esc(metric.quality.reason)}</p>`:''}<p class="gm-evidence-note">Registros ignorados pelo cálculo: ${esc(metric.quality?.ignoredRecords ?? 'Não informado')}. Fonte: ${esc(metric.source || 'Não informada')}.</p>
      <details><summary>Filtros aplicados</summary><dl>${Object.entries(metric.filters || {}).map(([key,value])=>`<dt>${esc(({plant:'Planta',asset:'Equipamento',start:'Início',end:'Fim',maintenanceType:'Tipo de manutenção',priority:'Prioridade',orderStatus:'Status',area:'Área',location:'Local',responsible:'Responsável',team:'Equipe',period:'Período',seriesBuckets:'Intervalos'})[key] || key)}</dt><dd>${esc(value)}</dd>`).join('') || '<dd>Nenhum filtro adicional informado.</dd>'}</dl></details></section>
      ${selection.key==='availability'?'<p class="gm-evidence-note">Disponibilidade usa calendários operacionais e paradas, não a duração das O.S. As O.S. abaixo são apenas vínculos explícitos das paradas. Os calendários não são enumerados no contrato do indicador.</p>':''}
      ${selection.key==='mtbf'?'<p class="gm-evidence-note">As O.S. representam as falhas. As horas operacionais vêm de horímetros ou do calendário descontado das paradas, conforme a base oficial. Não correspondem à soma das durações das O.S.</p>':''}
      <section><h3>${selection.key==='availability'?'Paradas informadas na base do indicador':'Registros usados no cálculo'}</h3>${rows(direct)}</section>
      ${selection.key==='availability'?`<section><h3>O.S. vinculadas às paradas (não são fonte direta do cálculo)</h3>${rows(linked,direct.length)}</section>`:''}
      ${evidence.unavailable?`<p class="gm-evidence-note">${evidence.unavailable} referência(s) não disponível(is) para consulta neste perfil ou estado atual dos dados. Não foram substituídas por outros registros.</p>`:''}
      ${evidence.truncated?'<p class="gm-evidence-note">O serviço retorna no máximo 500 referências. Esta lista pode ser parcial, mesmo quando o valor agregado está completo.</p>':''}
      ${evidence.orderIds.length?'<button type="button" class="btn primary" data-gm-skip-icon data-evidence-orders>Abrir estas O.S. na lista</button>':''}`;
    target.querySelectorAll('[data-evidence-record]').forEach(button=>button.addEventListener('click',()=>options.openRecord?.(entries[Number(button.dataset.evidenceRecord)])));
    target.querySelector('[data-evidence-orders]')?.addEventListener('click',()=>options.openOrders?.(evidence.orderIds));
  }
  root.GMMaintenanceMetricDetails = Object.freeze({model,render});
})(typeof window === 'undefined' ? globalThis : window);
