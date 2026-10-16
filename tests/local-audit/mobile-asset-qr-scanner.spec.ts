import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto('./');
  await page.evaluate(() => window.eval(`
    currentAccount={company:{id:'qa-qr',name:'QA',login:'qa'},user:{id:'qa-admin',name:'Admin QA',role:'admin',accessProfile:'admin',active:true}};
    document.body.classList.remove('auth-required','auth-loading','auth-restoring');
    document.body.classList.add('theme-light','gm-top-navigation');
    applyPermissionVisibility();
  `));
  await expect.poll(() => page.evaluate(() => Boolean((window as any).GMAssetQrScanner))).toBe(true);
});

test('atalho discreto abre a câmera sem mudar de módulo e informa permissão negada', async ({ page }) => {
  await page.evaluate(() => {
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      configurable: true,
      value: async () => { throw new DOMException('Denied', 'NotAllowedError'); },
    });
  });
  const button = page.locator('.mobile-tech-greeting .mobile-tech-scan');
  await expect(button).toBeVisible();
  await expect(button).toHaveText('Ler QR');
  await page.evaluate(() => window.eval('setView("dashboard")'));
  await button.click();
  await expect(page.locator('#assetQrScanner')).toBeVisible();
  await expect(page.locator('#assetQrScanner .asset-qr-status')).toContainText('Acesso à câmera negado');
  await expect(page.locator('#assetQrScanner .asset-qr-retry')).toBeVisible();
  await expect(page.locator('#dashboard')).toHaveClass(/active/);
  await page.keyboard.press('Escape');
  await expect(page.locator('#assetQrScanner')).toHaveCount(0);
});

test('aceita apenas QR de equipamento conhecido da empresa e respeita acesso', async ({ page }) => {
  const result = await page.evaluate(() => window.eval(`
    state.assets.push({id:'qa-asset-001',name:'Bomba QA',code:'QA-001'});
    const valid=assetQrUrl('qa-asset-001');
    const foreign=new URL(valid); foreign.hostname='example.com';
    const missing=assetQrUrl('qa-asset-missing');
    const rejectedExternal=openScannedAssetQr(foreign.toString());
    const rejectedMissing=openScannedAssetQr(missing);
    const accepted=openScannedAssetQr(valid);
    ({rejectedExternal,rejectedMissing,accepted,selectedAssetDetailId});
  `));
  expect(result).toEqual({ rejectedExternal: false, rejectedMissing: false, accepted: true, selectedAssetDetailId: 'qa-asset-001' });

  const permission = await page.evaluate(() => window.eval(`
    currentAccount.user={id:'qa-restricted',name:'Restrito',role:'technician',accessProfile:'technician',active:true};
    const original=canAccessView;
    canAccessView=(view)=>view==='assets'?false:original(view);
    applyPermissionVisibility();
    const hidden=document.querySelector('.mobile-tech-scan').classList.contains('is-permission-hidden');
    canAccessView=original;
    hidden;
  `));
  expect(permission).toBe(true);
});
