import { expect, test } from '@playwright/test';

test('barras abrem exatamente as ordens da prioridade, idade e equipamento e permitem limpar', async ({page}) => {
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto('./');
  const results = await page.evaluate(() => window.eval(`(() => {
    document.body.classList.remove('auth-required','auth-loading','auth-restoring');
    currentAccount={company:{id:'qa-drilldown',name:'QA',remoteSync:false},user:{id:'qa-admin',name:'QA',role:'admin',accessProfile:'admin',active:true}};
    state=normalizeState(emptyState());
    state.assets=[{id:'a',code:'A-001',name:'Bomba QA',status:'Operando'}];
    const now=Date.now(),day=86400000;
    state.orders=[
      {id:'recent',number:'OS-1',status:'Aberta',priority:'Alta',type:'Corretiva',assetId:'a',createdAt:now-day},
      {id:'old',number:'OS-2',status:'Em execução',priority:'Baixa',type:'Preventiva',assetId:'a',createdAt:now-10*day},
      {id:'done',number:'OS-3',status:'Concluída',priority:'Alta',type:'Corretiva',assetId:'a',createdAt:now-100*day},
      {id:'cancel',number:'OS-4',status:'Cancelada',priority:'Alta',type:'Corretiva',assetId:'a',createdAt:now-day},
      {id:'unknown',number:'OS-5',status:'Aberta',priority:'Alta',type:'Preventiva',assetId:'a'}
    ];
    render();
    const data=GMOperationalPlanning.summary(state.orders,state.assets,now),results=[];
    for(const label of ['Prioridade — Alta','Idade do backlog — Menos de 7 dias','Idade do backlog — 90 dias ou mais','Corretivas — Bomba QA']) {
      GMOperationalPlanning.renderSummary(document.getElementById('operationalInsights'),data,openOperationalOrderSelection);
      [...document.querySelectorAll('[data-ops-selection]')].find(button=>button.getAttribute('aria-label').includes(label)).click();
      results.push({label,ids:[...dashboardBacklogOrderIds].sort(),visible:filteredOrdersForWorkspace().map(order=>order.id).sort(),banner:document.getElementById('dashboardOrderSelection').textContent});
    }
    document.querySelector('#dashboardOrderSelection button').click();
    return {results,cleared:dashboardBacklogOrderIds===null&&!dashboardBacklogView};
  })()`));
  expect(results.results.map((r:any)=>r.ids)).toEqual([['recent','unknown'],['recent'],[],['done','recent']]);
  for(const item of results.results) {
    expect(item.visible).toEqual(item.ids);
    expect(item.banner).toContain(item.label);
  }
  expect(results.cleared).toBe(true);
});

// Presentation fixture only; no account, storage or remote records are modified.
async function preview(page: import('@playwright/test').Page) {
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto('./');
  const fixture = await page.evaluate(() => window.eval(`(() => {
    const data={active:62,overdue:31,noDeadline:9,unknownAge:0,age:[5,57,0,0],byPriority:[['Alta',12],['Média',10],['Crítica',11],['Urgente',11],['Baixa',18]],preventive:11,corrective:27,top:[{name:'H28 14',count:10},{name:'Motor Elétrico Linha 1',count:3},{name:'Balança Industrial',count:1}]};
    GMOperationalPlanning.renderSummary(document.getElementById('operationalInsights'),data,()=>{});
    collectDashboardAlerts=()=>[
      {id:'plan-1',type:'preventive',level:'critical',title:'Preventiva vencida',description:'Preventiva semanal do motor · GFG-QA-20261007-MOT-001 · Motor de Teste Empresarial',priority:'CRÍTICO',date:'2026-10-16T15:00:00Z'},
      {id:'order-1',type:'lateOrder',level:'critical',title:'O.S. atrasada',description:'O.S-0033 · Motor Elétrico Linha 1',priority:'CRÍTICO',date:'2026-10-15T15:00:00Z'},
      {id:'stock-1',type:'stock',level:'attention',title:'Estoque abaixo do mínimo',description:'Rolamento 6205 · Almoxarifado central',priority:'ATENÇÃO',date:'2026-10-14T15:00:00Z'}
    ];
    renderDashboardAlerts();
    GMIcons.decorate(document);
    return {css:[...document.styleSheets].map(sheet=>{try{return [...sheet.cssRules].map(rule=>rule.cssText).join('\\n')}catch{return ''}}).join('\\n'),html:['alerts','quickActions','operational'].map(key=>document.querySelector('[data-dashboard-widget="'+key+'"]').outerHTML).join('')};
  })()`));
  await page.route('**/__dashboard-preview', route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><head></head><body></body></html>'}));
  await page.goto('http://127.0.0.1:4173/__dashboard-preview');
  await page.setContent(`<html id="gm-premium"><head><base href="http://127.0.0.1:4173/nadirteste/"></head><body class="premium-shell"><main id="dashboard">${fixture.html}</main></body></html>`);
  await page.addStyleTag({ content: fixture.css });
  await page.addStyleTag({ content: '@layer premium {html#gm-premium body.premium-shell{display:block!important;padding:16px!important;margin:0!important} #dashboard{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:18px!important;width:100%!important;max-width:none!important;margin:0!important} #dashboard .dashboard-widget{display:block!important;min-width:0!important;grid-column:auto!important} #dashboard .dashboard-operational-summary{grid-column:1/-1!important} #dashboard .dashboard-controls{display:none!important} @media(max-width:700px){#dashboard{grid-template-columns:1fr!important}}}' });
}

for (const [width,light] of [[1440,true],[390,true],[1440,false]] as const) {
  test(`painéis operacionais legíveis em ${width}px / ${light?'claro':'escuro'}`, async ({ page }) => {
    await page.setViewportSize({width,height:1000});
    await preview(page);
    if(light) await page.locator('body').evaluate(el=>el.classList.add('theme-light'));
    await expect(page.locator('.dashboard-alert-item')).toHaveCount(3);
    await expect(page.locator('.gm-alert-overview')).toContainText('2 críticos');
    await expect(page.locator('.gm-alert-overview')).toContainText('1 atenção');
    await expect(page.locator('.industrial-quick-actions > button')).toHaveCount(6);
    await expect(page.locator('.industrial-quick-actions > button small').first()).toBeVisible();
    await expect(page.locator('.industrial-quick-actions .gm-icon')).toHaveCount(6);
    expect(await page.locator('.dashboard-alert-icon .gm-icon').first().evaluate(el=>getComputedStyle(el).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
    await expect(page.locator('.gm-ops-kpis')).toContainText('62');
    await expect(page.locator('.gm-ops-columns > section')).toHaveCount(4);
    const layout = await page.evaluate(() => ({overflow:document.documentElement.scrollWidth>innerWidth,align:getComputedStyle(document.querySelector('.dashboard-alert-item')!).textAlign,colors:[...document.querySelectorAll('.gm-ops-columns section:nth-child(2) .gm-ops-bar-track i')].map(el=>getComputedStyle(el).backgroundColor)}));
    expect(layout.overflow).toBe(false);
    expect(layout.align).toBe('left');
    expect(new Set(layout.colors).size).toBe(5);
    await page.locator('.industrial-quick-actions > button').first().evaluate(el=>el.setAttribute('hidden',''));
    await expect(page.locator('.industrial-quick-actions > button').first()).toBeHidden();
    await page.locator('.industrial-quick-actions > button').first().evaluate(el=>el.removeAttribute('hidden'));
    // Existing actions are preserved, and alert buttons route their exact record IDs.
    await page.evaluate(()=>{(window as any).openDashboardAlertRecord=(type:string,id:string)=>{(window as any).selectedAlert={type,id}}});
    await page.locator('.dashboard-alert-item').first().click();
    expect(await page.evaluate(()=>(window as any).selectedAlert)).toEqual({type:'preventive',id:'plan-1'});
    await page.screenshot({path:`test-results/dashboard-operations-${width}-${light?'light':'dark'}.png`,fullPage:true});
  });
}
