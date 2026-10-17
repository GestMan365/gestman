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

test('ações de execução permanecem no rodapé do formulário ao rolar', async ({ page }, testInfo) => {
  await page.evaluate(() => window.eval('showOrderDetails(state.orders[0].id)'));
  const dock=page.locator('#genericModalBox > .order-execution-dock');
  await expect(dock.locator('[data-order-primary-action="finish"]')).toBeVisible();
  await expect(page.locator('#orderDetailForm .order-execution-cta')).toHaveCount(0);
  const before=await dock.boundingBox();
  await page.locator('#genericBody').evaluate(element => { element.scrollTop=element.scrollHeight; });
  const after=await dock.boundingBox();
  expect(Math.abs((before?.y ?? 0)-(after?.y ?? 0))).toBeLessThan(2);
  expect(after!.y).toBeGreaterThan((await page.locator('#genericModalBox .modal-head').boundingBox())!.y);
  await page.screenshot({ path:testInfo.outputPath('order-detail-footer.png') });
});

test('ações mobile ficam acima dos módulos sem ocultar o final da O.S.', async ({ page }, testInfo) => {
  await page.setViewportSize({ width:390, height:844 });
  await page.evaluate(() => window.eval('renderOrderDetail(state.orders[0])'));
  const panel=page.locator('#orders .os-detail-panel.has-order');
  const cta=panel.locator('> .order-execution-cta');
  const nav=page.locator('#mobileBottomNav');
  await expect(panel.locator('.os-detail-actions .mobile-primary').first()).toBeHidden();
  const before=await cta.boundingBox();
  expect(before!.y).toBeGreaterThan(844);
  await cta.scrollIntoViewIfNeeded();
  await expect(cta).toBeVisible();
  const after=await cta.boundingBox();
  const navBox=await nav.boundingBox();
  expect(after!.y).toBeGreaterThanOrEqual(0);
  expect(after!.y+after!.height).toBeLessThanOrEqual(navBox!.y);
  await page.screenshot({ path:testInfo.outputPath('mobile-order-footer.png') });
});

test('rodapé do formulário mobile permanece visível ao trocar de aba', async ({ page }) => {
  await page.setViewportSize({ width:390, height:844 });
  await page.evaluate(() => window.eval('showOrderDetails(state.orders[0].id)'));
  const dock=page.locator('#genericModalBox > .order-execution-dock');
  await expect(dock.locator('[data-order-primary-action="finish"]')).toBeVisible();
  await page.locator('#orderDetailForm [data-detail-tab="Materiais"]').click();
  await expect(dock.locator('[data-order-primary-action="finish"]')).toBeVisible();
  const box=await dock.boundingBox();
  expect(box!.y+box!.height).toBeLessThanOrEqual(844);
});
