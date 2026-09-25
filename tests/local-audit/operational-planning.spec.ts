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
