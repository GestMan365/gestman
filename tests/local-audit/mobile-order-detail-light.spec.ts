import { expect, test } from '@playwright/test';

test('detalhes da O.S. respeitam o tema claro e não ficam atrás da navegação inferior', async ({ page }, testInfo) => {
  await page.setViewportSize({ width:390, height:844 });
  await page.goto('./');
  await page.evaluate(() => window.eval(`
    currentAccount={company:{id:'qa-mobile',name:'QA'},user:{id:'qa-user',name:'QA',role:'admin',accessProfile:'admin',active:true}};
    document.body.classList.remove('auth-required','auth-loading','auth-restoring');
    document.body.classList.add('theme-light','premium-shell');
    createDemoDataSet();
    state.orders[0].status='Aberta';
    setView('orders');
    renderOrderDetail(state.orders[0]);
    applyPermissionVisibility();
  `));
  const panel = page.locator('#orders .os-detail-panel.has-order');
  await expect(panel).toBeVisible();
  await panel.locator('.os-detail-actions .mobile-qr').scrollIntoViewIfNeeded();
  await page.screenshot({ path:testInfo.outputPath('order-detail-light.png') });
  const appearance = await page.evaluate(() => {
    const panel = document.querySelector('#orders .os-detail-panel.has-order')!;
    const tabs = panel.querySelector('.os-detail-tabs')!;
    const actions = panel.querySelector('.os-detail-actions')!;
    const nav = document.querySelector('#mobileBottomNav')!;
    const rect = (element:Element) => element.getBoundingClientRect();
    return {
      panel:getComputedStyle(panel).backgroundColor,
      tabs:getComputedStyle(tabs).backgroundColor,
      actions:getComputedStyle(actions).backgroundColor,
      nav:getComputedStyle(nav).backgroundColor,
      navGap:window.innerHeight - rect(nav).bottom,
      actionGap:rect(nav).top - rect(actions).bottom,
    };
  });
  expect(appearance.panel).toBe('rgb(255, 255, 255)');
  expect(appearance.tabs).toBe('rgb(245, 248, 252)');
  expect(appearance.actions).toBe('rgb(255, 255, 255)');
  expect(appearance.nav).toBe('rgb(255, 255, 255)');
  expect(appearance.navGap).toBeLessThanOrEqual(4);
  expect(appearance.actionGap).toBeGreaterThanOrEqual(4);
});
