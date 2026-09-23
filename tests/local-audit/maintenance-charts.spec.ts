import { expect, test, type Page } from '@playwright/test';

async function prepare(page: Page, mode = 'ready') {
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
          label:'Intervalo '+(i+1), value:window.qaChartMode === 'empty' || i === 1 ? null : key === 'mttr' ? 1+i/2 : key === 'mtbf' ? 100+i*20 : 90+i/4,
          quality:window.qaChartMode === 'empty' || i === 1 ? 'insufficient' : i === 2 ? 'partial' : 'valid', recordCount:2,
          source:'Contrato QA', detail:'Registro controlado para validação local.'
        }))]));
        return {tenant_state_version:1,contract:{version:1,period:{start:'2026-01-01T00:00:00Z',end:'2026-06-30T23:59:59Z'},updatedAt:'2026-06-30T23:00:00Z',series,
          metrics:Object.fromEntries(keys.map(key=>[key,{value:window.qaChartMode === 'empty'?null:key === 'mttr'?2.8:key === 'mtbf'?170:96.4,quality:{state:window.qaChartMode === 'empty'?'insufficient':'partial'},detail:'Base controlada de QA.'}]))}};
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
      await expect(widget.locator('[data-metric="mttr"] .gm-metric-line')).toHaveCount(2);
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
        await page.screenshot({path:info.outputPath(`charts-mobile-last-${theme}.png`)});
      }
      await widget.getByText('Ver dados e metodologia',{exact:true}).click();
      await expect(widget.locator('tbody tr')).toHaveCount(18);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    });
  }
}

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
  await prepare(page,'error');
  await expect(page.locator('#trendChart')).toContainText('Não foi possível consultar');
  await expect(page.locator('.gm-metric-plot')).toHaveCount(0);
  await page.evaluate(()=>{(window as any).qaChartMode='ready';});
  await page.getByRole('button',{name:'Tentar novamente',exact:true}).click();
  await expect(page.locator('.gm-metric-card')).toHaveCount(3);
});

test('base insuficiente e estado não sincronizado não exibem números falsos',async({page})=>{
  await prepare(page,'empty');
  await expect(page.locator('.gm-metric-card')).toHaveCount(3);
  await expect(page.locator('.gm-metric-hit')).toHaveCount(0);
  await expect(page.locator('.gm-metric-value strong')).toHaveText(['Sem dados','Sem dados','Sem dados']);
  await page.evaluate(()=>window.eval('gmStateDirty = true; renderTrendChart();'));
  await expect(page.locator('#trendChart')).toContainText('Aguardando sincronização');
  await expect(page.locator('.gm-metric-plot')).toHaveCount(0);
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
