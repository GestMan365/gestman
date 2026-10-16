import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto('./');
  await page.evaluate(() => window.eval(`
    currentAccount={company:{id:'qa-access',name:'QA'},user:{id:'qa-admin',name:'Admin QA',role:'admin',accessProfile:'admin',active:true}};
    document.body.classList.remove('auth-required','auth-loading','auth-restoring');
    document.body.classList.add('theme-light','gm-top-navigation');
    applyPermissionVisibility();
  `));
});

test('mobile exibe todos os módulos permitidos e oculta os proibidos', async ({ page }) => {
  await page.setViewportSize({ width:390, height:844 });
  await page.evaluate(() => window.eval('openMobileNavigation()'));
  const admin = await page.evaluate(() => window.eval(`Array.from(document.querySelectorAll('#mainNavigation .tab[data-view]')).map(button=>({view:button.dataset.view,visible:getComputedStyle(button).display!=='none'&&getComputedStyle(button.closest('.nav-group')||button).display!=='none',allowed:canAccessView(button.dataset.view)}))`));
  expect(admin.every(item => item.visible === item.allowed)).toBe(true);
  expect(admin.find(item => item.view === 'maintenanceIndicators')?.visible).toBe(true);
  expect(admin.find(item => item.view === 'map')?.visible).toBe(true);
  expect(admin.find(item => item.view === 'spares')?.visible).toBe(true);

  const restricted = await page.evaluate(() => window.eval(`
    currentAccount.user={id:'qa-viewer',name:'Consulta QA',role:'viewer',accessProfile:'viewer',active:true};
    applyPermissionVisibility();
    Array.from(document.querySelectorAll('#mainNavigation .tab[data-view]')).map(button=>({view:button.dataset.view,visible:getComputedStyle(button).display!=='none'&&getComputedStyle(button.closest('.nav-group')||button).display!=='none',allowed:canAccessView(button.dataset.view)}))
  `));
  expect(restricted.every(item => item.visible === item.allowed)).toBe(true);
  await expect(page.locator('#mainNavigation [data-admin-only]')).toBeHidden();
  const shortcuts = await page.evaluate(() => window.eval(`Array.from(document.querySelectorAll('#mobileBottomNav [data-mobile-view]')).map(button=>({visible:getComputedStyle(button).display!=='none',allowed:canAccessView(button.dataset.mobileView)}))`));
  expect(shortcuts.every(item => item.visible === item.allowed)).toBe(true);
});

test('seta acima de Acessos Rápidos amplia o menu e mostra nomes', async ({ page }) => {
  await page.setViewportSize({ width:1280, height:800 });
  await page.evaluate(() => window.eval(`setNavRailExpanded(false);setNavCollapsed(true)`));
  const arrow = page.locator('#navRailExpandBtn');
  await expect(arrow).toBeVisible();
  await arrow.click();
  await expect(arrow).toHaveAttribute('aria-expanded','true');
  await expect(page.locator('body')).not.toHaveClass(/sidebar-collapsed/);
  const label = page.locator('#mainNavigation .nav-pinned [data-view="quickAccess"] > span:nth-child(2)');
  await expect(label).toBeVisible();
  await expect(label).toHaveText('Acessos Rápidos');
});
