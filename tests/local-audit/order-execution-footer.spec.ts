import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => window.eval(`
    currentAccount={company:{id:'qa-footer',name:'QA'},user:{id:'qa-user',name:'QA',role:'admin',accessProfile:'admin',active:true}};
    document.body.classList.remove('auth-required','auth-loading','auth-restoring');
    document.body.classList.add('theme-light','premium-shell');
    createDemoDataSet();
    state.orders[0].status='Em execução';
    state.orders[0].startedAt=Date.now()-60000;
    setView('orders');
    applyPermissionVisibility();
  `));
});

test('formulário mantém pausa e finalização no rodapé claro', async ({ page }, testInfo) => {
  await page.evaluate(() => window.eval('showOrderDetails(state.orders[0].id)'));
  const footer=page.locator('#orderDetailForm .order-detail-savebar');
  await expect(footer.getByRole('button', {name:'Cancelar'})).toBeVisible();
  await expect(footer.getByRole('button', {name:'Pausar'})).toBeVisible();
  await expect(footer.getByRole('button', {name:'Finalizar O.S.'})).toBeVisible();
  await expect(page.locator('#genericModalBox > .order-execution-dock')).toHaveCount(0);
  await footer.scrollIntoViewIfNeeded();
  await page.screenshot({ path:testInfo.outputPath('order-detail-footer.png') });
});

test('mobile usa apenas as ações da O.S., sem cartão duplicado ou QR Code', async ({ page }, testInfo) => {
  await page.setViewportSize({ width:390, height:844 });
  await page.evaluate(() => window.eval('renderOrderDetail(state.orders[0])'));
  const panel=page.locator('#orders .os-detail-panel.has-order');
  const actions=panel.locator('.os-detail-actions');
  await expect(panel.locator('> .order-execution-cta')).toHaveCount(0);
  await expect(actions.getByRole('button', {name:'Pausar'})).toBeVisible();
  await expect(actions.getByRole('button', {name:'Finalizar O.S.'})).toBeVisible();
  await expect(actions.getByRole('button', {name:'QR Code'})).toHaveCount(0);
  await actions.scrollIntoViewIfNeeded();
  await page.screenshot({ path:testInfo.outputPath('mobile-order-footer.png') });
});

test('ações do formulário mobile continuam acessíveis ao trocar de aba', async ({ page }) => {
  await page.setViewportSize({ width:390, height:844 });
  await page.evaluate(() => window.eval('showOrderDetails(state.orders[0].id)'));
  const footer=page.locator('#orderDetailForm .order-detail-savebar');
  await page.locator('#orderDetailForm [data-detail-tab="Materiais"]').click();
  await expect(footer.getByRole('button', {name:'Finalizar O.S.'})).toBeVisible();
  await expect(footer.getByRole('button', {name:'Pausar'})).toBeVisible();
});
