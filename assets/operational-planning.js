(function (root) {
  'use strict';
  const priorities = ['Baixa', 'Média', 'Alta', 'Crítica', 'Urgente'];
  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const key = text => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const esc = text => String(text ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number = value => value === '' || value == null || typeof value === 'boolean' ? null : Number(String(value).replace(',', '.'));
  const stamp = value => value === '' || value == null ? NaN : new Date(value).getTime();
  const terminal = value => /^(concluid|finaliz|encerrad|cancelad)/.test(key(value));
  function policy(values) {
    const slaHours = {};
    for (const label of priorities) {
      const value = number(values[key(label)]);
      if (value === null) continue;
      if (!Number.isFinite(value) || value <= 0 || value > 8760) throw Error(`Informe um prazo entre 0 e 8760 horas para ${label}.`);
      slaHours[key(label)] = value;
    }
    return { slaHours };
  }
  function deadline(priority, createdAt, settings) {
    const hours = number(settings?.slaHours?.[key(priority)]), start = stamp(createdAt);
    return Number.isFinite(start) && Number.isFinite(hours) && hours > 0 && hours <= 8760 ? new Date(start + hours * 3600000).toISOString() : '';
  }
  function calendar(input, assets) {
    const name = String(input.name || '').trim();
    if (!name || name.length > 100) throw Error('Informe um nome com até 100 caracteres.');
    if (!input.assetId || !assets.some(asset => asset.id === input.assetId)) throw Error('Selecione um equipamento cadastrado.');
    const weekdays = [...new Set(input.weekdays || [])].map(Number).sort();
    if (!weekdays.length || weekdays.some(day => !Number.isInteger(day) || day < 0 || day > 6)) throw Error('Selecione pelo menos um dia da semana.');
    const minute = text => /^([01]\d|2[0-3]):[0-5]\d$/.test(text) ? Number(text.slice(0,2)) * 60 + Number(text.slice(3)) : NaN;
    const start = minute(input.startTime), end = minute(input.endTime), pause = number(input.breakMinutes) ?? 0;
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw Error('O término deve ser posterior ao início, no mesmo dia UTC.');
    if (!Number.isInteger(pause) || pause < 0 || pause >= end - start) throw Error('A pausa deve ser menor que a duração do turno.');
    return { name, assetId: input.assetId, weekdays, startTime:input.startTime, endTime:input.endTime, breakMinutes:pause, status:input.status === 'Inativo' ? 'Inativo' : 'Ativo' };
  }
  function editableCalendar(item) {
    return Boolean(item?.id && item.assetId && Array.isArray(item.weekdays) && item.startTime && item.endTime
      && !['locationId','sectorLocationId','operationalAreaId','regionId','default','appliesToAllAssets','timezone','validFrom','validTo'].some(field => item[field]));
  }
  function uncoveredAssets(assets, calendars, contextFor = () => ({})) {
    return assets.filter(asset => !key(asset.status).startsWith('inativ')).filter(asset => !calendars.some(item => {
      if (key(item.status).startsWith('inativ')) return false;
      const weekdays = item.weekdays || item.daysOfWeek || item.days;
      if (!Array.isArray(weekdays) || !weekdays.length) return false;
      const minute = value => /^([01]?\d|2[0-3]):[0-5]\d$/.test(value || '') ? Number(value.split(':')[0])*60+Number(value.split(':')[1]) : NaN;
      const schedule = String(item.schedule || item.hours || item.operatingHours || '').match(/(\d{1,2}:\d{2})\s*[-–às]+\s*(\d{1,2}:\d{2})/i);
      const start = minute(item.startTime || item.start || schedule?.[1]), end = minute(item.endTime || item.end || schedule?.[2]);
      const dailyHours = number(item.dailyHours || item.hoursPerDay || item.operatingHoursPerDay);
      if (!(end > start && end-start > Number(item.breakMinutes || item.breaksMinutes || 0)) && !(dailyHours > 0 && dailyHours <= 24 && (!Number.isFinite(start) || !Number.isFinite(end)))) return false;
      const context = contextFor(asset);
      const bindings = [['assetId',asset.id],['locationId',asset.locationId],['sectorLocationId',context.sectorLocationId],['operationalAreaId',context.operationalAreaId],['regionId',context.regionId]].filter(([field]) => item[field]);
      return bindings.length ? bindings.every(([field,value]) => String(item[field]) === String(value || '')) : item.default === true || item.appliesToAllAssets === true;
    }));
  }
  function summary(orders, assets, now = Date.now()) {
    const unique = [...new Map(orders.filter(order => order?.id).map(order => [order.id, order])).values()];
    const active = unique.filter(order => !terminal(order.status));
    const age = [0,0,0,0], byPriority = new Map(), byAsset = new Map();
    const ageIds = [[],[],[],[]], priorityIds = new Map(), assetIds = new Map();
    const maintenanceIds = {preventiva:[],corretiva:[]};
    const kpiIds = {pending:active.map(order=>order.id),overdue:[],noDeadline:[]};
    let overdue = 0, noDeadline = 0, unknownAge = 0, preventive = 0, corrective = 0;
    for (const order of active) {
      const opened = stamp(order.createdAt || order.openedAt);
      if (!Number.isFinite(opened) || opened > now) unknownAge++;
      else { const elapsed = (now - opened) / 86400000, bucket = elapsed < 7 ? 0 : elapsed < 30 ? 1 : elapsed < 90 ? 2 : 3; age[bucket]++; ageIds[bucket].push(order.id); }
      const due = stamp(order.deadline || order.dueAt || order.scheduledAt);
      if (!Number.isFinite(due)) { noDeadline++; kpiIds.noDeadline.push(order.id); }
      else if (due < now) { overdue++; kpiIds.overdue.push(order.id); }
      const label = priorities.find(p => key(p) === key(order.priority)) || 'Sem prioridade';
      byPriority.set(label, (byPriority.get(label) || 0) + 1);
      if (!priorityIds.has(label)) priorityIds.set(label, []);
      priorityIds.get(label).push(order.id);
    }
    for (const order of unique) {
      if (key(order.status).startsWith('cancelad')) continue;
      const type = key(order.maintenanceType || order.type || order.maintenance);
      if (type === 'preventiva' || type === 'corretiva') maintenanceIds[type].push(order.id);
      if (type === 'preventiva') preventive++;
      if (type === 'corretiva') {
        corrective++;
        if (order.assetId) {
          byAsset.set(order.assetId, (byAsset.get(order.assetId) || 0) + 1);
          if (!assetIds.has(order.assetId)) assetIds.set(order.assetId, []);
          assetIds.get(order.assetId).push(order.id);
        }
      }
    }
    const top = [...byAsset].map(([id,count]) => ({ id, count, name:assets.find(asset => asset.id === id)?.name || 'Equipamento não disponível' })).sort((a,b) => b.count-a.count || a.name.localeCompare(b.name)).slice(0,5);
    return { total:unique.length, active:active.length, overdue, noDeadline, unknownAge, age, byPriority:[...byPriority], preventive, corrective, top, selections:{age:ageIds,priority:Object.fromEntries(priorityIds),asset:Object.fromEntries(assetIds),maintenance:maintenanceIds,kpi:kpiIds} };
  }
  function renderSummary(target, data, onSelect) {
    if (!target) return;
    const fmt = value => Number(value || 0).toLocaleString('pt-BR');
    const actions = [];
    const bars = (pairs, colors, base, selections) => pairs.length ? pairs.map(([label,count],index) => {
      const limit = base ?? Math.max(1,...pairs.map(p=>p[1]));
      const percent = limit ? Math.min(100, count / limit * 100) : 0;
      const selection = selections?.[index], clickable = typeof onSelect === 'function' && selection;
      const action = clickable ? actions.push(selection)-1 : -1;
      return `<${clickable?'button':'div'} class="gm-ops-bar${clickable?' gm-ops-bar-action':''}" ${clickable?`type="button" data-gm-skip-icon data-ops-selection="${action}" aria-label="Ver O.S.: ${esc(selection.label)}, ${fmt(count)} ordens"`:''} style="--ops-bar-color:${colors[index % colors.length]}"><span class="gm-ops-bar-label"><span title="${esc(label)}">${esc(label)}</span><strong>${fmt(count)}</strong>${base !== undefined ? `<small>${Math.round(percent)}%</small>` : ''}</span><span class="gm-ops-bar-track" role="meter" aria-label="${esc(label)}" aria-valuemin="0" aria-valuemax="${Math.max(1,limit)}" aria-valuenow="${count}" aria-valuetext="${fmt(count)} registro(s)"><i style="width:${percent}%"></i></span></${clickable?'button':'div'}>`;
    }).join('') : '<p class="gm-ops-empty">Nenhum registro encontrado neste histórico.</p>';
    const priorityOrder = ['Urgente','Crítica','Alta','Média','Baixa','Sem prioridade'];
    const priorityColors = {Urgente:'#bd4256','Crítica':'#e15b66',Alta:'#e68b35','Média':'#4a91d8',Baixa:'#29a486','Sem prioridade':'#8698ad'};
    const pendingPriorities = [...data.byPriority].sort((a,b)=>priorityOrder.indexOf(a[0])-priorityOrder.indexOf(b[0]));
    const totalTyped = data.preventive + data.corrective;
    target.innerHTML = `<div class="gm-ops-context"><span>Histórico completo da operação</span><small>Conforme seu perfil de acesso</small></div>
      <div class="gm-ops-kpis">${[[data.active,'O.S. pendentes','Acompanhar a fila de atendimento','blue','pending'],[data.overdue,'Prazos vencidos','Pendências que ultrapassaram o prazo','red','overdue'],[data.noDeadline,'Sem prazo válido','Ordens que precisam de um prazo','amber','noDeadline']].map(([count,label,hint,tone,key])=>{
        const clickable = typeof onSelect === 'function';
        const action = clickable ? actions.push({label,orderIds:data.selections?.kpi?.[key]||[]})-1 : -1;
        return `<${clickable?'button':'div'} data-tone="${tone}" ${clickable?`type="button" class="gm-ops-kpi-action" data-gm-skip-icon data-ops-selection="${action}" aria-label="Ver ${esc(label)}: ${fmt(count)} ordens"`:''}><span class="gm-ops-kpi-label">${label}</span><strong>${fmt(count)}</strong><small>${hint}</small></${clickable?'button':'div'}>`;
      }).join('')}</div>
      <div class="gm-ops-columns"><section><header><span>01 · TEMPO EM ABERTO</span><h3>Idade do backlog</h3><p>Há quanto tempo as ordens aguardam conclusão</p></header>${bars(['Menos de 7 dias','7 a 29 dias','30 a 89 dias','90 dias ou mais'].map((name,i)=>[name,data.age[i]]),['#29a486','#4a91d8','#e6a23a','#e15b66'],data.active,['Menos de 7 dias','7 a 29 dias','30 a 89 dias','90 dias ou mais'].map((label,i)=>({label:'Idade do backlog — '+label,orderIds:data.selections?.age[i]||[]})))}${data.unknownAge?`<p class="gm-ops-quality">${fmt(data.unknownAge)} registro(s) sem data válida de abertura.</p>`:''}</section>
      <section><header><span>02 · URGÊNCIA</span><h3>Prioridades pendentes</h3><p>Distribuição das ordens ainda não encerradas</p></header>${bars(pendingPriorities,pendingPriorities.map(([label])=>priorityColors[label]),data.active,pendingPriorities.map(([label])=>({label:'Prioridade — '+label,orderIds:data.selections?.priority[label]||[]})))}</section>
      <section><header><span>03 · ESTRATÉGIA DE MANUTENÇÃO</span><h3>Preventiva × corretiva</h3><p>Volume de ordens por tipo de manutenção</p></header>${bars([['Preventivas',data.preventive],['Corretivas',data.corrective]],['#29a486','#e68b35'],totalTyped,['preventiva','corretiva'].map(type=>({label:'Tipo de manutenção — '+(type==='preventiva'?'Preventiva':'Corretiva'),orderIds:data.selections?.maintenance?.[type]||[]})))}<p class="gm-ops-quality">Inclui ordens concluídas; exclui canceladas. Percentuais sobre preventivas + corretivas.</p></section>
      <section><header><span>04 · RECORRÊNCIA</span><h3>Ativos com mais corretivas</h3><p>Equipamentos com maior número de ocorrências</p></header>${bars(data.top.map((item,index)=>[`${index+1}. ${item.name}`,item.count]),['#4a91d8'],undefined,data.top.map(item=>({label:'Corretivas — '+item.name,orderIds:data.selections?.asset[item.id]||[]})))}<p class="gm-ops-quality">Quantidade de ordens corretivas por equipamento.</p></section></div>
      <details class="gm-ops-scope"><summary>Sobre este histórico</summary><p>Histórico disponível da empresa, limitado ao seu perfil de acesso. Inclui pendências antigas; não é limitado pelo período dos gráficos de confiabilidade. Percentuais de idade e prioridade consideram todas as O.S. pendentes.</p></details>`;
    target.querySelectorAll?.('[data-ops-selection]').forEach(button => {
      button.addEventListener('click', () => onSelect(actions[Number(button.dataset.opsSelection)]));
    });
  }
  function render(env) {
    const target = env.target;
    if (!target) return;
    const calendars = Array.isArray(env.calendars) ? env.calendars : [];
    const missing = uncoveredAssets(env.assets || [], calendars, env.assetContext);
    target.innerHTML = `<section class="panel gm-ops-settings"><div class="toolbar"><h2>Operação dos equipamentos</h2>${env.canManage?'<button class="btn primary" type="button" data-new-calendar>Novo calendário operacional</button><button class="btn" type="button" data-policy>Prazos por prioridade</button>':''}</div><p>Estes calendários alimentam MTBF e disponibilidade. Jornadas de usuários, acima, são um cadastro separado.</p><div class="table-wrap"><table><thead><tr><th>Calendário / equipamento</th><th>Dias</th><th>Horário UTC</th><th>Status</th><th>Ação</th></tr></thead><tbody>${calendars.map((item,index)=>`<tr><td><strong>${esc(item.name)}</strong><br>${esc(env.assets.find(asset=>asset.id===item.assetId)?.name||'Vínculo não disponível')}</td><td>${esc((item.weekdays||[]).map(day=>days[day]).join(', '))}</td><td>${esc(item.startTime)}–${esc(item.endTime)}<br>${Number(item.breakMinutes)||0} min de pausa</td><td>${esc(item.status||'Ativo')}</td><td>${env.canManage?`<button class="btn" type="button" data-edit-calendar="${index}">Editar</button>`:'Somente leitura'}</td></tr>`).join('')||'<tr><td colspan="5">Nenhum calendário operacional cadastrado. Não há jornada presumida para calcular os indicadores.</td></tr>'}</tbody></table></div><p>Prazo padrão: ${priorities.map(p=>`${p}: ${env.settings?.slaHours?.[key(p)]>0?esc(env.settings.slaHours[key(p)])+' h':'não definido'}`).join(' · ')}</p></section>`;
    const missingPanel = document.createElement('section');
    missingPanel.className = 'gm-ops-missing';
    missingPanel.innerHTML = `<h3>Equipamentos sem calendário operacional <span>(${missing.length})</span></h3><p>Configure a jornada real para incluir as paradas na disponibilidade e no MTBF. Paradas históricas válidas também são consideradas, mesmo anteriores ao cadastro.</p>${missing.length?`<label>Buscar equipamento<input class="field" type="search" data-calendar-search placeholder="Código ou nome do equipamento"></label><div class="gm-ops-missing-list">${missing.map((asset,index)=>`<div class="gm-ops-missing-row" data-calendar-asset="${index}"><span><strong>${esc(asset.code || '')}</strong><br>${esc(asset.name || '')}</span>${env.canManage?`<button class="btn" type="button" data-configure-calendar="${index}" aria-label="Configurar calendário de ${esc(asset.code || asset.name)}">Configurar</button>`:'Solicite a configuração ao administrador'}</div>`).join('')}</div>`:'<p>Todos os equipamentos ativos possuem calendário vinculado.</p>'}`;
    target.querySelector('.gm-ops-settings').prepend(missingPanel);
    missingPanel.querySelector('[data-calendar-search]')?.addEventListener('input',event=>{
      const query=key(event.target.value);
      missingPanel.querySelectorAll('[data-calendar-asset]').forEach(row=>{const asset=missing[Number(row.dataset.calendarAsset)];row.hidden=!key(`${asset.code} ${asset.name}`).includes(query);});
    });
    const saveForm = (form, makeChange, done) => {
      let busy = false;
      form.addEventListener('submit', async event => {
        event.preventDefault(); if(busy)return;
        const message=form.querySelector('[role=alert]'), buttons=[...form.querySelectorAll('button')];
        message.textContent='';
        try {
          const change=makeChange(); busy=true;form.classList.add('is-loading');buttons.forEach(button=>button.disabled=true);
          if(!await env.save(change)) {message.textContent='Salvamento não confirmado. Seus campos continuam nesta tela; tente novamente.';return;}
          done();
        } catch(error) {message.textContent=error.message||'Não foi possível salvar.';}
        finally{busy=false;form.classList.remove('is-loading');buttons.forEach(button=>button.disabled=false);}
      });
    };
    const openCalendar = (old, assetId = '') => {
      if(!env.canManage)return;
      if(old && !editableCalendar(old)) return;
      const id=old?.id||env.id();
      env.open(old?'Editar calendário operacional':'Novo calendário operacional', `<form class="form" id="gmOperationalCalendarForm"><label class="full">Nome<input class="field" name="name" required maxlength="100" value="${esc(old?.name)}"></label><label class="full">Equipamento<select class="field" name="assetId" required><option value="">Selecione</option>${env.assets.map(asset=>`<option value="${esc(asset.id)}" ${old?.assetId===asset.id?'selected':''}>${esc(asset.code)} · ${esc(asset.name)}</option>`).join('')}</select></label><fieldset class="full"><legend>Dias de operação</legend>${days.map((day,i)=>`<label class="gm-ops-day"><input type="checkbox" name="weekday" value="${i}" ${old?.weekdays?.includes(i)?'checked':''}>${day}</label>`).join('')}</fieldset><label>Início (UTC)<input class="field" name="startTime" type="time" required value="${esc(old?.startTime)}"></label><label>Término (UTC)<input class="field" name="endTime" type="time" required value="${esc(old?.endTime)}"></label><label>Pausa total (minutos)<input class="field" name="breakMinutes" type="number" min="0" step="1" value="${Number(old?.breakMinutes)||0}"></label><label>Status<select class="field" name="status"><option>Ativo</option><option ${old?.status==='Inativo'?'selected':''}>Inativo</option></select></label><p class="full">O cálculo atual utiliza UTC e turnos dentro do mesmo dia. Exemplo: 08:00 em UTC−3 corresponde a 11:00 UTC. A pausa é descontada do fim do turno. Confira a jornada antes de salvar.</p><p class="full" role="alert"></p><button class="btn primary" type="submit">Salvar calendário</button></form>`);
      const form=document.getElementById('gmOperationalCalendarForm');
      if (!old && assetId) {
        const asset = env.assets.find(item => item.id === assetId);
        if (asset) { form.elements.assetId.value = asset.id; form.elements.name.value = `Jornada · ${asset.code || asset.name}`.slice(0,100); }
      }
      saveForm(form,()=>{const values=Object.fromEntries(new FormData(form));values.weekdays=new FormData(form).getAll('weekday');return {calendar:{...old,...calendar(values,env.assets),id}};},()=>{env.close();env.refresh();});
    };
    target.querySelector('[data-new-calendar]')?.addEventListener('click',()=>openCalendar(null));
    missingPanel.querySelectorAll('[data-configure-calendar]').forEach(button=>button.addEventListener('click',()=>openCalendar(null,missing[Number(button.dataset.configureCalendar)].id)));
    target.querySelectorAll('[data-edit-calendar]').forEach(button=>button.addEventListener('click',()=>openCalendar(calendars[Number(button.dataset.editCalendar)])));
    target.querySelectorAll('[data-edit-calendar]').forEach(button=>{
      if(!editableCalendar(calendars[Number(button.dataset.editCalendar)])) {
        button.disabled=true;button.textContent='Cadastro legado · somente leitura';
        button.title='Este calendário usa outro formato ou abrangência; seus dados foram preservados.';
      }
    });
    target.querySelector('[data-policy]')?.addEventListener('click',()=>{
      if(!env.canManage)return;
      env.open('Prazos por prioridade', `<form class="form" id="gmOperationalPolicyForm"><p class="full">Horas corridas desde a abertura até o prazo de conclusão. Aplicado somente a novas O.S.; um prazo manual prevalece. Deixe vazio para não definir SLA.</p>${priorities.map(label=>`<label>${label} (horas)<input class="field" name="${key(label)}" inputmode="decimal" value="${esc(env.settings?.slaHours?.[key(label)]??'')}"></label>`).join('')}<p class="full" role="alert"></p><button class="btn primary" type="submit">Salvar prazos</button></form>`);
      const form=document.getElementById('gmOperationalPolicyForm');
      saveForm(form,()=>({policy:policy(Object.fromEntries(new FormData(form)))}),()=>{env.close();env.refresh();});
    });
    return { openCalendarForAsset: assetId => openCalendar(null,assetId) };
  }
  root.GMOperationalPlanning = { policy, deadline, calendar, editableCalendar, uncoveredAssets, summary, renderSummary, render };
})(typeof window === 'undefined' ? globalThis : window);
