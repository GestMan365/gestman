import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
test('32 módulos nos dois temas e quatro dimensões CSS', async ({ page }) => {
  test.setTimeout(240000);
  const faults: string[] = [];
  page.on('pageerror', error => faults.push(error.message));
  await page.goto('/ui-audit');
  await expect(page.locator('body')).not.toHaveClass(/auth-loading/);
  const views = await page.locator('section.view').evaluateAll(nodes => nodes.map(node => node.id));
  const evidence = 'test-results/premium-evidence';
  mkdirSync(evidence, { recursive: true });
  const audit: any[] = [];
  for (const size of [{ width:1440,height:960 },{ width:1103,height:621 },{ width:951,height:535 },{ width:390,height:844 }]) {
    await page.setViewportSize(size);
    for (const theme of ['dark','light']) {
      await page.evaluate(theme => (window as any).applyTheme(theme, { silent: true }), theme);
      for (const view of views) {
        await page.evaluate(view => {
          // Renderer invocation is local QA only; never used to bypass production permissions.
          (window as any).setView(view, { persist:false, route:false, silent:true });
          document.querySelectorAll('section.view').forEach(node => node.classList.toggle('active', node.id === view));
          scrollTo(0, 0);
        }, view);
        await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
        const geometry = await page.evaluate(view => {
          const main = document.querySelector('main.workspace')!.getBoundingClientRect();
          const root = document.getElementById(view)!.getBoundingClientRect();
          return { width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollWidth,left:root.left,right:root.right,mainTop:main.top };
        }, view);
        audit.push({ view,theme,...size,...geometry });
        expect.soft(geometry.width).toBe(size.width);
        expect.soft(geometry.height).toBe(size.height);
        expect.soft(geometry.scroll, `${view} ${theme} ${size.width}: global overflow`).toBeLessThanOrEqual(size.width+1);
        expect.soft(geometry.right, `${view} ${theme}: root overflow`).toBeLessThanOrEqual(size.width+1);
        if (size.width === 1440 && ['dashboard','orders','assets','reports','documentsCenter','preventivePlans'].includes(view) || size.width === 390 && ['dashboard','orders','documentsCenter'].includes(view)) {
          await page.screenshot({ path:`${evidence}/${view}-${theme}-${size.width}.png` });
        }
      }
    }
  }
  writeFileSync(`${evidence}/geometry.json`,JSON.stringify(audit,null,2));
  expect(faults).toEqual([]);
});
test('menu recolhe, busca módulos e mantém links autorizados', async ({ page }) => {
  await page.goto('/ui-audit');
  await expect(page.locator('body')).not.toHaveClass(/auth-loading/);
  await page.locator('#topbarMenuBtn').click();
  await expect(page.locator('body')).toHaveClass(/sidebar-collapsed/);
  await page.locator('#topbarMenuBtn').click();
  await expect(page.locator('body')).not.toHaveClass(/sidebar-collapsed/);
  await page.getByRole('searchbox',{name:'Encontrar módulo no menu'}).fill('Ordens');
  await expect(page.locator('[data-nav-group="maintenance"]')).toBeVisible();
  await page.locator('[data-nav-group="maintenance"]>summary').click();
  await page.locator('#mainNavigation [data-view="orders"]').click();
  await expect(page.locator('#orders')).toHaveClass(/active/);
  await page.getByRole('searchbox',{name:'Encontrar módulo no menu'}).fill('');
  await page.setViewportSize({width:390,height:844});
  await page.locator('#topbarMenuBtn').click();
  await expect(page.locator('body')).toHaveClass(/mobile-nav-open/);
  await expect(page.locator('#topbarMenuBtn')).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(page.locator('body')).not.toHaveClass(/mobile-nav-open/);
  await expect(page.locator('#topbarMenuBtn')).toHaveAttribute('aria-expanded', 'false');
});
test('apresentação nunca revela controles ocultos por permissão', async ({ page }) => {
  await page.goto('/ui-audit');
  await expect(page.locator('body')).not.toHaveClass(/auth-loading/);
  for (const theme of ['light', 'dark']) {
    await page.evaluate(theme => (window as any).applyTheme(theme, { silent:true }), theme);
    for (const state of ['is-permission-hidden', 'is-action-permission-hidden', 'is-profile-hidden', 'hidden']) {
      await page.evaluate(state => {
        const button = document.createElement('button');
        button.id = 'premiumPermissionProbe';
        button.className = 'btn primary';
        button.textContent = 'Controle QA oculto';
        if (state === 'hidden') button.hidden = true;
        else button.classList.add(state);
        document.querySelector('main.workspace')!.append(button);
      }, state);
      await expect(page.locator('#premiumPermissionProbe')).toBeHidden();
      await page.locator('#premiumPermissionProbe').evaluate(node => node.remove());
    }
  }
});
