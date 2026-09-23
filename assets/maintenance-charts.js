/* Read-only presentation of the official maintenance-metrics contract. */
(function (root) {
  'use strict';
  const definitions = [
    { key: 'mttr', name: 'MTTR', title: 'Tempo médio de reparo', unit: 'h', direction: 'Menor é melhor', hint: 'Reparos corretivos concluídos com duração válida.' },
    { key: 'mtbf', name: 'MTBF', title: 'Tempo médio entre falhas', unit: 'h', direction: 'Maior é melhor', hint: 'Horas operacionais comprovadas por falha corretiva.' },
    { key: 'availability', name: 'Disponibilidade', title: 'Tempo disponível para operar', unit: '%', direction: 'Maior é melhor', hint: 'Calendário operacional e paradas registradas.' },
  ];
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  function number(value, key) {
    if (value == null || value === '' || typeof value === 'boolean') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 && (key !== 'availability' || parsed <= 100) ? parsed : null;
  }
  const format = (value, unit) => value === null ? 'Sem dados' : `${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ${unit}`;
  const date = value => {
    const parsed = new Date(value || '');
    return Number.isFinite(+parsed) ? parsed.toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'Data não informada';
  };
  const quality = value => ({ valid: 'Base válida', partial: 'Base parcial', insufficient: 'Base insuficiente' })[value] || 'Base insuficiente';
  function model(contract) {
    return definitions.map(definition => {
      const metric = contract?.metrics?.[definition.key] || {};
      const series = (contract?.series?.[definition.key] || []).map((point, index) => ({
        ...point,
        value: point.quality === 'insufficient' ? null : number(point.value, definition.key),
        period: `P${index + 1}`,
        range: `${date(point.start)} – ${date(point.end)}`,
        recordCount: Math.max(0, Math.trunc(Number(point.recordCount) || 0)),
      }));
      const values = series.filter(point => point.value !== null).map(point => point.value);
      const max = Math.max(1, ...values);
      const magnitude = 10 ** Math.floor(Math.log10(max));
      const ceiling = definition.unit === '%' ? 100 : Math.ceil(max / magnitude) * magnitude;
      const points = series.map((point, index) => ({ ...point, x: 54 + index * 432 / Math.max(1, series.length - 1), y: point.value === null ? null : 174 - point.value / ceiling * 142 }));
      const segments = [];
      let segment = [];
      for (const point of points) {
        if (point.y === null) { if (segment.length) segments.push(segment); segment = []; }
        else segment.push(point);
      }
      if (segment.length) segments.push(segment);
      return { ...definition, metric, points, segments, ceiling, value: metric.quality?.state === 'insufficient' ? null : number(metric.value, definition.key), valid: values.length };
    });
  }
  function plot(card) {
    const grid = Array.from({ length: 5 }, (_, index) => {
      const y = 174 - index * 35.5;
      return `<line x1="54" x2="486" y1="${y}" y2="${y}" class="gm-metric-gridline"/><text x="46" y="${y + 4}" text-anchor="end">${escape((card.ceiling * index / 4).toLocaleString('pt-BR', { maximumFractionDigits: 2, notation: 'compact' }))}</text>`;
    }).join('');
    const step = Math.max(1, Math.ceil(card.points.length / 6));
    const labels = card.points.filter((_, index) => index % step === 0 || index === card.points.length - 1).map(point => `<text x="${point.x}" y="199" text-anchor="middle">${point.period}</text>`).join('');
    const paths = card.segments.map(segment => {
      const line = segment.map((point, index) => `${index ? 'L' : 'M'}${point.x},${point.y}`).join(' ');
      return `<path class="gm-metric-area" d="${line} L${segment.at(-1).x},174 L${segment[0].x},174 Z"/><path class="gm-metric-line" d="${line}"/>`;
    }).join('');
    const points = card.points.map((point, index) => point.value === null ? '' : `<g><circle class="gm-metric-dot ${point.quality === 'partial' ? 'is-partial' : ''}" cx="${point.x}" cy="${point.y}" r="4"/><circle class="gm-metric-hit" cx="${point.x}" cy="${point.y}" r="12" tabindex="0" role="button" data-point="${index}" aria-label="${escape(`${card.name}, ${point.period}, ${point.range}: ${format(point.value, card.unit)}. ${quality(point.quality)}`)}"><title>${escape(`${point.range}: ${format(point.value, card.unit)}`)}</title></circle></g>`).join('');
    return `<svg class="gm-metric-plot" viewBox="0 0 510 218" role="group" aria-label="Gráfico de ${card.name}. ${card.unit === 'h' ? 'Horas' : 'Percentual'}. Escala independente."><text x="54" y="17">${card.unit === 'h' ? 'Horas' : 'Percentual (%)'}</text>${grid}${paths}${labels}${points}</svg>`;
  }
  const previous = new WeakMap();
  function render(target, contract, options = {}) {
    if (!target) return;
    const state = options.state || (contract ? 'ready' : 'loading');
    const signature = JSON.stringify([state, contract, options.scope]);
    if (previous.get(target) === signature) return;
    previous.set(target, signature);
    target.classList.add('gm-maintenance-charts');
    target.setAttribute('aria-busy', String(state === 'loading'));
    const states = {
      loading: ['Carregando indicadores', 'Consultando os dados oficiais da empresa.'],
      error: ['Não foi possível consultar os indicadores', 'Nenhum valor estimado foi apresentado. Tente novamente.'],
      pending: ['Aguardando sincronização', 'Os gráficos serão recalculados após a confirmação dos dados salvos.'],
      unavailable: ['Indicadores indisponíveis', 'É necessário acesso autorizado aos indicadores da empresa.'],
    };
    if (state !== 'ready') {
      const message = states[state] || states.unavailable;
      target.innerHTML = `<div class="gm-metric-state" role="status"><strong>${message[0]}</strong><p>${message[1]}</p>${state === 'error' ? '<button type="button" class="btn" data-gm-skip-icon data-metric-retry>Tentar novamente</button>' : ''}</div>`;
      target.querySelector('[data-metric-retry]')?.addEventListener('click', () => options.retry?.());
      return;
    }
    const cards = model(contract);
    target.innerHTML = `<div class="gm-metric-context"><span>${escape(options.scope || 'Empresa')} · ${date(contract.period?.start)} – ${date(contract.period?.end)}</span><span>Atualizado em ${escape(new Date(contract.updatedAt).toLocaleString('pt-BR'))}</span></div>
      <div class="gm-metric-cards">${cards.map(card => `<section class="gm-metric-card" data-metric="${card.key}" aria-label="${card.name}">
        <div class="gm-metric-heading"><div><h3>${card.name}</h3><p>${card.title}</p></div><span class="gm-metric-quality" data-quality="${escape(card.metric.quality?.state || 'insufficient')}">${quality(card.metric.quality?.state)}</span></div>
        <div class="gm-metric-value"><strong>${format(card.value, card.unit)}</strong><span>Indicador no período inteiro</span></div>
        <p class="gm-metric-direction">${card.direction} <span>· ${card.valid}/${card.points.length} intervalos com dados</span></p>
        ${plot(card)}
        ${!card.valid ? `<p class="gm-metric-empty">Sem evidência suficiente para traçar a série. ${card.hint}</p>` : ''}
        <div class="gm-metric-detail" aria-live="polite" data-point-detail>Toque ou foque um ponto para consultar datas, valor e qualidade.</div>
        <p class="gm-metric-method">${escape(card.metric.detail || card.hint)}</p>
      </section>`).join('')}</div>
      <p class="gm-metric-note">Dados oficiais da empresa · Cada gráfico tem sua própria escala. Lacunas representam ausência de evidência, não zero. Pontos vazados indicam base parcial. P1, P2… são os intervalos calculados pelo serviço, não necessariamente meses completos.</p>
      <details class="gm-metric-data"><summary>Ver dados e metodologia</summary><p>MTTR: duração total dos reparos corretivos concluídos ÷ reparos válidos. MTBF: horas operacionais comprovadas ÷ falhas. Disponibilidade: tempo operacional disponível em relação ao calendário válido. Nenhuma média de médias é utilizada nos totais.</p>
      <div class="gm-metric-table-wrap" tabindex="0" role="region" aria-label="Tabela dos indicadores por intervalo"><table><caption>Valores oficiais por intervalo</caption><thead><tr><th scope="col">Indicador</th><th scope="col">Intervalo</th><th scope="col">Valor</th><th scope="col">Registros</th><th scope="col">Qualidade</th></tr></thead><tbody>${cards.flatMap(card => card.points.map(point => `<tr><th scope="row">${card.name} · ${point.period}</th><td>${escape(point.range)}</td><td>${format(point.value, card.unit)}</td><td>${point.recordCount}</td><td>${quality(point.quality)}</td></tr>`)).join('')}</tbody></table></div></details>`;
    cards.forEach(card => {
      const element = target.querySelector(`[data-metric="${card.key}"]`);
      const select = event => {
        const hit = event.target.closest('[data-point]');
        if (!hit) return;
        const point = card.points[Number(hit.dataset.point)];
        element.querySelector('[data-point-detail]').textContent = `${point.period} · ${point.range} · ${format(point.value, card.unit)} · ${point.recordCount} registro(s) · ${quality(point.quality)}. ${point.detail || ''}`;
      };
      element.addEventListener('pointerover', select);
      element.addEventListener('click', select);
      element.addEventListener('focusin', select);
      element.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(event); } });
    });
  }
  root.GMMaintenanceCharts = Object.freeze({ model, render });
})(typeof window === 'undefined' ? globalThis : window);
