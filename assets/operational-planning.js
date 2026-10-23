(function (root) {
  'use strict';
  const priorities = ['Baixa', 'Média', 'Alta', 'Crítica', 'Urgente'];
  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const key = text => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const esc = text => String(text ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number = value => value === '' || value == null || typeof value === 'boolean' ? null : Number(String(value).replace(',', '.'));
  const stamp = value => value === '' || value == null ? NaN : new Date(value).getTime();
  const terminal = value => /^(concluid|finaliz|encerrad|cancelad)/.test(key(value));
  const zones = [['America/Sao_Paulo','Brasília / São Paulo'],['America/Manaus','Manaus'],['America/Rio_Branco','Rio Branco'],['America/Noronha','Fernando de Noronha'],['America/Cuiaba','Cuiabá'],['America/Campo_Grande','Campo Grande'],['UTC','UTC (calendários anteriores)']];
  const validDate = value => !value || /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value+'T00:00:00Z')) && new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
  function localDate(zone='UTC',now=new Date()) { const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(p=>[p.type,p.value]));return `${parts.year}-${parts.month}-${parts.day}`; }
  const zoneLabel = zone => zones.find(([value])=>value===(zone||'UTC'))?.[1] || zone;
  const validityLabel = item => `${item.validFrom?'De '+item.validFrom.split('-').reverse().join('/'):'Sem início definido'} · ${item.validTo?'até '+item.validTo.split('-').reverse().join('/'):'sem término'}`;
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
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw Error('O término deve ser posterior ao início, no mesmo dia do fuso escolhido.');
    if (!Number.isInteger(pause) || pause < 0 || pause >= end - start) throw Error('A pausa deve ser menor que a duração do turno.');
    const timezone=String(input.timezone||'UTC'),validFrom=String(input.validFrom||''),validTo=String(input.validTo||'');
    try { new Intl.DateTimeFormat('en-GB',{timeZone:timezone}).format(); } catch { throw Error('Selecione um fuso horário válido.'); }
    if(!validDate(validFrom)||!validDate(validTo)||(validFrom&&validTo&&validTo<validFrom))throw Error('Informe uma vigência válida: término igual ou posterior ao início.');
    return { name, assetId: input.assetId, weekdays, startTime:input.startTime, endTime:input.endTime, breakMinutes:pause, status:input.status === 'Inativo' ? 'Inativo' : 'Ativo',timezone,validFrom,validTo };
  }
  function editableCalendar(item) {
    return Boolean(item?.id && item.assetId && Array.isArray(item.weekdays) && item.startTime && item.endTime
      && !['locationId','sectorLocationId','operationalAreaId','regionId','default','appliesToAllAssets'].some(field => item[field]));
  }
  function validateCalendarSet(changed,existing) {
    const ids=new Set(changed.map(item=>item.id));
    const all=[...changed,...existing.filter(item=>!ids.has(item.id))];
    for(const item of changed) {
      if(item.status==='Inativo')continue;
      if(all.some(other=>other.id!==item.id&&other.assetId===item.assetId&&other.status!=='Inativo'
        &&(item.validFrom||'0000-01-01')<=(other.validTo||'9999-12-31')&&(other.validFrom||'0000-01-01')<=(item.validTo||'9999-12-31')))throw Error('Este equipamento já possui calendário nessa vigência. Use Nova vigência para preservar o histórico.');
    }
  }
  function calendarRevision(old,input,assets,existing,id) {
    const next={...calendar({...input,assetId:old.assetId},assets),id,previousCalendarId:old.id};
    if(!next.validFrom||(old.validFrom&&next.validFrom<=old.validFrom))throw Error('A nova vigência deve começar depois do início da versão anterior.');
    const previousEnd=new Date(Date.parse(next.validFrom+'T00:00:00Z')-86400000).toISOString().slice(0,10);
    const previous={...old,validTo:old.validTo&&old.validTo<previousEnd?old.validTo:previousEnd};
    validateCalendarSet([previous,next],existing);
    return [previous,next];
  }
  function calendarBatch(input, assetIds, assets, calendars, contextFor, idFor) {
    const ids = [...new Set(assetIds || [])];
    if (!ids.length) throw Error('Selecione pelo menos um equipamento.');
    const eligible = new Set(uncoveredAssets(assets,calendars,contextFor).map(asset=>asset.id));
    if (ids.some(id=>!eligible.has(id))) throw Error('A seleção contém equipamento indisponível ou que já possui calendário. Atualize a lista.');
    return ids.map(assetId=>({...calendar({...input,assetId},assets),id:idFor(assetId)}));
  }
  function uncoveredAssets(assets, calendars, contextFor = () => ({}), now=new Date()) {
    return assets.filter(asset => !key(asset.status).startsWith('inativ')).filter(asset => !calendars.some(item => {
      if (key(item.status).startsWith('inativ')) return false;
      let today;try{today=localDate(item.timezone||'UTC',now);}catch{return false;}
      if(!validDate(item.validFrom)||!validDate(item.validTo)||(item.validFrom&&today<item.validFrom)||(item.validTo&&today>item.validTo))return false;
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
  // Keeps all inputs mounted so moving between steps never discards a selection.
  function calendarWizard(form,selection,assets,missing) {
    form.classList.add('gm-calendar-wizard');form.noValidate=true;
    const submit=form.querySelector('[type=submit]'),message=form.querySelector('[role=alert]');
    const steps=document.createElement('ol');steps.className='gm-calendar-steps full';
    steps.innerHTML=['Escolher jornada','Selecionar equipamentos','Revisar e aplicar'].map((label,i)=>`<li><span>${i+1}</span>${label}</li>`).join('');
    const schedule=document.createElement('section');schedule.className='full gm-calendar-step';
    schedule.setAttribute('aria-label','Escolher jornada');
    [...form.children].filter(node=>node!==selection&&node!==message&&node!==submit).forEach(node=>schedule.append(node));
    const template=selection.querySelector('[data-calendar-template]').closest('label');schedule.prepend(template);
    const preview=document.createElement('div');preview.className='gm-calendar-preview full';preview.setAttribute('aria-live','polite');schedule.append(preview);
    const review=document.createElement('section');review.className='full gm-calendar-review';review.setAttribute('aria-label','Revisar aplicação');
    const footer=document.createElement('div');footer.className='full gm-calendar-footer';
    const back=document.createElement('button');back.type='button';back.className='btn';back.textContent='Voltar';
    const count=document.createElement('span');count.setAttribute('aria-live','polite');footer.append(count,back,submit);
    form.prepend(steps,schedule);form.append(selection,review,message,footer);
    let step=0;
    const selected=()=>[...selection.querySelectorAll('[name=bulkAssetId]:checked')].map(input=>input.value);
    const values=()=>{const data=new FormData(form);return {...Object.fromEntries(data),weekdays:data.getAll('weekday'),assetId:missing[0]?.id};};
    const scheduleSummary=()=>{
      const value=values(),labels=value.weekdays.map(day=>days[Number(day)]);
      const minutes=time=>{const [h,m]=String(time).split(':').map(Number);return h*60+m;};
      const duration=minutes(value.endTime)-minutes(value.startTime)-Number(value.breakMinutes||0);
      return `<strong>${esc(value.name||'Sua jornada operacional')}</strong><div class="gm-calendar-days">${days.map((day,i)=>`<span class="${value.weekdays.includes(String(i))?'active':''}">${day}</span>`).join('')}</div><p>${labels.length?esc(labels.join(' · ')):'Selecione os dias de operação'}</p><b>${esc(value.startTime||'--:--')} → ${esc(value.endTime||'--:--')} <small>${esc(zoneLabel(value.timezone))}</small></b><p>${Number.isFinite(duration)&&duration>0?`${Math.floor(duration/60)} h ${duration%60} min de operação por dia`:'Defina o horário da jornada'} · ${esc(value.breakMinutes||0)} min de pausa</p><p>${esc(validityLabel(value))}</p><small>Status: ${esc(value.status)}. A pausa é descontada do fim do turno.</small>`;
    };
    const update=()=>{
      const ids=selected();schedule.hidden=step!==0;selection.hidden=step!==1;review.hidden=step!==2;
      [...steps.children].forEach((node,i)=>{if(i===step)node.setAttribute('aria-current','step');else node.removeAttribute('aria-current');node.classList.toggle('complete',i<step);});
      preview.innerHTML=scheduleSummary();
      count.textContent=`${ids.length} equipamento(s) selecionado(s)`;
      submit.textContent=step===2?`Aplicar em ${ids.length} equipamento${ids.length===1?'':'s'}`:'Continuar';submit.disabled=step>0&&!ids.length;
      back.hidden=step===0;
      if(step===2)review.innerHTML=`<h3>Confira antes de aplicar</h3><div class="gm-calendar-preview">${scheduleSummary()}</div><h4>${ids.length} ${ids.length===1?'equipamento receberá':'equipamentos receberão'} esta jornada</h4><ul>${missing.filter(asset=>ids.includes(asset.id)).map(asset=>`<li><strong>${esc(asset.code)}</strong> · ${esc(asset.name)}</li>`).join('')}</ul><p>Os calendários existentes não serão alterados. Cada equipamento receberá uma cópia independente desta jornada. MTBF e disponibilidade serão recalculados após salvar.</p>`;
    };
    form.addEventListener('input',update);form.addEventListener('change',update);
    selection.querySelector('[data-bulk-all]').addEventListener('click',update);
    selection.querySelector('[data-bulk-none]').addEventListener('click',update);
    back.addEventListener('click',()=>{step=Math.max(0,step-1);message.textContent='';update();steps.scrollIntoView({block:'nearest'});});
    update();
    return {beforeSubmit(){
      if(step===0){if(form.elements.validFrom.required&&!form.elements.validFrom.value)throw Error('Informe a data inicial da vigência.');calendar(values(),assets);step=1;update();steps.scrollIntoView({block:'nearest'});return false;}
      if(!selected().length)throw Error('Selecione pelo menos um equipamento.');
      if(step===1){step=2;update();steps.scrollIntoView({block:'nearest'});return false;}
      return true;
    }};
  }
  function render(env) {
    const target = env.target;
    if (!target) return;
    const calendars = Array.isArray(env.calendars) ? env.calendars : [];
    const missing = uncoveredAssets(env.assets || [], calendars, env.assetContext);
    target.innerHTML = `<section class="panel gm-ops-settings"><div class="toolbar"><h2>Operação dos equipamentos</h2>${env.canManage?'<button class="btn primary" type="button" data-new-calendar>Novo calendário operacional</button><button class="btn" type="button" data-policy>Prazos por prioridade</button>':''}</div><p>Estes calendários alimentam MTBF e disponibilidade. Jornadas de usuários, acima, são um cadastro separado.</p><div class="table-wrap"><table><thead><tr><th>Calendário / equipamento</th><th>Dias</th><th>Jornada / vigência</th><th>Status</th><th>Ação</th></tr></thead><tbody>${calendars.map((item,index)=>`<tr><td><strong>${esc(item.name)}</strong><br>${esc(env.assets.find(asset=>asset.id===item.assetId)?.name||'Vínculo não disponível')}</td><td>${esc((item.weekdays||[]).map(day=>days[day]).join(', '))}</td><td>${esc(item.startTime)}–${esc(item.endTime)} · ${esc(zoneLabel(item.timezone))}<br>${Number(item.breakMinutes)||0} min de pausa<br><small>${esc(validityLabel(item))}</small></td><td>${esc(item.status||'Ativo')}</td><td>${env.canManage?`<button class="btn" type="button" data-edit-calendar="${index}">Editar</button> <button class="btn" type="button" data-revise-calendar="${index}">Nova vigência</button>`:'Somente leitura'}</td></tr>`).join('')||'<tr><td colspan="5">Nenhum calendário operacional cadastrado. Não há jornada presumida para calcular os indicadores.</td></tr>'}</tbody></table></div><p>Prazo padrão: ${priorities.map(p=>`${p}: ${env.settings?.slaHours?.[key(p)]>0?esc(env.settings.slaHours[key(p)])+' h':'não definido'}`).join(' · ')}</p></section>`;
    const missingPanel = document.createElement('section');
    missingPanel.className = 'gm-ops-missing';
    missingPanel.innerHTML = `<h3>Equipamentos sem calendário operacional <span>(${missing.length})</span></h3><p>Configure a jornada real para incluir as paradas na disponibilidade e no MTBF. Paradas históricas válidas também são consideradas, mesmo anteriores ao cadastro.</p>${missing.length?`<label>Buscar equipamento<input class="field" type="search" data-calendar-search placeholder="Código ou nome do equipamento"></label><div class="gm-ops-missing-list">${missing.map((asset,index)=>`<div class="gm-ops-missing-row" data-calendar-asset="${index}"><span><strong>${esc(asset.code || '')}</strong><br>${esc(asset.name || '')}</span>${env.canManage?`<button class="btn" type="button" data-configure-calendar="${index}" aria-label="Configurar calendário de ${esc(asset.code || asset.name)}">Configurar</button>`:'Solicite a configuração ao administrador'}</div>`).join('')}</div>`:'<p>Todos os equipamentos ativos possuem calendário vinculado.</p>'}`;
    const coverage=document.createElement('div');coverage.className='gm-calendar-coverage';
    const active=(env.assets||[]).filter(asset=>!key(asset.status).startsWith('inativ')).length;
    coverage.innerHTML=`<div><span>Equipamentos ativos</span><strong>${active}</strong></div><div><span>Com calendário</span><strong>${active-missing.length}</strong></div><div class="needs-attention"><span>Sem calendário</span><strong>${missing.length}</strong></div><p>Jornadas reais, indicadores confiáveis.<br><small>Configure os equipamentos pendentes individualmente ou em lote.</small></p>`;
    target.querySelector('.gm-ops-settings').prepend(missingPanel);
    target.querySelector('.gm-ops-settings').prepend(coverage);
    missingPanel.querySelector('[data-calendar-search]')?.addEventListener('input',event=>{
      const query=key(event.target.value);
      missingPanel.querySelectorAll('[data-calendar-asset]').forEach(row=>{const asset=missing[Number(row.dataset.calendarAsset)];row.hidden=!key(`${asset.code} ${asset.name}`).includes(query);});
    });
    const saveForm = (form, makeChange, done, beforeSubmit) => {
      let busy = false;
      form.addEventListener('submit', async event => {
        event.preventDefault(); if(busy)return;
        const message=form.querySelector('[role=alert]'), buttons=[...form.querySelectorAll('button')];
        message.textContent='';
        try {
          if(beforeSubmit && !beforeSubmit())return;
          const change=makeChange(); busy=true;form.classList.add('is-loading');buttons.forEach(button=>button.disabled=true);
          if(!await env.save(change)) {message.textContent='Salvamento não confirmado. Seus campos continuam nesta tela; tente novamente.';return;}
          done();
        } catch(error) {message.textContent=error.message||'Não foi possível salvar.';}
        finally{if(busy){busy=false;form.classList.remove('is-loading');buttons.forEach(button=>button.disabled=false);}}
      });
    };
    const openCalendar = (old, assetId = '', bulk = false, revision = false) => {
      if(!env.canManage)return;
      if(old && !editableCalendar(old)) return;
      const id=revision?env.id():old?.id||env.id();
      env.open(bulk?'Aplicar calendário em vários equipamentos':revision?'Nova vigência do calendário':old?'Editar calendário operacional':'Novo calendário operacional', `<form class="form" id="gmOperationalCalendarForm"><label class="full">Nome<input class="field" name="name" required maxlength="100" value="${esc(old?.name)}"></label><label class="full">Equipamento<select class="field" name="assetId" required><option value="">Selecione</option>${env.assets.map(asset=>`<option value="${esc(asset.id)}" ${old?.assetId===asset.id?'selected':''}>${esc(asset.code)} · ${esc(asset.name)}</option>`).join('')}</select></label><fieldset class="full"><legend>Dias de operação</legend>${days.map((day,i)=>`<label class="gm-ops-day"><input type="checkbox" name="weekday" value="${i}" ${old?.weekdays?.includes(i)?'checked':''}>${day}</label>`).join('')}</fieldset><label>Início (UTC)<input class="field" name="startTime" type="time" required value="${esc(old?.startTime)}"></label><label>Término (UTC)<input class="field" name="endTime" type="time" required value="${esc(old?.endTime)}"></label><label>Pausa total (minutos)<input class="field" name="breakMinutes" type="number" min="0" step="1" value="${Number(old?.breakMinutes)||0}"></label><label>Status<select class="field" name="status"><option>Ativo</option><option ${old?.status==='Inativo'?'selected':''}>Inativo</option></select></label><p class="full">O cálculo atual utiliza UTC e turnos dentro do mesmo dia. Exemplo: 08:00 em UTC−3 corresponde a 11:00 UTC. A pausa é descontada do fim do turno. Confira a jornada antes de salvar.</p><p class="full" role="alert"></p><button class="btn primary" type="submit">Salvar calendário</button></form>`);
      const form=document.getElementById('gmOperationalCalendarForm');
      const timezone=old?.timezone||(old?'UTC':'America/Sao_Paulo');
      const metadata=document.createElement('div');metadata.className='full gm-calendar-meta';
      const options=zones.some(([value])=>value===timezone)?zones:[...zones,[timezone,timezone]];
      metadata.innerHTML=`<label class="full">Fuso horário<select class="field" name="timezone">${options.map(([value,label])=>`<option value="${esc(value)}" ${value===timezone?'selected':''}>${esc(label)} · ${esc(value)}</option>`).join('')}</select></label><label>Válido a partir de<input class="field" type="date" name="validFrom" ${!old||revision?'required':''} value="${esc(revision||!old?localDate(timezone):old.validFrom||'')}"></label><label>Válido até (inclusive)<input class="field" type="date" name="validTo" value="${esc(revision?'':old?.validTo||'')}"></label>`;
      form.querySelector('fieldset').before(metadata);
      form.elements.startTime.closest('label').firstChild.textContent='Início (horário do fuso)';
      form.elements.endTime.closest('label').firstChild.textContent='Término (horário do fuso)';
      form.querySelector('p:not([role])').textContent='Informe os horários no fuso escolhido. A vigência inclui a data final; sem término significa prazo aberto. A pausa é descontada do fim do turno. Calendários anteriores sem fuso continuam em UTC.';
      if(old&&!revision){const warning=document.createElement('p');warning.className='full';warning.textContent='Editar esta versão altera os cálculos de sua vigência. Para mudar a jornada sem reescrever o passado, feche esta janela e use Nova vigência.';form.prepend(warning);}
      if(revision){form.querySelector('[type=submit]').textContent='Salvar nova vigência';form.elements.assetId.value=old.assetId;form.elements.assetId.disabled=true;}
      if(revision){form.elements.validFrom.value=new Date(Date.parse(localDate(timezone)+'T00:00:00Z')+86400000).toISOString().slice(0,10);form.querySelector('p:not([role])').textContent+=' Ao salvar, a versão anterior termina no dia precedente à nova vigência; os horários anteriores são preservados.';}
      const batchIds = new Map();
      let wizard;
      if (bulk) {
        form.elements.assetId.required=false;
        const single=form.elements.assetId.closest('label');single.hidden=true;single.classList.add('gm-ops-bulk-single');
        const selection=document.createElement('fieldset');selection.className='full gm-ops-bulk';
        const templates=calendars.filter(item=>editableCalendar(item)&&item.status!=='Inativo');
        selection.innerHTML=`<legend>Aplicar a vários equipamentos sem calendário</legend><label>Usar jornada existente (opcional)<select class="field" data-calendar-template><option value="">Informar uma nova jornada</option>${templates.map((item,index)=>`<option value="${index}">${esc(item.name)} · ${esc(item.startTime)}–${esc(item.endTime)}</option>`).join('')}</select></label><label>Buscar equipamentos<input class="field" type="search" data-bulk-search placeholder="Código ou nome"></label><div class="toolbar"><button class="btn" type="button" data-bulk-all>Selecionar todos os resultados</button><button class="btn" type="button" data-bulk-none>Limpar seleção</button><strong data-bulk-count aria-live="polite">0 selecionados</strong></div><div class="gm-ops-bulk-list">${missing.map((asset,index)=>`<label class="gm-ops-bulk-row" data-bulk-row="${index}"><input type="checkbox" name="bulkAssetId" value="${esc(asset.id)}"><span><strong>${esc(asset.code||'')}</strong> · ${esc(asset.name||'')}</span></label>`).join('')}</div><p>A jornada será aplicada aos equipamentos selecionados. Os calendários já vinculados ficam fora desta lista.</p>`;
        form.insertBefore(selection,form.querySelector('fieldset'));
        const submit=form.querySelector('[type=submit]');submit.textContent='Aplicar aos selecionados';
        const updateCount=()=>{const count=selection.querySelectorAll('[name=bulkAssetId]:checked').length;selection.querySelector('[data-bulk-count]').textContent=`${count} selecionado(s)`;submit.disabled=!count;};
        selection.addEventListener('change',updateCount);updateCount();
        selection.querySelector('[data-bulk-search]').addEventListener('input',event=>{const query=key(event.target.value);selection.querySelectorAll('[data-bulk-row]').forEach(row=>{const asset=missing[Number(row.dataset.bulkRow)];row.hidden=!key(`${asset.code} ${asset.name}`).includes(query);});});
        selection.querySelector('[data-bulk-all]').addEventListener('click',()=>{selection.querySelectorAll('[data-bulk-row]').forEach(row=>{if(!row.hidden)row.querySelector('input').checked=true;});updateCount();});
        selection.querySelector('[data-bulk-none]').addEventListener('click',()=>{selection.querySelectorAll('[name=bulkAssetId]').forEach(input=>input.checked=false);updateCount();});
        selection.querySelector('[data-calendar-template]').addEventListener('change',event=>{
          if(event.target.value==='')return;
          const template=templates[Number(event.target.value)];
          for(const name of ['name','startTime','endTime','breakMinutes','status','timezone'])form.elements[name].value=template[name]??(name==='breakMinutes'?0:name==='timezone'?'UTC':'Ativo');
          form.querySelectorAll('[name=weekday]').forEach(input=>input.checked=template.weekdays.map(Number).includes(Number(input.value)));
        });
        wizard=calendarWizard(form,selection,env.assets,missing);
      }
      if (!old && assetId) {
        const asset = env.assets.find(item => item.id === assetId);
        if (asset) { form.elements.assetId.value = asset.id; form.elements.name.value = `Jornada · ${asset.code || asset.name}`.slice(0,100); }
      }
      saveForm(form,()=>{const data=new FormData(form),values=Object.fromEntries(data);values.weekdays=data.getAll('weekday');
        if(revision)return {calendars:calendarRevision(old,values,env.assets,calendars,id),revision:true};
        if(bulk)return {calendars:calendarBatch(values,data.getAll('bulkAssetId'),env.assets,calendars,env.assetContext,assetId=>{if(!batchIds.has(assetId))batchIds.set(assetId,env.id());return batchIds.get(assetId);})};
        return {calendar:{...old,...calendar(values,env.assets),id}};
      },()=>{env.close();env.refresh();},()=>!wizard||wizard.beforeSubmit());
    };
    if(env.canManage&&missing.length){const batchButton=document.createElement('button');batchButton.type='button';batchButton.className='btn primary';batchButton.textContent='Aplicar calendário em vários equipamentos';missingPanel.querySelector('h3').after(batchButton);batchButton.addEventListener('click',()=>openCalendar(null,'',true));}
    target.querySelector('[data-new-calendar]')?.addEventListener('click',()=>openCalendar(null));
    missingPanel.querySelectorAll('[data-configure-calendar]').forEach(button=>button.addEventListener('click',()=>openCalendar(null,missing[Number(button.dataset.configureCalendar)].id)));
    target.querySelectorAll('[data-edit-calendar]').forEach(button=>button.addEventListener('click',()=>openCalendar(calendars[Number(button.dataset.editCalendar)])));
    target.querySelectorAll('[data-revise-calendar]').forEach(button=>{const item=calendars[Number(button.dataset.reviseCalendar)];button.disabled=!editableCalendar(item);button.addEventListener('click',()=>openCalendar(item,'',false,true));});
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
  root.GMOperationalPlanning = { policy, deadline, calendar, calendarBatch, calendarRevision, validateCalendarSet, editableCalendar, uncoveredAssets, summary, renderSummary, render };
})(typeof window === 'undefined' ? globalThis : window);
