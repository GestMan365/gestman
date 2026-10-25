import { expect, test, type Page } from '@playwright/test';

async function prepare(page: Page, mode = 'ready') {
  await page.clock.setFixedTime(new Date('2026-06-30T12:00:00Z'));
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto('./');
  await page.evaluate((mode) => {
    window.eval(`
      currentAccount = {company:{id:'qa-charts',remoteSync:false},user:{id:'qa',role:'admin',accessProfile:'admin',name:'QA'}};
      state = normalizeState(emptyState());
      state.assets = [{id:'qa-asset',plant:'Planta real de QA'},{id:'qa-region-asset',regionId:'r'}];
      state.regions = [{id:'r',name:'Região QA'}];
      gmStateDirty = false; gmSyncConflict = false; gmRemoteStateVersion = 1;
      gmInvalidateMaintenanceMetrics();
      stage16Filters.asset = 'filter-from-another-screen';
      gmScheduleMaintenanceMetricsRender = () => renderTrendChart();
      window.qaMetricRequests = [];
      window.qaChartMode = ${JSON.stringify(mode)};
      gmAuthenticatedFunction = async (name, body) => {
        if (name !== 'maintenance-metrics') throw new Error('Unexpected service');
        window.qaMetricRequests.push(body.filters);
        if (window.qaChartMode === 'loading') return new Promise(() => {});
        if (window.qaChartMode === 'error') throw new Error('QA controlled failure');
        const count = body.filters.seriesBuckets || 6;
        const keys = ['mttr','mtbf','availability'];
        const series = Object.fromEntries(keys.map(key => [key, Array.from({length:count}, (_, i) => ({
          start:new Date(Date.UTC(2026,0,1+i*5)).toISOString(), end:new Date(Date.UTC(2026,0,5+i*5)).toISOString(),
          label:'Intervalo '+(i+1), value:window.qaChartMode === 'single' ? (key === 'mttr' && i === count-1 ? 6.52 : null) : window.qaChartMode === 'empty' || i === 1 ? null : key === 'mttr' ? 1+i/2 : key === 'mtbf' ? 100+i*20 : 90+i/4,
          quality:window.qaChartMode === 'empty' || i === 1 ? 'insufficient' : i === 2 ? 'partial' : 'valid', recordCount:2,
          source:'Contrato QA', detail:'Registro controlado para validação local.'
        }))]));
        const assetBreakdown=body.filters.assetBreakdown?{total:2,truncated:false,items:['qa-asset','qa-region-asset'].filter(id=>!body.filters.asset || body.filters.asset===id).map((assetId,i)=>({assetId,metrics:Object.fromEntries(keys.map(key=>[key,{value:key==='mttr'?2.8+i*5:key==='mtbf'?170-i*100:96.4-i*10,quality:{state:'partial'},recordCount:2}]))}))}:undefined;
        return {tenant_state_version:1,contract:{version:1,period:{start:'2026-01-01T00:00:00Z',end:'2026-06-30T23:59:59Z'},updatedAt:'2026-06-30T23:00:00Z',series,assetBreakdown,
          metrics:Object.fromEntries(keys.map(key=>[key,{value:window.qaChartMode === 'single'?(key === 'mttr'?6.52:null):window.qaChartMode === 'empty'?null:key === 'mttr'?2.8:key === 'mtbf'?170:96.4,coverage:{basis:key==='mttr'?'repairs':'calendar',total:28,covered:3,missing:25,percentage:10.71},quality:{state:window.qaChartMode === 'single'?(key === 'mttr'?'valid':'insufficient'):window.qaChartMode === 'empty'?'insufficient':'partial'},detail:'Base controlada de QA.'}]))}};
      };
      document.body.classList.remove('auth-required','auth-loading','auth-restoring');
      document.body.classList.toggle('theme-light',false);
      applyDashboardLayout(); renderTrendChart();
    `);
  }, mode);
}

for (const viewport of [{width:1366,height:768},{width:951,height:535},{width:390,height:844}]) {
  for (const theme of ['dark','light']) {
    test(`gráficos oficiais legíveis ${viewport.width}x${viewport.height} ${theme}`, async ({page}, info) => {
      await page.setViewportSize(viewport);
      await prepare(page);
      await page.evaluate(theme => document.body.classList.toggle('theme-light',theme === 'light'),theme);
      const widget=page.locator('#trendChart');
      await expect(widget.locator('.gm-metric-card')).toHaveCount(3);
      await expect(widget).toBeVisible();
      await expect(widget.locator('[data-metric="mttr"] .gm-metric-value strong')).toHaveText('2,8 h');
      await expect(widget.locator('[data-metric="mtbf"] .gm-metric-value strong')).toHaveText('170 h');
      await expect(widget.locator('[data-metric="availability"] .gm-metric-value strong')).toHaveText('96,4 %');
      await expect(widget.locator('[data-metric="mttr"] .gm-metric-line')).toHaveCount(1);
      await expect(widget.locator('.gm-metric-reference')).toHaveCount(3);
      await expect(widget.locator('[data-metric="availability"] .gm-source-coverage')).toContainText('3 de 28');
      await expect(widget.locator('[data-metric="availability"] .gm-source-coverage progress')).toHaveAttribute('value','3');
      await expect(widget.locator('[data-metric="mttr"] .gm-metric-dot.is-partial')).toHaveCount(1);
      const point=widget.locator('[data-metric="mttr"] [data-point="0"]');
      await point.focus();
      await expect(widget.locator('[data-metric="mttr"] [data-point-detail]')).toContainText('01/01/2026 – 05/01/2026');
      await expect(widget.locator('[data-metric="mttr"] [data-point-detail]')).toContainText('1 h');
      const layout=await widget.evaluate(el=>({
        viewport:innerWidth,document:document.documentElement.scrollWidth,right:el.getBoundingClientRect().right,
        cards:[...el.querySelectorAll('.gm-metric-card')].map(card=>({width:card.getBoundingClientRect().width,right:card.getBoundingClientRect().right})),
      }));
      expect(layout.document).toBeLessThanOrEqual(layout.viewport+1);
      for(const card of layout.cards){expect(card.width).toBeGreaterThan(270);expect(card.right).toBeLessThanOrEqual(layout.viewport+1);}
      await widget.screenshot({path:info.outputPath(`charts-${theme}.png`)});
      if (viewport.width === 390) {
        const lastPoint = widget.locator('[data-metric="availability"] [data-point="5"]');
        await lastPoint.scrollIntoViewIfNeeded();
        await lastPoint.click();
        await expect(widget.locator('[data-metric="availability"] [data-point-detail]')).toContainText('91,25 %');
        await expect(page.locator('#maintenanceMetricDetails')).toBeVisible();
        await page.evaluate(()=>window.eval('closeModal()'));
        await page.screenshot({path:info.outputPath(`charts-mobile-last-${theme}.png`)});
      }
      const methodology = widget.getByText('Ver dados e metodologia',{exact:true});
      await methodology.focus();
      await methodology.press('Enter');
      await expect(widget.locator('.gm-metric-data')).toHaveAttribute('open', '');
      await expect(widget.locator('tbody tr')).toHaveCount(18);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    });
  }
}

test('resumos, comparação oficial e metas persistidas pelo fluxo administrativo no celular',async({page})=>{
  await page.setViewportSize({width:360,height:800});
  await prepare(page);
  expect(await page.locator('#trendPlantFilter').evaluate(el=>el.getBoundingClientRect().width)).toBeGreaterThan(240);
  await expect(page.locator('[data-metric="mttr"] .gm-metric-summary')).toContainText('Cada reparo corretivo');
  await expect(page.locator('[data-metric="mtbf"] .gm-metric-comparison')).toContainText('Anterior: 170 h');
  await expect(page.locator('[data-metric="availability"] .gm-metric-comparison')).toContainText('base parcial');
  await page.evaluate(()=>window.eval(`window.qaSaved=0; gmPersistState=async()=>{window.qaSaved++;gmStateDirty=false;return true;};`));
  await page.getByRole('button',{name:'Configurar metas',exact:true}).click();
  await page.getByLabel('MTTR máximo (horas)').fill('2,5');
  await page.getByLabel('MTBF mínimo (horas)').fill('200');
  await page.getByLabel('Disponibilidade mínima (%)').fill('101');
  await page.getByRole('button',{name:'Salvar metas',exact:true}).click();
  await expect(page.locator('#maintenanceTargetsError')).toContainText('entre 0 e 100');
  expect(await page.evaluate(()=>(window as any).qaSaved)).toBe(0);
  await page.getByLabel('Disponibilidade mínima (%)').fill('95');
  await page.getByRole('button',{name:'Salvar metas',exact:true}).click();
  await expect(page.locator('#maintenanceTargetsForm')).not.toBeVisible();
  await expect(page.locator('.gm-metric-goal strong')).toHaveCount(3);
  await expect(page.locator('[data-metric="mttr"] .gm-metric-goal')).toContainText('Fora da meta');
  await expect(page.locator('[data-metric="availability"] .gm-metric-goal')).toContainText('Dentro da meta');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.getByRole('button',{name:'Configurar metas',exact:true}).click();
  await expect(page.getByLabel('MTBF mínimo (horas)')).toHaveValue('200');
  await page.getByLabel('MTTR máximo (horas)').fill('');
  await page.getByRole('button',{name:'Salvar metas',exact:true}).click();
  await expect(page.locator('[data-metric="mttr"] .gm-metric-goal')).toHaveText('Meta não configurada');
  await page.evaluate(()=>window.eval(`currentAccount.user.role='technician';currentAccount.user.accessProfile='executante';renderTrendChart();`));
  await expect(page.getByRole('button',{name:'Configurar metas',exact:true})).toHaveCount(0);
});

test('metas por planta e equipamento herdam por indicador e acompanham os filtros no celular',async({page})=>{
  await page.setViewportSize({width:360,height:800});
  await prepare(page);
  await page.evaluate(()=>window.eval(`gmPersistState=async()=>{clearTimeout(gmRemoteSaveTimer);window.qaSavedPolicy=JSON.parse(JSON.stringify(state.operationalPolicy));gmStateDirty=false;return true;};`));
  const save = async(scope:string,id:string,values:string[])=>{
    await page.getByRole('button',{name:'Configurar metas',exact:true}).click();
    await page.getByLabel('Abrangência da meta').selectOption(scope);
    if(scope!=='company') await page.locator('#maintenanceTargetId').selectOption(id);
    for(const [index,label] of ['MTTR máximo (horas)','MTBF mínimo (horas)','Disponibilidade mínima (%)'].entries()) await page.getByLabel(label).fill(values[index]);
    await page.getByRole('button',{name:'Salvar metas',exact:true}).click();
    await expect(page.locator('#maintenanceTargetsForm')).not.toBeVisible();
    await expect(page.locator('.gm-metric-card')).toHaveCount(3);
  };
  await save('company','',['3','100','90']);
  await save('plant','Planta real de QA',['2','200','']);
  await save('asset','qa-asset',['1','','99']);
  await expect(page.locator('[data-metric="mttr"] .gm-metric-goal')).toContainText('3 h');
  await expect(page.locator('[data-metric="mttr"] .gm-metric-goal-source')).toHaveText('Meta geral da empresa');
  await page.locator('#trendPlantFilter').selectOption('Planta real de QA');
  await expect(page.locator('[data-metric="mttr"] .gm-metric-goal')).toContainText('2 h');
  await page.locator('#trendAssetFilter').selectOption('qa-asset');
  await expect(page.locator('[data-metric="mttr"] .gm-metric-goal')).toContainText('1 h');
  await expect(page.locator('[data-metric="mttr"] .gm-metric-goal-source')).toContainText('Equipamento: qa-asset');
  await expect(page.locator('[data-metric="mtbf"] .gm-metric-goal-source')).toHaveText('Planta: Planta real de QA');
  await expect(page.locator('[data-metric="availability"] .gm-metric-goal')).toContainText('99 %');
  const requests=await page.evaluate(()=>(window as any).qaMetricRequests);
  expect(requests.filter((request:any)=>request.asset==='qa-asset').length).toBeGreaterThanOrEqual(2);
  for(const request of requests.filter((request:any)=>request.asset==='qa-asset')) expect(request.plant).toBe('Planta real de QA');
  await page.locator('#trendPlantFilter').selectOption('Região QA');
  await expect(page.locator('#trendAssetFilter')).toHaveValue('');
  await expect(page.locator('[data-metric="mttr"] .gm-metric-goal-source')).toHaveText('Meta geral da empresa');
  await expect(page.locator('#trendAssetFilter option[value="qa-asset"]')).toHaveCount(0);
  await page.locator('#trendPlantFilter').selectOption('');
  await page.locator('#trendAssetFilter').selectOption('qa-asset');
  await expect(page.locator('[data-metric="mtbf"] .gm-metric-goal-source')).toHaveText('Planta: Planta real de QA');
  await save('asset','qa-asset',['','','']);
  await expect(page.locator('[data-metric="mttr"] .gm-metric-goal')).toContainText('2 h');
  await expect(page.locator('[data-metric="availability"] .gm-metric-goal-source')).toHaveText('Meta geral da empresa');
  const persisted=await page.evaluate(()=>(window as any).qaSavedPolicy);
  expect(persisted.metricTargetVersions.filter((v:any)=>!v.supersededBy)).toHaveLength(3);
  await prepare(page);
  await page.evaluate(policy=>window.eval(`state.operationalPolicy=${JSON.stringify(policy)};renderTrendChart();`),persisted);
  await page.locator('#trendPlantFilter').selectOption('Planta real de QA');
  await expect(page.locator('[data-metric="mtbf"] .gm-metric-goal')).toContainText('200 h');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

test('rascunhos de metas por destino são preservados e falha de gravação não anuncia sucesso',async({page})=>{
  await prepare(page);
  await page.evaluate(()=>window.eval(`gmPersistState=async()=>{clearTimeout(gmRemoteSaveTimer);return false;};`));
  await page.getByRole('button',{name:'Configurar metas',exact:true}).click();
  await page.getByLabel('MTTR máximo (horas)').fill('7');
  await page.getByLabel('Abrangência da meta').selectOption('asset');
  await page.getByRole('button',{name:'Salvar metas',exact:true}).click();
  await expect(page.locator('#maintenanceTargetsError')).toContainText('Selecione uma planta ou equipamento');
  await page.locator('#maintenanceTargetId').selectOption('qa-asset');
  await page.getByLabel('MTTR máximo (horas)').fill('8');
  await page.getByLabel('Abrangência da meta').selectOption('company');
  await expect(page.getByLabel('MTTR máximo (horas)')).toHaveValue('7');
  await page.getByLabel('Abrangência da meta').selectOption('asset');
  await expect(page.getByLabel('MTTR máximo (horas)')).toHaveValue('8');
  await page.getByRole('button',{name:'Salvar metas',exact:true}).click();
  await expect(page.locator('#maintenanceTargetsError')).toContainText('Salvamento não confirmado');
  await expect(page.locator('#maintenanceTargetsForm')).toBeVisible();
  await expect(page.getByLabel('MTTR máximo (horas)')).toHaveValue('8');
  await expect(page.getByRole('button',{name:'Salvar metas',exact:true})).toBeEnabled();
});

test('vigência futura no celular preserva legado, persiste autor e ativa/expira na data correta',async({page})=>{
  test.setTimeout(60000);
  await page.setViewportSize({width:360,height:800});
  await prepare(page);
  await page.evaluate(()=>window.eval(`
    state.operationalPolicy={metricTargets:{mttr:10,mtbf:100,availability:90},metricTargetOverrides:[{scope:'plant',id:'Planta real de QA',targets:{mttr:8}},{scope:'asset',id:'qa-asset',targets:{mttr:6}}]};
    gmPersistState=async()=>{clearTimeout(gmRemoteSaveTimer);window.qaSavedPolicy=JSON.parse(JSON.stringify(state.operationalPolicy));gmStateDirty=false;return true;};
    const qaOriginalMetrics=gmAuthenticatedFunction;
    gmAuthenticatedFunction=async(...args)=>{const result=await qaOriginalMetrics(...args);if(window.qaMetricEnd)result.contract.period.end=window.qaMetricEnd;return result;};
    renderTrendChart();
  `));
  await page.locator('#trendAssetFilter').selectOption('qa-asset');
  await expect(page.locator('[data-metric="mttr"] .gm-metric-goal')).toContainText('6 h');
  await page.getByRole('button',{name:'Configurar metas',exact:true}).click();
  await page.getByLabel('Início da vigência').fill('2026-07-01');
  await page.getByLabel('Fim da vigência (opcional)').fill('2026-07-05');
  await page.getByLabel('MTTR máximo (horas)').fill('4');
  await page.getByLabel('Disponibilidade mínima (%)').fill('99');
  await page.getByLabel('Motivo da alteração').fill('Nova meta homologada');
  await page.getByRole('button',{name:'Salvar metas',exact:true}).click();
  await expect(page.locator('#maintenanceTargetsForm')).not.toBeVisible();
  await expect(page.locator('[data-metric="mttr"] .gm-metric-goal')).toContainText('6 h');
  const saved=await page.evaluate(()=>(window as any).qaSavedPolicy);
  expect(saved.metricTargetVersions.at(-1).actor).toEqual({id:'qa',name:'QA'});
  expect(saved.metricTargetVersions.at(-1).reason).toBe('Nova meta homologada');
  await prepare(page);
  await page.evaluate(policy=>window.eval(`state.operationalPolicy=${JSON.stringify(policy)};renderTrendChart();`),saved);
  await page.locator('#trendAssetFilter').selectOption('qa-asset');
  await page.getByRole('button',{name:'Configurar metas',exact:true}).click();
  await page.getByText('Histórico de versões (2)',{exact:true}).click();
  await expect(page.locator('.gm-target-history')).toContainText('Programada');
  await expect(page.locator('.gm-target-history')).toContainText('Nova meta homologada');
  await expect(page.locator('.gm-target-history')).toContainText('QA');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.getByRole('button',{name:'Cancelar',exact:true}).click();
  for(const [day,expected] of [['2026-07-01','4 h'],['2026-07-05','4 h'],['2026-07-06','8 h']]){
    await page.clock.setFixedTime(new Date(day+'T15:00:00Z'));
    await page.evaluate(day=>window.eval(`
      const original=gmAuthenticatedFunction;gmAuthenticatedFunction=async(...args)=>{const result=await original(...args);result.contract.period.end=${JSON.stringify(day+'T23:59:59Z')};return result;};
      gmInvalidateMaintenanceMetrics();renderTrendChart();
    `),day);
    await expect(page.locator('[data-metric="mttr"] .gm-metric-goal')).toContainText(expected);
  }
  await expect(page.locator('[data-metric="mttr"] .gm-metric-goal-source')).toContainText('Planta:');
});

test('histórico mantém revisões, permite usar como base e bloqueia sobreposição no formulário',async({page})=>{
  await prepare(page);
  await page.evaluate(()=>window.eval(`gmPersistState=async()=>{clearTimeout(gmRemoteSaveTimer);gmStateDirty=false;return true;};`));
  const open=()=>page.getByRole('button',{name:'Configurar metas',exact:true}).click();
  await open();
  await page.getByLabel('Abrangência da meta').selectOption('plant');
  await page.getByLabel('Planta da meta').selectOption('Planta real de QA');
  await page.getByLabel('MTTR máximo (horas)').fill('4');
  await page.getByLabel('Motivo da alteração').fill('Primeira meta');
  await page.getByRole('button',{name:'Salvar metas',exact:true}).click();
  await page.locator('#trendPlantFilter').selectOption('Planta real de QA');
  await open();
  await page.getByLabel('MTTR máximo (horas)').fill('3');
  await page.getByLabel('Motivo da alteração').fill('Correção aprovada');
  await page.getByRole('button',{name:'Salvar metas',exact:true}).click();
  await open();
  await page.getByText('Histórico de versões (2)',{exact:true}).click();
  await expect(page.locator('.gm-target-history')).toContainText('Substituída por revisão');
  await expect(page.locator('.gm-target-history')).toContainText('Primeira meta');
  await expect(page.locator('.gm-target-history')).toContainText('Correção aprovada');
  await page.locator('.gm-target-history article').filter({hasText:'Primeira meta'}).getByRole('button',{name:'Usar como base'}).click();
  await expect(page.getByLabel('MTTR máximo (horas)')).toHaveValue('4');
  await page.getByLabel('Início da vigência').fill('2026-08-01');
  await page.getByRole('button',{name:'Salvar metas',exact:true}).click();
  await open();
  await page.getByLabel('Início da vigência').fill('2026-07-01');
  await page.getByRole('button',{name:'Salvar metas',exact:true}).click();
  await expect(page.locator('#maintenanceTargetsError')).toContainText('versão futura');
  await expect(page.getByLabel('Início da vigência')).toHaveValue('2026-07-01');
  await page.getByLabel('Fim da vigência (opcional)').fill('2026-07-31');
  await page.getByRole('button',{name:'Salvar metas',exact:true}).click();
  await expect(page.locator('#maintenanceTargetsForm')).not.toBeVisible();
});

for(const theme of ['light','dark']) test('preferência móvel '+theme+' persiste cada ranking ao recarregar e reabrir a página',async({page,context})=>{
  const width=theme==='light'?360:390;
  const setup=async (target:Page)=>{
    await target.setViewportSize({width,height:800});
    await prepare(target);
    await target.evaluate(theme=>window.eval(`
      document.body.classList.toggle('theme-light',${JSON.stringify(theme==='light')});
      state.operationalPolicy={metricTargets:{mttr:2,mtbf:200,availability:99}};renderTrendChart();
    `),theme);
  };
  const select=(target:Page,name:string)=>target.getByRole('combobox',{name:'Desvio no ranking de '+name,exact:true});
  await setup(page);
  await select(page,'MTTR').selectOption('percentage');
  await select(page,'MTBF').selectOption('absolute');
  await select(page,'Disponibilidade').selectOption('percentage');
  await page.reload();
  await setup(page);
  await expect(select(page,'MTTR')).toHaveValue('percentage');
  await expect(select(page,'MTBF')).toHaveValue('absolute');
  await expect(select(page,'Disponibilidade')).toHaveValue('percentage');
  await page.close();
  const reopened=await context.newPage();
  await setup(reopened);
  await expect(select(reopened,'MTTR')).toHaveValue('percentage');
  await expect(select(reopened,'MTBF')).toHaveValue('absolute');
  await expect(select(reopened,'Disponibilidade')).toHaveValue('percentage');
  await reopened.locator('[data-metric="mttr"] [data-ranked-asset="qa-asset"]').click();
  await expect(reopened.locator('#maintenanceMetricDetails')).toBeVisible();
  await reopened.evaluate(()=>window.eval('closeModal()'));
  await reopened.locator('#trendAssetFilter').selectOption('qa-asset');
  await expect(select(reopened,'MTTR')).toHaveValue('percentage');
  await expect(reopened.locator('[data-metric="mttr"] [data-ranked-asset]')).toHaveCount(1);
  expect(await reopened.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await reopened.locator('[data-metric="mttr"] .gm-metric-ranking').screenshot({path:`test-results/ranking-persist-${theme}.png`});
  await select(reopened,'MTTR').selectOption('absolute');
  await setup(reopened);
  await expect(select(reopened,'MTTR')).toHaveValue('absolute');
  await expect(select(reopened,'Disponibilidade')).toHaveValue('percentage');
});

for(const theme of ['light','dark']) test('ranking móvel '+theme+' ordena equipamentos, respeita metas e abre cálculo oficial',async({page})=>{
  await page.setViewportSize({width:360,height:800});
  await prepare(page);
  await page.evaluate(theme=>window.eval(`
    document.body.classList.toggle('theme-light',${JSON.stringify(theme==='light')});
    state.operationalPolicy={metricTargets:{mttr:2,mtbf:200,availability:99}};renderTrendChart();
  `),theme);
  const mttr=page.locator('[data-metric="mttr"] .gm-metric-ranking');
  await expect(mttr.locator('[data-ranked-asset]')).toHaveCount(2);
  await expect(mttr.locator('[data-ranked-asset]').first()).toHaveAttribute('data-ranked-asset','qa-region-asset');
  await expect(page.locator('[data-metric="availability"] .gm-metric-ranking')).toContainText('pontos percentuais');
  await expect(mttr).toContainText('Base parcial');
  const rowLayout=await mttr.locator('[data-ranked-asset]').first().evaluate(row=>({width:row.getBoundingClientRect().width,sourceWidth:row.querySelector('.gm-ranking-source')!.getBoundingClientRect().width}));
  expect(rowLayout.sourceWidth).toBeGreaterThan(rowLayout.width*.8);
  await page.evaluate(()=>window.eval("state.operationalPolicy.metricTargetOverrides=[{scope:'asset',id:'qa-asset',targets:{mttr:.5}}];renderTrendChart();"));
  const requestsBefore=await page.evaluate(()=>(window as any).qaMetricRequests.length);
  await mttr.locator('[data-ranking-mode]').selectOption('percentage');
  await expect(mttr.locator('[data-ranked-asset]').first()).toHaveAttribute('data-ranked-asset','qa-asset');
  await expect(mttr).toContainText('460 % da meta');
  await expect(mttr.locator('[data-ranking-mode]')).toBeFocused();
  expect(await page.evaluate(()=>(window as any).qaMetricRequests.length)).toBe(requestsBefore);
  for(const key of ['mtbf','availability']) {
    const panel=page.locator(`[data-metric="${key}"] .gm-metric-ranking`);
    await panel.locator('[data-ranking-mode]').selectOption('percentage');
    await expect(panel).toContainText('% da meta');
    await expect(panel).toContainText('Não é o percentual atingido');
  }
  await mttr.locator('[data-ranking-mode]').selectOption('absolute');
  await expect(mttr.locator('[data-ranked-asset]').first()).toHaveAttribute('data-ranked-asset','qa-region-asset');
  await mttr.locator('[data-ranking-mode]').selectOption('percentage');
  await page.evaluate(()=>window.eval('state.operationalPolicy.metricTargetOverrides[0].targets.mttr=0;renderTrendChart();'));
  await expect(mttr).toContainText('1 equipamento(s) fora da meta sem percentual calculável');
  await expect(mttr.locator('[data-ranked-asset]')).toHaveCount(1);
  await page.evaluate(()=>window.eval('state.operationalPolicy.metricTargetOverrides[0].targets.mttr=.5;renderTrendChart();'));
  await mttr.screenshot({path:`test-results/ranking-mobile-${theme}.png`});
  await mttr.locator('[data-ranked-asset="qa-asset"]').click();
  await expect(page.locator('#maintenanceMetricDetails')).toBeVisible();
  const request=await page.evaluate(()=>(window as any).qaMetricRequests.at(-1));
  expect(request.asset).toBe('qa-asset');expect(request.assetBreakdown).toBe(false);expect(request.seriesBuckets).toBeUndefined();
  await page.evaluate(()=>window.eval('closeModal()'));
  await page.locator('#trendAssetFilter').selectOption('qa-asset');
  await expect(mttr.locator('[data-ranked-asset]')).toHaveCount(1);
  await expect(mttr.locator('[data-ranking-mode]')).toHaveValue('percentage');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.evaluate(()=>window.eval('state.operationalPolicy={};renderTrendChart();'));
  await expect(mttr).toContainText('1 sem meta');
  await expect(mttr.locator('[data-ranked-asset]')).toHaveCount(0);
});

test('período 6/12/24 consulta contrato filtrado, sem filtros ocultos de outra tela', async ({page})=>{
  await prepare(page);
  for(const months of ['6','12','24']){
    await page.locator('#trendPeriodFilter').selectOption(months);
    await expect(page.locator('[data-metric="mttr"] .gm-metric-hit')).toHaveCount(Number(months)-1);
  }
  const requests=await page.evaluate(()=> (window as any).qaMetricRequests);
  expect(requests.some((request:any)=>request.seriesBuckets===24)).toBe(true);
  for(const request of requests.filter((request:any)=>request.seriesBuckets)){expect(request.asset).toBeUndefined();expect(request.plant).toBeUndefined();}
  await page.locator('#trendPlantFilter').selectOption('Planta real de QA');
  await expect.poll(()=>page.evaluate(()=> (window as any).qaMetricRequests.at(-1).plant)).toBe('Planta real de QA');
  await page.locator('#trendPlantFilter').selectOption('Região QA');
  await expect.poll(()=>page.evaluate(()=> (window as any).qaMetricRequests.at(-1).plant)).toBe('Região QA');
});

test('distingue carregamento e falha; permite nova tentativa sem fabricar dados',async({page})=>{
  await prepare(page,'loading');
  await expect(page.locator('#trendChart')).toContainText('Carregando indicadores');
  await expect(page.locator('#trendChart')).toHaveAttribute('aria-busy','true');
  await expect(page.locator('#professionalMttr')).toHaveText('Carregando...');
  await prepare(page,'error');
  await expect(page.locator('#trendChart')).toContainText('Não foi possível consultar');
  await expect(page.locator('.gm-metric-plot')).toHaveCount(0);
  await expect(page.locator('#professionalMttr')).toHaveText('Indisponível');
  await page.evaluate(()=>{(window as any).qaChartMode='ready';});
  await page.getByRole('button',{name:'Tentar novamente',exact:true}).click();
  await expect(page.locator('.gm-metric-card')).toHaveCount(3);
  await expect(page.locator('#professionalMttr')).toHaveText('2,8 h');
});

test('base insuficiente e estado não sincronizado não exibem números falsos',async({page})=>{
  await prepare(page,'empty');
  await expect(page.locator('.gm-metric-card')).toHaveCount(3);
  await expect(page.locator('.gm-metric-hit')).toHaveCount(0);
  await expect(page.locator('.gm-metric-reference')).toHaveCount(0);
  await expect(page.locator('.gm-metric-value strong')).toHaveText(['Sem dados','Sem dados','Sem dados']);
  await expect(page.locator('#professionalMttr')).toHaveText('Sem dados');
  await page.evaluate(()=>window.eval('gmStateDirty = true; renderTrendChart();'));
  await expect(page.locator('#trendChart')).toContainText('Aguardando sincronização');
  await expect(page.locator('#professionalMttr')).toHaveText('Aguardando sincronização');
  await expect(page.locator('.gm-metric-plot')).toHaveCount(0);
});

for (const viewport of [{width:1916,height:910},{width:390,height:844}]) {
  test(`um intervalo real exibe referência identificada sem histórico fictício ${viewport.width}`, async ({page}, info) => {
    await page.setViewportSize(viewport);
    await prepare(page, 'single');
    const card = page.locator('[data-metric="mttr"]');
    await expect(card.locator('.gm-metric-value strong')).toHaveText('6,52 h');
    await expect(card.locator('.gm-metric-plot')).not.toContainText(/\bP\d+\b/);
    await expect(card.locator('.gm-metric-plot')).toContainText('jan');
    await expect(card.locator('[data-point-detail]')).toContainText('Último intervalo com dados');
    await expect(card.locator('[data-point-detail]')).toContainText('6,52 h');
    await expect(page.locator('[data-metric="mtbf"] .gm-metric-plot')).toHaveCount(0);
    await expect(page.locator('[data-metric="mtbf"]')).toContainText('horímetros');
    await expect(page.locator('[data-metric="availability"]')).toContainText('calendário operacional');
    await expect(card.locator('.gm-metric-reference')).toHaveCount(1);
    await expect(card.locator('.gm-metric-hit')).toHaveCount(1);
    await expect(card.locator('.gm-metric-line')).toHaveCount(0);
    await expect(card.locator('.gm-metric-reference-label')).toContainText('média do período · 6,52 h');
    await expect(card).toContainText('Apenas um intervalo com dados');
    await expect(page.locator('[data-metric="mtbf"] .gm-metric-reference, [data-metric="availability"] .gm-metric-reference')).toHaveCount(0);
    const geometry = await card.locator('.gm-metric-reference').evaluate(el => ({ y:el.getAttribute('y1'), y2:el.getAttribute('y2'), dash:getComputedStyle(el).strokeDasharray }));
    expect(Number(geometry.y)).toBeGreaterThanOrEqual(32);
    expect(Number(geometry.y)).toBeLessThanOrEqual(174);
    expect(geometry.y).toBe(geometry.y2);
    expect(geometry.dash).not.toBe('none');
    await card.screenshot({path:info.outputPath('single-reference.png')});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  });
}

test('cards e gráficos compartilham contrato, filtros e precisão após atualização legada', async ({page}) => {
  await prepare(page, 'single');
  await expect(page.locator('#professionalMttr')).toHaveText('6,52 h');
  await page.evaluate(() => window.eval(`
    stage16Filters.asset = 'outro-ativo';
    stage16Filters.plant = 'outra-planta';
    stage16UpdateDashboardMetrics();
    renderProfessionalKpis();
  `));
  for (const [key, id] of [['mttr','professionalMttr'],['mtbf','professionalMtbf'],['availability','professionalAvailability']]) {
    await expect(page.locator('#'+id)).toHaveText(await page.locator('[data-metric="'+key+'"] .gm-metric-value strong').innerText());
  }
  for (const months of ['12','24','6']) {
    await page.locator('#trendPeriodFilter').selectOption(months);
    await expect(page.locator('#professionalMttr')).toHaveText('6,52 h');
  }
  await page.locator('#trendPlantFilter').selectOption('Planta real de QA');
  await expect(page.locator('#professionalMttr')).toHaveAttribute('title', /Planta real de QA/);
  await expect(page.locator('#professionalMttr')).toHaveText('6,52 h');
  const requests = await page.evaluate(() => (window as any).qaMetricRequests);
  expect(requests.filter((request:any) => request.asset || request.plant === 'outra-planta')).toEqual([]);
  expect(requests.every((request:any) => [6,12,24].includes(request.seriesBuckets))).toBe(true);
});

test('detalhes exibem fontes oficiais, distinguem intervalo e abrem O.S. filtradas', async ({page}) => {
  await prepare(page);
  await page.evaluate(()=>window.eval(`
    state.assets=[{id:'a',code:'A-001',name:'Bomba QA',status:'Operando'}];
    state.orders=[{id:'o1',number:'OS-001',assetId:'a',type:'Corretiva',status:'Concluída'},{id:'o2',number:'OS-002',assetId:'a',type:'Corretiva',status:'Concluída'}];
    state.measurements=[{id:'m1',assetId:'a',value:100,unit:'h'}];
    state.downtimes=[{id:'d1',assetId:'a',orderId:'o1',reason:'Parada QA',status:'Encerrada'}];
    const period={start:'2026-01-01T00:00:00Z',end:'2026-06-30T23:59:59Z'};
    const metric=(value,recordIds,formula)=>({value,recordIds,recordCount:recordIds.length,period,formula,detail:'Base oficial QA',source:'Contrato QA',updatedAt:'2026-06-30T23:00:00Z',quality:{state:'valid',reason:'Base válida QA',ignoredRecords:0}});
    const contract={period,updatedAt:'2026-06-30T23:00:00Z',metrics:{mttr:metric(2,['o1'],'duração total ÷ reparos'),mtbf:metric(100,['o1','m1'],'horas operacionais ÷ falhas'),availability:metric(95,['d1'],'tempo disponível ÷ tempo programado × 100')},series:{mttr:[{...period,start:'2026-01-01T00:00:00Z',end:'2026-01-31T23:59:59Z',value:4,recordIds:['o2'],recordCount:1,quality:'valid',detail:'Intervalo QA'}]}};
    GMMaintenanceCharts.render(document.getElementById('trendChart'),contract,{details:openMaintenanceMetricDetails});
  `));
  await page.locator('[data-metric="mttr"] [data-metric-details]').click();
  const modal=page.locator('#maintenanceMetricDetails');
  await expect(modal).toContainText('duração total ÷ reparos');
  await expect(modal).toContainText('OS-001');
  await expect(modal).not.toContainText('OS-002');
  await page.evaluate(()=>window.eval('closeModal()'));
  await page.locator('[data-metric="mttr"] [data-point="0"]').focus();
  await page.locator('[data-metric="mttr"] [data-point="0"]').press('Enter');
  await expect(modal).toContainText('4 h');
  await expect(modal).toContainText('OS-002');
  await expect(modal).not.toContainText('OS-001');
  await page.evaluate(()=>window.eval('closeModal()'));
  await page.locator('[data-metric="mtbf"] [data-metric-details]').click();
  await expect(modal).toContainText('Leitura');
  await expect(modal).toContainText('100 h');
  await page.evaluate(()=>window.eval('closeModal()'));
  await page.locator('[data-metric="availability"] [data-metric-details]').click();
  await expect(modal).toContainText('Parada QA');
  await expect(modal).toContainText('não são fonte direta');
  await expect(modal).toContainText('OS-001');
  await expect(modal).not.toContainText('OS-002');
  await page.screenshot({path:'test-results/metric-evidence-desktop.png'});
  await page.setViewportSize({width:390,height:844});
  expect(await modal.evaluate(el=>el.getBoundingClientRect().right<=innerWidth+1)).toBe(true);
  await page.screenshot({path:'test-results/metric-evidence-mobile.png'});
  await modal.locator('[data-evidence-orders]').click();
  expect(await page.evaluate(()=>window.eval('filteredOrdersForWorkspace().map(order=>order.id)'))).toEqual(['o1']);
});

test('minigráficos não desenham zeros ou linhas através de lacunas', async ({page}) => {
  await prepare(page);
  const result = await page.evaluate(() => window.eval(`(() => {
    const canvas = document.getElementById('professionalMttrSpark');
    const ctx = canvas.getContext('2d');
    drawDashboardSparkline('professionalMttrSpark', [null,null,null]);
    const empty = [...ctx.getImageData(0,0,canvas.width,canvas.height).data].every(value=>value===0);
    drawDashboardSparkline('professionalMttrSpark', [2,null,3]);
    const middle = [...ctx.getImageData(Math.floor(canvas.width/2)-1,0,2,canvas.height).data].every(value=>value===0);
    return {empty,middle};
  })()`));
  expect(result).toEqual({empty:true,middle:true});
});
