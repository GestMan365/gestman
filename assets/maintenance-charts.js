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
  const format = (value, unit) => {
    if (value === null) return 'Sem dados';
    if (unit === 'h' && value > 0 && value < 1) {
      if (value * 3600 < .01) return 'Menos de 0,01 s';
      return value < 1/60 ? `${(value * 3600).toLocaleString('pt-BR',{maximumFractionDigits:2})} s` : `${(value * 60).toLocaleString('pt-BR',{maximumFractionDigits:2})} min`;
    }
    return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ${unit}`;
  };
  const date = value => {
    const parsed = new Date(value || '');
    return Number.isFinite(+parsed) ? parsed.toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'Data não informada';
  };
  const quality = value => ({ valid: 'Base válida', partial: 'Base parcial', insufficient: 'Base insuficiente' })[value] || 'Base insuficiente';
  const shortDate = value => {
    const parsed = new Date(value || '');
    return Number.isFinite(+parsed) ? parsed.toLocaleDateString('pt-BR', { day:'2-digit', month:'short', timeZone:'UTC' }).replace(/\./g, '').replace(/\s+de\s+/g, ' ') : 'Sem data';
  };
  function model(contract, targets = {}) {
    return definitions.map(definition => {
      const metric = contract?.metrics?.[definition.key] || {};
      const series = (contract?.series?.[definition.key] || []).map((point, index) => ({
        ...point,
        value: point.quality === 'insufficient' ? null : number(point.value, definition.key),
        period: `${shortDate(point.start)} – ${shortDate(point.end)}`,
        range: `${date(point.start)} – ${date(point.end)}`,
        recordCount: Math.max(0, Math.trunc(Number(point.recordCount) || 0)),
      }));
      const values = series.filter(point => point.value !== null).map(point => point.value);
      const value = metric.quality?.state === 'insufficient' ? null : number(metric.value, definition.key);
      const goal = number(targets[definition.key], definition.key);
      const max = Math.max(1, value ?? 0, goal ?? 0, ...values);
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
      return { ...definition, metric, points, segments, ceiling, value, goal, referenceY: value === null ? null : 174 - value / ceiling * 142, valid: values.length };
    });
  }
  function plot(card) {
    const grid = Array.from({ length: 5 }, (_, index) => {
      const y = 174 - index * 35.5;
      return `<line x1="54" x2="486" y1="${y}" y2="${y}" class="gm-metric-gridline"/><text x="46" y="${y + 4}" text-anchor="end">${escape((card.ceiling * index / 4).toLocaleString('pt-BR', { maximumFractionDigits: 2, notation: 'compact' }))}</text>`;
    }).join('');
    const labelIndices = [...new Set(Array.from({length:Math.min(4, card.points.length)}, (_, i) => Math.round(i * (card.points.length - 1) / Math.max(1, Math.min(4, card.points.length) - 1))))];
    const labels = labelIndices.map(index => {
      const point = card.points[index];
      const anchor = index === 0 ? 'start' : index === card.points.length - 1 ? 'end' : 'middle';
      return `<text class="gm-metric-axis-date" x="${point.x}" y="199" text-anchor="${anchor}"><tspan x="${point.x}">${escape(shortDate(point.start))}</tspan><tspan x="${point.x}" dy="18">a ${escape(shortDate(point.end))}</tspan><title>${escape(point.range)}</title></text>`;
    }).join('');
    const paths = card.segments.filter(segment => segment.length > 1).map(segment => {
      const line = segment.map((point, index) => `${index ? 'L' : 'M'}${point.x},${point.y}`).join(' ');
      return `<path class="gm-metric-area" d="${line} L${segment.at(-1).x},174 L${segment[0].x},174 Z"/><path class="gm-metric-line" d="${line}"/>`;
    }).join('');
    const points = card.points.map((point, index) => point.value === null ? '' : `<g><circle class="gm-metric-dot ${point.quality === 'partial' ? 'is-partial' : ''}" cx="${point.x}" cy="${point.y}" r="4.5"/><circle class="gm-metric-hit" cx="${point.x}" cy="${point.y}" r="14" tabindex="0" role="button" data-point="${index}" aria-label="${escape(`${card.name}, ${point.period}, ${point.range}: ${format(point.value, card.unit)}. ${quality(point.quality)}`)}"><title>${escape(`${point.range}: ${format(point.value, card.unit)}`)}</title></circle></g>`).join('');
    const reference = card.referenceY === null ? '' : `<line class="gm-metric-reference" x1="54" x2="486" y1="${card.referenceY}" y2="${card.referenceY}"><title>${escape(`Referência do período: ${format(card.value, card.unit)}. Não representa evolução histórica.`)}</title></line>`;
    const latest = card.points.filter(point => point.value !== null).at(-1);
    const label = latest ? format(latest.value, card.unit) : '';
    const labelWidth = Math.min(160, Math.max(76, label.length * 8 + 20));
    const labelX = latest ? Math.max(54, Math.min(486 - labelWidth, latest.x - labelWidth / 2)) : 54;
    const labelY = latest ? (latest.y < 58 ? latest.y + 12 : latest.y - 33) : 0;
    const latestLabel = latest ? `<g class="gm-metric-value-label" aria-hidden="true" pointer-events="none"><rect x="${labelX}" y="${labelY}" width="${labelWidth}" height="25" rx="7"/><text x="${labelX + labelWidth / 2}" y="${labelY + 17}" text-anchor="middle">${escape(label)}</text></g>` : '';
    const goal = card.goal === null ? '' : `<line class="gm-metric-goal-line" x1="54" x2="486" y1="${174-card.goal/card.ceiling*142}" y2="${174-card.goal/card.ceiling*142}"><title>Meta: ${format(card.goal,card.unit)}</title></line>`;
    return `<svg class="gm-metric-plot" viewBox="0 0 510 236" role="group" aria-label="Gráfico de ${card.name}. ${card.unit === 'h' ? 'Horas' : 'Percentual'}. Intervalos por data. Escala independente."><text class="gm-metric-axis-unit" x="54" y="17">${card.unit === 'h' ? 'Horas' : 'Percentual (%)'}</text>${grid}${reference}${paths}${goal}${labels}${points}${latestLabel}</svg>`;
  }
  function initialDetail(card) {
    const point = card.points.filter(point => point.value !== null).at(-1);
    return point ? selectedDetail(point, card, true) : '';
  }
  function selectedDetail(point, card, latest = false) {
    return `<div class="gm-metric-selection-head"><span>${latest ? 'Último intervalo com dados' : 'Intervalo selecionado'}</span><strong>${format(point.value, card.unit)}</strong></div><div class="gm-metric-selection-meta"><span>${escape(point.range)}</span><span>${point.recordCount} registro(s) · ${quality(point.quality)}</span></div>`;
  }
  function metricIcon(key) {
    const drawing = key === 'mttr' ? '<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2M9 2h6"/>' : key === 'mtbf' ? '<path d="M4 9a8 8 0 0 1 14-3l2 3M20 4v5h-5M20 15a8 8 0 0 1-14 3l-2-3M4 20v-5h5"/>' : '<path d="M4 13h4l3-7 3 13 3-6h3"/><rect x="2" y="3" width="20" height="18" rx="4"/>';
    return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${drawing}</svg>`;
  }
  function interpretation(card) {
    return card.key === 'mttr' ? 'Em média, para concluir um reparo.' : card.key === 'mtbf' ? 'De operação comprovada por falha registrada.' : 'Do tempo programado com operação disponível.';
  }
  function compare(card, previousContract) {
    const before = model(previousContract).find(item => item.key === card.key);
    if (card.value === null || before.value === null) return null;
    const delta = card.value - before.value;
    const better = card.key === 'mttr' ? delta < 0 : delta > 0;
    return {delta, better, previous:before.value, partial:card.metric.quality?.state !== 'valid' || before.metric.quality?.state !== 'valid'};
  }
  function comparison(card, previousContract, comparisonState) {
    const result = compare(card,previousContract);
    if (!result) return `<span class="gm-metric-comparison is-neutral">${comparisonState === 'loading' ? 'Consultando período anterior…' : comparisonState === 'error' ? 'Comparação temporariamente indisponível' : 'Sem base para comparar períodos'}</span>`;
    const {delta,better,partial} = result;
    const direction = delta === 0 ? 'Estável' : `${better ? 'Melhorou' : 'Piorou'} ${format(Math.abs(delta), card.unit === '%' ? 'p.p.' : 'h')}`;
    return `<span class="gm-metric-comparison ${delta === 0 ? 'is-neutral' : better ? 'is-better' : 'is-worse'}">${direction}<span>Anterior: ${format(result.previous,card.unit)}</span><span>${date(previousContract.period?.start)} – ${date(previousContract.period?.end)}</span>${partial ? '<span>Comparação com base parcial; a cobertura pode ser diferente.</span>' : ''}</span>`;
  }
  function summary(card) {
    if(card.value === null) return 'Ainda faltam registros válidos para explicar este indicador. Confira a cobertura abaixo.';
    const value = format(card.value,card.unit);
    return card.key === 'mttr' ? `Cada reparo corretivo levou, em média, ${value} para ser concluído.` : card.key === 'mtbf' ? `Foram comprovadas ${value} de operação para cada falha corretiva registrada.` : `${value} do tempo programado esteve disponível para operar.`;
  }
  function goalStatus(card) {
    if(card.goal === null) return '<div class="gm-metric-goal">Meta não configurada</div>';
    const met = card.value !== null && (card.key === 'mttr' ? card.value <= card.goal : card.value >= card.goal);
    return `<div class="gm-metric-goal"><strong>Meta ${card.key === 'mttr' ? 'máxima' : 'mínima'}: ${format(card.goal,card.unit)}</strong><span>${card.value === null ? 'Sem base para avaliar' : `${met ? 'Dentro da meta' : 'Fora da meta'}${card.metric.quality?.state === 'partial' ? ' · avaliação parcial' : ''}`}</span><small>Linha pontilhada no gráfico</small></div>`;
  }
  function validateTargets(input) {
    return Object.fromEntries(definitions.map(({key}) => {
      const raw = input[key];
      if(raw == null || String(raw).trim() === '') return [key,null];
      const value = number(typeof raw === 'string' ? raw.trim().replace(',','.') : raw,key);
      if(value === null) throw Error('Informe metas numéricas não negativas; disponibilidade deve estar entre 0 e 100%.');
      return [key,value];
    }));
  }
  function coverage(card) {
    return `<div class="gm-metric-coverage"><div><span>Cobertura do histórico</span><strong>${card.valid} de ${card.points.length} intervalos</strong></div><div class="gm-metric-coverage-track" aria-hidden="true">${card.points.map(point => `<span class="${point.value === null ? 'is-missing' : point.quality === 'partial' ? 'is-partial' : 'has-data'}" title="${escape(`${point.range}: ${point.value === null ? 'sem dados' : quality(point.quality)}`)}"></span>`).join('')}</div></div>`;
  }
  function sourceCoverage(metric) {
    const data=metric.coverage;if(!data)return '';
    const label=data.basis==='repairs'?'Reparos com duração válida':data.basis==='hour_meter'?'Equipamentos com horímetro válido':'Equipamentos com jornada no período';
    const note=!data.total?'Nenhum registro no período e filtros selecionados.':data.missing?`${escape(data.missing)} sem base válida. Este resultado não representa toda a operação.`:'Todos os registros do filtro têm base válida.';
    return `<div class="gm-source-coverage"><span>${label}</span><strong>${escape(data.covered)} de ${escape(data.total)} · ${data.percentage==null?'sem base':escape(data.percentage.toLocaleString('pt-BR'))+'%'}</strong><progress max="${Math.max(1,data.total)}" value="${Math.max(0,data.covered)}" aria-label="${label}"></progress><small>${note}${data.basis==='calendar'?' Conta equipamentos com alguma jornada no período, não todos os dias do histórico.':''}</small></div>`;
  }
  const previous = new WeakMap();
  function render(target, contract, options = {}) {
    if (!target) return;
    const state = options.state || (contract ? 'ready' : 'loading');
    const signature = JSON.stringify([state, contract, options.scope, options.previousContract, options.comparisonState, options.targets, !!options.configureTargets]);
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
    const cards = model(contract, options.targets);
    target.innerHTML = `<div class="gm-metric-context"><span>${escape(options.scope || 'Empresa')} · ${date(contract.period?.start)} – ${date(contract.period?.end)}</span><span>Atualizado em ${escape(new Date(contract.updatedAt).toLocaleString('pt-BR'))}</span></div>
      <div class="gm-metric-insight-toolbar"><span>Comparação: período anterior de igual duração · mesmo filtro de planta</span>${options.configureTargets ? '<button class="btn" type="button" data-gm-skip-icon data-configure-targets>Configurar metas</button>' : ''}</div>
      <div class="gm-metric-cards">${cards.map(card => `<section class="gm-metric-card" data-metric="${card.key}" aria-label="${card.name}">
        <div class="gm-metric-heading"><span class="gm-metric-symbol">${metricIcon(card.key)}</span><div class="gm-metric-heading-copy"><h3>${card.name}</h3><p>${card.title}</p></div><span class="gm-metric-quality" data-quality="${escape(card.metric.quality?.state || 'insufficient')}">${quality(card.metric.quality?.state)}</span></div>
        <div class="gm-metric-value"><span class="gm-metric-eyebrow">${card.key === 'availability' ? 'Disponibilidade no período' : 'Média do período'}</span><strong>${format(card.value, card.unit)}</strong><span>${interpretation(card)}</span></div>
        <p class="gm-metric-summary">${summary(card)}${card.metric.quality?.state === 'partial' ? ' Resultado parcial: não representa toda a operação.' : ''}</p>
        <div class="gm-metric-direction"><span>${card.key === 'mttr' ? '↓' : '↑'} ${card.direction}</span>${comparison(card,options.previousContract,options.comparisonState)}</div>
        ${goalStatus(card)}
        <div class="gm-metric-chart-heading"><strong>Evolução por intervalo</strong><span>${card.valid === 1 ? '1 intervalo registrado' : `${card.valid} intervalos registrados`}</span></div>
        ${card.valid ? plot(card) : `<div class="gm-metric-state" role="status"><strong>Ainda não é possível calcular a evolução</strong><p>${escape(card.metric.detail || card.hint)}</p><p>${card.key === 'mtbf' ? 'Confira os horímetros ou vincule um calendário operacional aos ativos, além de registrar as falhas corretivas.' : card.key === 'availability' ? 'Vincule um calendário operacional válido aos ativos e registre as paradas com início e fim.' : 'Conclua os reparos corretivos com horários válidos de início e término.'}</p></div>`}
        ${card.value !== null ? `<p class="gm-metric-reference-label"><span aria-hidden="true"></span>Referência: ${card.key === 'availability' ? 'disponibilidade' : 'média'} do período · ${format(card.value, card.unit)}</p>` : ''}
        ${sourceCoverage(card.metric)}
        ${coverage(card)}
        ${options.details ? '<button type="button" class="btn gm-metric-open-details" data-gm-skip-icon data-metric-details>Ver detalhes e O.S. do período</button>' : ''}
        ${card.valid ? `<div class="gm-metric-detail" aria-live="polite" data-point-detail>${initialDetail(card)}</div>` : ''}
        ${card.valid === 1 ? '<p class="gm-metric-empty">Apenas um intervalo com dados. Ainda não há histórico suficiente para mostrar uma tendência.</p>' : ''}
        ${card.metric.quality?.state === 'partial' ? '<p class="gm-metric-quality-note">Leitura parcial: resultado considera apenas os registros disponíveis.</p>' : ''}
        <details class="gm-metric-explanation"><summary>Como interpretar este indicador</summary><p>${card.key === 'mttr' ? 'Quanto menos tempo um reparo leva, mais rápido o equipamento retorna à operação.' : card.key === 'mtbf' ? 'Mais horas de operação por falha indicam maior tempo de funcionamento entre ocorrências.' : 'Quanto mais próximo de 100%, maior a parcela do tempo programado disponível para operar.'}</p><p>${escape(card.metric.detail || card.hint)}</p></details>
      </section>`).join('')}</div>
      <p class="gm-metric-note">Toque ou passe o mouse nos pontos para consultar cada intervalo. Trechos vazios significam ausência de dados, não valor zero.</p>
      <details class="gm-metric-data"><summary>Ver dados e metodologia</summary><p>Cada gráfico tem sua própria escala. A linha tracejada representa o resultado do período inteiro; não é uma meta nem uma evolução histórica. Pontos vazados e faixas claras indicam base parcial. As datas mostram os limites de cada intervalo, não necessariamente meses completos.</p><p>MTTR: duração total dos reparos corretivos concluídos ÷ reparos válidos. MTBF: horas operacionais comprovadas ÷ falhas. Disponibilidade: tempo operacional disponível em relação ao calendário válido. Nenhuma média de médias é utilizada nos totais.</p>
      <div class="gm-metric-table-wrap" tabindex="0" role="region" aria-label="Tabela dos indicadores por intervalo"><table><caption>Valores oficiais por intervalo</caption><thead><tr><th scope="col">Indicador</th><th scope="col">Intervalo</th><th scope="col">Valor</th><th scope="col">Registros</th><th scope="col">Qualidade</th></tr></thead><tbody>${cards.flatMap(card => card.points.map(point => `<tr><th scope="row">${card.name} · ${point.period}</th><td>${escape(point.range)}</td><td>${format(point.value, card.unit)}</td><td>${point.recordCount}</td><td>${quality(point.quality)}</td></tr>`)).join('')}</tbody></table></div></details>`;
    target.querySelector('[data-configure-targets]')?.addEventListener('click', () => options.configureTargets());
    cards.forEach(card => {
      const element = target.querySelector(`[data-metric="${card.key}"]`);
      const details = point => options.details?.({key:card.key,name:card.name,unit:card.unit,metric:point ? {...card.metric,...point,period:{start:point.start,end:point.end},quality:{state:point.quality}} : card.metric,period:contract.period});
      element.querySelector('[data-metric-details]')?.addEventListener('click', () => details());
      const select = event => {
        const hit = event.target.closest('[data-point]');
        if (!hit) return;
        const point = card.points[Number(hit.dataset.point)];
        element.querySelector('[data-point-detail]').innerHTML = selectedDetail(point, card);
        element.querySelectorAll('.gm-metric-hit').forEach(node => node.classList.toggle('is-selected', node === hit));
      };
      element.addEventListener('pointerover', select);
      element.addEventListener('click', event => {
        select(event);
        const hit = event.target.closest('[data-point]');
        if (hit) details(card.points[Number(hit.dataset.point)]);
        else if (event.target.closest('.gm-metric-plot')) details();
      });
      element.addEventListener('focusin', select);
      element.addEventListener('keydown', event => { const hit=event.target.closest('[data-point]'); if (hit && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); select(event); details(card.points[Number(hit.dataset.point)]); } });
    });
  }
  root.GMMaintenanceCharts = Object.freeze({ model, render, compare, validateTargets });
})(typeof window === 'undefined' ? globalThis : window);
