import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto('./');
});

for (const size of [{ width:390, height:844 }, { width:375, height:667 }, { width:590, height:1280 }]) {
  test(`login sem rolagem nem borda cortada em ${size.width}x${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.evaluate(() => {
      document.body.classList.remove('auth-loading','auth-restoring');
      document.body.classList.add('auth-required');
    });
    const card = page.locator('#authScreen .auth-card');
    await expect(card).toBeVisible();
    const layout = await card.evaluate(element => {
      const box = element.getBoundingClientRect();
      const screen = document.getElementById('authScreen')!;
      const link = document.querySelector('.auth-company-request-link')!;
      return {
        top:box.top,
        bottom:box.bottom,
        viewport:window.innerHeight,
        screenScroll:screen.scrollHeight-screen.clientHeight,
        cardScroll:element.scrollHeight-element.clientHeight,
        linkBottom:link.getBoundingClientRect().bottom,
      };
    });
    expect(layout.top).toBeGreaterThanOrEqual(0);
    expect(layout.bottom).toBeLessThanOrEqual(layout.viewport);
    expect(layout.screenScroll).toBeLessThanOrEqual(1);
    expect(layout.cardScroll).toBeLessThanOrEqual(1);
    expect(layout.linkBottom).toBeLessThanOrEqual(layout.bottom);
  });
}

test('mensagem de erro do login continua dentro da borda em tela compacta', async ({ page }) => {
  await page.setViewportSize({ width:375, height:667 });
  await page.evaluate(() => {
    document.body.classList.remove('auth-loading','auth-restoring');
    document.body.classList.add('auth-required');
    const status = document.getElementById('authLoginStatus')!;
    status.textContent = 'Usuário ou senha incorretos. Verifique os dados e tente novamente.';
    status.hidden = false;
  });
  const bounds = await page.locator('#authScreen .auth-card').evaluate(element => ({bottom:element.getBoundingClientRect().bottom,viewport:window.innerHeight,scroll:element.scrollHeight-element.clientHeight}));
  expect(bounds.bottom).toBeLessThanOrEqual(bounds.viewport);
  expect(bounds.scroll).toBeLessThanOrEqual(1);
});

test('navegação inferior desliza a cápsula ao trocar o atalho', async ({ page }) => {
  await page.setViewportSize({ width:390, height:844 });
  await page.evaluate(() => window.eval(`
    currentAccount={company:{id:'qa-mobile',name:'QA'},user:{id:'qa-user',name:'QA',role:'admin',accessProfile:'admin',active:true}};
    document.body.classList.remove('auth-required','auth-loading','auth-restoring');
    document.body.classList.add('theme-light');
    applyPermissionVisibility();
    updateMobileBottomNav('dashboard');
  `));
  const nav = page.locator('#mobileBottomNav');
  await expect(nav).toHaveClass(/indicator-ready/);
  const appearance = await nav.evaluate(element => ({background:getComputedStyle(element).backgroundColor,radius:getComputedStyle(element).borderTopLeftRadius}));
  expect(appearance.background).toBe('rgb(24, 24, 26)');
  expect(appearance.radius).toBe('999px');
  const first = await nav.evaluate(element => getComputedStyle(element).getPropertyValue('--mobile-indicator-x'));
  await page.evaluate(() => window.eval("updateMobileBottomNav('orders')"));
  await expect(nav.locator('[data-mobile-view="orders"]')).toHaveClass(/active/);
  const second = await nav.evaluate(element => getComputedStyle(element).getPropertyValue('--mobile-indicator-x'));
  expect(second).not.toBe(first);
  await expect(nav.locator('.mobile-nav-indicator')).toBeVisible();
});
