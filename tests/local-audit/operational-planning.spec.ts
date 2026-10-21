import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto('./');
  await page.evaluate(() => window.eval(`
    document.body.classList.remove('auth-required','auth-loading','auth-restoring');
    currentAccount={company:{id:'qa-planning',name:'QA'},user:{id:'qa-admin',name:'QA',role:'admin',accessProfile:'admin',active:true}};
    state=normalizeState(emptyState());
    state.assets=[{id:'asset-1',code:'A-001',name:'Bomba QA',status:'Operando'}];
    state.operationalCalendars=[{id:'calendar-1',name:'Turno A',assetId:'asset-1',weekdays:[1,2,3,4,5],startTime:'08:00',endTime:'17:00',breakMinutes:60,status:'Ativo'}];
    state.operationalPolicy={slaHours:{alta:2}};
    render();
    setView('productiveCalendars',{persist:false,route:false});
  `));
});

test('exibe calendário operacional, SLA e preserva vínculo do equipamento', async ({ page }) => {
  await expect(page.locator('#operationalPlanning')).toContainText('Turno A');
  await expect(page.locator('#operationalPlanning')).toContainText('Bomba QA');
  await expect(page.locator('#operationalPlanning')).toContainText('Alta: 2 h');
  await expect(page.getByRole('button', { name: 'Novo calendário operacional' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Prazos por prioridade' })).toBeVisible();
});

test('cadastro inválido não é aceito pelo contrato de calendário', async ({ page }) => {
  const result = await page.evaluate(() => window.eval(`(() => {
    try {
      GMOperationalPlanning.calendar({name:'Turno inválido',assetId:'asset-1',weekdays:[1],startTime:'17:00',endTime:'08:00'},state.assets);
      return 'accepted';
    } catch (error) {
      return error.message;
    }
  })()`));
  expect(result).toContain('posterior');
});

test('equipamento sem calendário abre pré-selecionado e sai da lista depois de salvar',async({page})=>{
  await page.evaluate(()=>window.eval(`state.assets.push({id:'asset-2',code:'A-002',name:'Motor sem calendário',status:'Operando'});gmPersistState=async()=>true;renderOperationalPlanning();`));
  await page.locator('[data-calendar-search]').fill('A-002');
  await page.getByRole('button',{name:'Configurar calendário de A-002',exact:true}).click();
  const form=page.locator('#gmOperationalCalendarForm');
  await expect(form.locator('[name=assetId]')).toHaveValue('asset-2');
  await expect(form.locator('[name=name]')).toHaveValue('Jornada · A-002');
  await expect(form.locator('[name=startTime]')).toHaveValue('');
  await form.locator('[name=weekday][value="1"]').check();
  await form.locator('[name=startTime]').fill('11:00');
  await form.locator('[name=endTime]').fill('20:00');
  await form.getByRole('button',{name:'Salvar calendário',exact:true}).click();
  await expect(page.getByRole('button',{name:'Configurar calendário de A-002',exact:true})).toHaveCount(0);
  expect(await page.evaluate(()=>window.eval(`state.operationalCalendars.some(item=>item.assetId==='asset-2'&&item.startTime==='11:00')`))).toBe(true);
});

test('atalho nos detalhes de disponibilidade abre o calendário do equipamento correto',async({page})=>{
  await page.evaluate(()=>window.eval(`
    state.assets.push({id:'asset-2',code:'A-002',name:'Motor sem calendário',status:'Operando'});
    gmStateDirty=false;gmSyncConflict=false;
    openMaintenanceMetricDetails({key:'availability',name:'Disponibilidade',unit:'%',metric:{value:100,quality:{state:'partial'},recordIds:[],calculation:{contributions:[{kind:'downtimes',recordIds:[],assetId:'asset-2',reasonCode:'missing_calendar',label:'Parada',amount:0,unit:'h',effect:'Sem calendário'}]}}});
  `));
  await page.getByRole('button',{name:/Configurar calendário · A-002/}).click();
  await expect(page.locator('#gmOperationalCalendarForm [name=assetId]')).toHaveValue('asset-2');
  await expect(page.locator('#gmOperationalCalendarForm [name=startTime]')).toHaveValue('');
});

test('aplica jornada existente a dois equipamentos selecionados em uma única gravação',async({page})=>{
  await page.evaluate(()=>window.eval(`
    state.assets.push({id:'asset-2',code:'MOT-A',name:'Motor A',status:'Operando'},{id:'asset-3',code:'MOT-B',name:'Motor B',status:'Operando'},{id:'asset-4',code:'PUMP-C',name:'Bomba C',status:'Operando'});
    window.qaCalendarWrites=0;gmRemoteStateVersion=1;gmRemoteSavePromise=Promise.resolve();gmSyncConflict=null;
    gmRpc=async(name)=>{if(name!=='gm_save_tenant_state')return [];window.qaCalendarWrites++;return [{version:gmRemoteStateVersion+1,updated_at:new Date().toISOString()}];};renderOperationalPlanning();
  `));
  await page.getByRole('button',{name:'Aplicar calendário em vários equipamentos',exact:true}).click();
  const form=page.locator('#gmOperationalCalendarForm');
  await form.getByRole('button',{name:'Continuar',exact:true}).click();
  await expect(form.getByRole('alert')).toContainText('nome');
  await form.locator('[data-calendar-template]').selectOption('0');
  await expect(form.locator('.gm-calendar-preview')).toContainText('8 h 0 min');
  await form.getByRole('button',{name:'Continuar',exact:true}).click();
  await expect(form.getByRole('button',{name:'Continuar',exact:true})).toBeDisabled();
  await form.locator('[data-bulk-search]').fill('MOT');
  await form.getByRole('button',{name:'Selecionar todos os resultados'}).click();
  await expect(form.locator('[data-bulk-count]')).toHaveText('2 selecionado(s)');
  await form.getByRole('button',{name:'Limpar seleção'}).click();
  await expect(form.locator('[data-bulk-count]')).toHaveText('0 selecionado(s)');
  await form.getByRole('button',{name:'Selecionar todos os resultados'}).click();
  await form.getByRole('button',{name:'Continuar',exact:true}).click();
  await expect(form.locator('.gm-calendar-review')).toContainText('2 equipamentos receberão');
  await form.getByRole('button',{name:'Voltar',exact:true}).click();
  await expect(form.locator('[name=bulkAssetId]:checked')).toHaveCount(2);
  await form.getByRole('button',{name:'Continuar',exact:true}).click();
  await form.getByRole('button',{name:'Aplicar em 2 equipamentos',exact:true}).click();
  await expect(form).not.toBeVisible();
  const result=await page.evaluate(()=>window.eval(`({writes:window.qaCalendarWrites,calendars:state.operationalCalendars.map(item=>({id:item.id,assetId:item.assetId,start:item.startTime,end:item.endTime}))})`));
  expect(result.writes).toBe(1);
  expect(result.calendars).toHaveLength(3);
  expect(result.calendars.map(item=>item.assetId).sort()).toEqual(['asset-1','asset-2','asset-3']);
  expect(result.calendars.every(item=>item.start==='08:00'&&item.end==='17:00')).toBe(true);
  expect(new Set(result.calendars.map(item=>item.id)).size).toBe(3);
  await expect(page.getByRole('button',{name:'Configurar calendário de PUMP-C',exact:true})).toBeVisible();
});

test('lote inválido não altera parte dos calendários nem inicia gravação',async({page})=>{
  const result=await page.evaluate(()=>window.eval(`(async()=>{
    window.qaCalendarWrites=0;gmPersistState=async()=>{window.qaCalendarWrites++;return true;};
    const before=JSON.stringify(state.operationalCalendars);
    const valid={id:'new-1',name:'Turno',assetId:'asset-1',weekdays:[1],startTime:'08:00',endTime:'17:00'};
    const saved=await gmSaveOperationalPlanning({calendars:[valid,{...valid,id:'new-2',assetId:'unknown'}]});
    return {saved,writes:window.qaCalendarWrites,unchanged:before===JSON.stringify(state.operationalCalendars)};
  })()`));
  expect(result).toEqual({saved:false,writes:0,unchanged:true});
});

test('assistente responsivo mantém revisão e seleção no celular',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>window.eval(`state.assets.push({id:'asset-2',code:'MOT-A',name:'Motor da linha industrial',status:'Operando'});renderOperationalPlanning();`));
  await page.getByRole('button',{name:'Aplicar calendário em vários equipamentos',exact:true}).click();
  const form=page.locator('#gmOperationalCalendarForm');
  await form.locator('[data-calendar-template]').selectOption('0');
  await form.getByRole('button',{name:'Continuar',exact:true}).click();
  await form.locator('[name=bulkAssetId]').check();
  await form.getByRole('button',{name:'Continuar',exact:true}).click();
  await expect(form.locator('.gm-calendar-review')).toContainText('MOT-A');
  const bounds=await form.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(391);
  await page.screenshot({path:'test-results/calendar-mobile.png',fullPage:true});
  await page.setViewportSize({width:1440,height:1000});
  await page.screenshot({path:'test-results/calendar-desktop.png',fullPage:true});
});
