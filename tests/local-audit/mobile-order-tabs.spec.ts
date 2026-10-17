import { expect, test } from '@playwright/test';

test('mobile mostra todas as abas da O.S. e conclusão abre em adicionar informações', async ({ page }, testInfo) => {
  await page.setViewportSize({ width:390, height:844 });
  await page.goto('./');
  await page.evaluate(() => window.eval(`
    currentAccount={company:{id:'qa-mobile',name:'QA'},user:{id:'qa-user',name:'QA',role:'admin',accessProfile:'admin',active:true}};
    document.body.classList.remove('auth-required','auth-loading','auth-restoring');
    document.body.classList.add('theme-light','premium-shell');
    createDemoDataSet();
    state.orders[0].status='Em execução';
    state.orders[0].startedAt=Date.now()-60000;
    state.orders[0].requester='Solicitante original';
    setView('orders');
    renderOrderDetail(state.orders[0]);
    applyPermissionVisibility();
  `));
  const panel=page.locator('#orders .os-detail-panel.has-order');
  const tabs=panel.locator('.os-mobile-detail-tabs button');
  await expect(tabs).toHaveCount(14);
  await expect(tabs.first()).toBeVisible();
  await tabs.first().scrollIntoViewIfNeeded();
  await page.screenshot({ path:testInfo.outputPath('mobile-order-tabs.png') });
  await tabs.filter({hasText:'Materiais'}).click();
  await expect(page.locator('#genericModal.open #orderDetailForm [data-detail-tab="Materiais"]')).toHaveClass(/active/);
  await page.locator('#genericModal .close').click();
  await page.evaluate(() => window.eval('openSimpleFinishOrderModal(state.orders[0].id)'));
  await expect(page.locator('#finishInfoTab')).toHaveAttribute('aria-selected','true');
  await expect(page.locator('#simpleFinishSolution')).toBeVisible();
  await page.screenshot({ path:testInfo.outputPath('mobile-finish-info.png') });
  await page.locator('#finishRequestTab').click();
  await expect(page.locator('#finishRequestPanel')).toContainText('Solicitante original');
  await expect(page.locator('#simpleFinishSolution')).toBeHidden();
  await page.locator('#finishInfoTab').click();
  await expect(page.locator('#simpleFinishSolution')).toBeVisible();
});
