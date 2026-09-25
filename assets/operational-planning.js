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
  function summary(orders, assets, now = Date.now()) {
    const unique = [...new Map(orders.filter(order => order?.id).map(order => [order.id, order])).values()];
    const active = unique.filter(order => !terminal(order.status));
    const age = [0,0,0,0], byPriority = new Map(), byAsset = new Map();
    let overdue = 0, noDeadline = 0, unknownAge = 0, preventive = 0, corrective = 0;
    for (const order of active) {
      const opened = stamp(order.createdAt || order.openedAt);
      if (!Number.isFinite(opened) || opened > now) unknownAge++;
      else { const elapsed = (now - opened) / 86400000; age[elapsed < 7 ? 0 : elapsed < 30 ? 1 : elapsed < 90 ? 2 : 3]++; }
      const due = stamp(order.deadline || order.dueAt || order.scheduledAt);
      if (!Number.isFinite(due)) noDeadline++; else if (due < now) overdue++;
      const label = priorities.find(p => key(p) === key(order.priority)) || 'Sem prioridade';
      byPriority.set(label, (byPriority.get(label) || 0) + 1);
    }
    for (const order of unique) {
      if (key(order.status).startsWith('cancelad')) continue;
      const type = key(order.maintenanceType || order.type || order.maintenance);
      if (type === 'preventiva') preventive++;
      if (type === 'corretiva') {
        corrective++;
        if (order.assetId) byAsset.set(order.assetId, (byAsset.get(order.assetId) || 0) + 1);
      }
    }
    const top = [...byAsset].map(([id,count]) => ({ id, count, name:assets.find(asset => asset.id === id)?.name || 'Equipamento não disponível' })).sort((a,b) => b.count-a.count || a.name.localeCompare(b.name)).slice(0,5);
    return { total:unique.length, active:active.length, overdue, noDeadline, unknownAge, age, byPriority:[...byPriority], preventive, corrective, top };
  }
  function renderSummary(target, data) {
    if (!target) return;
    const bars = pairs => pairs.length ? pairs.map(([label,count]) => `<div class="gm-ops-bar"><span>${esc(label)}</span><meter min="0" max="${Math.max(1,...pairs.map(p=>p[1]))}" value="${count}" aria-label="${esc(label)}: ${count}"></meter><strong>${count}</strong></div>`).join('') : '<p>Sem registros no período.</p>';
    target.innerHTML = `<p>Histórico disponível da empresa, limitado ao seu perfil de acesso. Inclui pendências antigas; não é limitado pelo período dos gráficos de confiabilidade.</p><div class="gm-ops-kpis">${[[data.active,'O.S. pendentes'],[data.overdue,'Prazos vencidos'],[data.noDeadline,'Sem prazo válido']].map(([count,label])=>`<div><strong>${count}</strong><span>${label}</span></div>`).join('')}</div><div class="gm-ops-columns"><section><h3>Idade do backlog</h3>${bars(['Menos de 7 dias','7 a 29 dias','30 a 89 dias','90 dias ou mais'].map((name,i)=>[name,data.age[i]]))}${data.unknownAge?`<p>${data.unknownAge} registro(s) sem data válida de abertura.</p>`:''}</section><section><h3>Prioridades pendentes</h3>${bars(data.byPriority)}</section><section><h3>Preventiva × corretiva</h3>${bars([['Preventivas',data.preventive],['Corretivas',data.corrective]])}<p>Ordens registradas, incluindo concluídas e excluindo canceladas.</p></section><section><h3>Ativos com mais corretivas</h3>${bars(data.top.map(item=>[item.name,item.count]))}</section></div>`;
  }
  function render(env) {
    const target = env.target;
    if (!target) return;
    const calendars = Array.isArray(env.calendars) ? env.calendars : [];
    target.innerHTML = `<section class="panel gm-ops-settings"><div class="toolbar"><h2>Operação dos equipamentos</h2>${env.canManage?'<button class="btn primary" type="button" data-new-calendar>Novo calendário operacional</button><button class="btn" type="button" data-policy>Prazos por prioridade</button>':''}</div><p>Estes calendários alimentam MTBF e disponibilidade. Jornadas de usuários, acima, são um cadastro separado.</p><div class="table-wrap"><table><thead><tr><th>Calendário / equipamento</th><th>Dias</th><th>Horário UTC</th><th>Status</th><th>Ação</th></tr></thead><tbody>${calendars.map((item,index)=>`<tr><td><strong>${esc(item.name)}</strong><br>${esc(env.assets.find(asset=>asset.id===item.assetId)?.name||'Vínculo não disponível')}</td><td>${esc((item.weekdays||[]).map(day=>days[day]).join(', '))}</td><td>${esc(item.startTime)}–${esc(item.endTime)}<br>${Number(item.breakMinutes)||0} min de pausa</td><td>${esc(item.status||'Ativo')}</td><td>${env.canManage?`<button class="btn" type="button" data-edit-calendar="${index}">Editar</button>`:'Somente leitura'}</td></tr>`).join('')||'<tr><td colspan="5">Nenhum calendário operacional cadastrado. Não há jornada presumida para calcular os indicadores.</td></tr>'}</tbody></table></div><p>Prazo padrão: ${priorities.map(p=>`${p}: ${env.settings?.slaHours?.[key(p)]>0?esc(env.settings.slaHours[key(p)])+' h':'não definido'}`).join(' · ')}</p></section>`;
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
    const openCalendar = old => {
      if(!env.canManage)return;
      if(old && !editableCalendar(old)) return;
      const id=old?.id||env.id();
      env.open(old?'Editar calendário operacional':'Novo calendário operacional', `<form class="form" id="gmOperationalCalendarForm"><label class="full">Nome<input class="field" name="name" required maxlength="100" value="${esc(old?.name)}"></label><label class="full">Equipamento<select class="field" name="assetId" required><option value="">Selecione</option>${env.assets.map(asset=>`<option value="${esc(asset.id)}" ${old?.assetId===asset.id?'selected':''}>${esc(asset.code)} · ${esc(asset.name)}</option>`).join('')}</select></label><fieldset class="full"><legend>Dias de operação</legend>${days.map((day,i)=>`<label class="gm-ops-day"><input type="checkbox" name="weekday" value="${i}" ${old?.weekdays?.includes(i)?'checked':''}>${day}</label>`).join('')}</fieldset><label>Início (UTC)<input class="field" name="startTime" type="time" required value="${esc(old?.startTime)}"></label><label>Término (UTC)<input class="field" name="endTime" type="time" required value="${esc(old?.endTime)}"></label><label>Pausa total (minutos)<input class="field" name="breakMinutes" type="number" min="0" step="1" value="${Number(old?.breakMinutes)||0}"></label><label>Status<select class="field" name="status"><option>Ativo</option><option ${old?.status==='Inativo'?'selected':''}>Inativo</option></select></label><p class="full">O cálculo atual utiliza UTC e turnos dentro do mesmo dia. Exemplo: 08:00 em UTC−3 corresponde a 11:00 UTC. A pausa é descontada do fim do turno. Confira a jornada antes de salvar.</p><p class="full" role="alert"></p><button class="btn primary" type="submit">Salvar calendário</button></form>`);
      const form=document.getElementById('gmOperationalCalendarForm');
      saveForm(form,()=>{const values=Object.fromEntries(new FormData(form));values.weekdays=new FormData(form).getAll('weekday');return {calendar:{...old,...calendar(values,env.assets),id}};},()=>{env.close();env.refresh();});
    };
    target.querySelector('[data-new-calendar]')?.addEventListener('click',()=>openCalendar(null));
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
  }
  root.GMOperationalPlanning = { policy, deadline, calendar, editableCalendar, summary, renderSummary, render };
})(typeof window === 'undefined' ? globalThis : window);
