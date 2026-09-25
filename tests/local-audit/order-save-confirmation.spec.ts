import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto('./');
  await page.evaluate(() => window.eval(`
    document.body.classList.remove('auth-required','auth-loading','auth-restoring');
    currentAccount={company:{id:'qa-save',name:'QA',remoteSync:true},user:{id:'qa-user',name:'QA',role:'admin',accessProfile:'admin',active:true}};
    state=normalizeState(emptyState());
    state.assets=[{id:'asset-qa',code:'QA-001',name:'Bomba QA',status:'Operando'}];
    gmOperationalUsers=[{userId:'qa-user',name:'QA',executor:true,active:true,accessProfile:'technician'}];
    gmOperationalUsersReady=true;
    window.qaSaves=[];window.qaMessages=[];window.qaSaveResult=false;window.qaStarts=0;
    saveState=()=>{};
    saveOrderSupabaseNow=async order=>{window.qaSaves.push(JSON.parse(JSON.stringify(order)));if(window.qaSaveResult==='throw')throw Error('QA timeout');return window.qaSaveResult;};
    saveOrderEventSupabase=async()=>true;
    startOrder=async()=>{window.qaStarts++};
    showToast=message=>window.qaMessages.push(message);
    setView('orders',{persist:false,route:false});
  `));
  await page.locator('#createOrderBtn').click();
  await expect(page.locator('#orderForm')).toBeVisible();
  await page.locator('#orderAsset').selectOption('asset-qa');
  await page.locator('#orderDescription').fill('QA: verificar confirmação antes de fechar');
  await page.locator('#orderResponsible').selectOption('user:qa-user');
});

for (const failure of [false, 'throw']) {
  test(`falha ${failure} preserva formulário e reutiliza ID sem falso sucesso`, async ({ page }) => {
    await page.evaluate(value => window.eval(`window.qaSaveResult=${JSON.stringify(value)}`), failure);
    await page.getByRole('button', { name: 'Salvar e Iniciar', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.eval('window.qaSaves.length'))).toBe(1);
    await expect(page.locator('#orderForm')).toBeVisible();
    await expect(page.locator('#orderDescription')).toHaveValue('QA: verificar confirmação antes de fechar');
    expect(await page.evaluate(() => window.eval('window.qaStarts'))).toBe(0);
    expect(await page.evaluate(() => window.eval('window.qaMessages.some(text=>/com sucesso/.test(text))'))).toBe(false);
    await page.evaluate(() => window.eval('window.qaSaveResult=true'));
    await page.getByRole('button', { name: 'Salvar O.S.', exact: true }).click();
    await expect(page.locator('#genericModal')).not.toHaveClass(/open/);
    const result = await page.evaluate(() => window.eval('({ids:window.qaSaves.map(item=>item.id),count:state.orders.length})'));
    expect(result.ids).toHaveLength(2);
    expect(new Set(result.ids).size).toBe(1);
    expect(result.count).toBe(1);
  });
}

test('salvamento lento bloqueia segunda submissão e preserva o modal durante refresh', async ({ page }) => {
  await page.evaluate(() => window.eval(`
    saveOrderSupabaseNow=async order=>{window.qaSaves.push(order);return new Promise(resolve=>window.qaResolveSave=resolve)};
  `));
  await page.getByRole('button', { name: 'Salvar O.S.', exact: true }).click();
  await expect(page.locator('#orderForm')).toHaveAttribute('aria-busy', 'true');
  await expect(page.getByRole('button', { name: 'Salvar e Iniciar', exact: true })).toBeDisabled();
  const blocked = await page.evaluate(() => window.eval(`
    window.qaLoadCalls=0;gmRpc=async()=>{window.qaLoadCalls++;return []};
    gmStateDirty=false;
    loadSupabaseState(false).then(()=>({blocked:gmBackgroundRefreshBlocked(),calls:window.qaLoadCalls}));
  `));
  expect(blocked).toEqual({ blocked: true, calls: 0 });
  await expect(page.locator('#orderDescription')).toHaveValue('QA: verificar confirmação antes de fechar');
  await page.evaluate(() => window.eval('window.qaResolveSave(true)'));
  await expect(page.locator('#genericModal')).not.toHaveClass(/open/);
});

test('SLA sugere prazo somente para nova O.S. sem sobrescrever prazo manual', async ({ page }) => {
  await page.evaluate(() => window.eval(`state.operationalPolicy={slaHours:{alta:2}}`));
  await page.locator('#orderPriority').selectOption('Alta');
  await expect(page.locator('#orderDeadline')).not.toHaveValue('');
  const suggested = await page.locator('#orderDeadline').inputValue();
  await page.locator('#orderDeadline').fill('2030-01-01T12:00');
  await page.locator('#orderPriority').selectOption('Baixa');
  await expect(page.locator('#orderDeadline')).toHaveValue('2030-01-01T12:00');
  expect(suggested).not.toBe('2030-01-01T12:00');
});

test('atualização atrasada dos indicadores não redesenha formulário em edição', async ({ page }) => {
  await page.evaluate(() => window.eval(`
    document.querySelector('.view.active').classList.remove('active');$('dashboard').classList.add('active');
    window.qaRenders=0;render=()=>window.qaRenders++;gmScheduleMaintenanceMetricsRender();
  `));
  await page.waitForTimeout(160);
  expect(await page.evaluate(() => window.eval('window.qaRenders'))).toBe(0);
  await expect(page.locator('#orderDescription')).toHaveValue('QA: verificar confirmação antes de fechar');
});
