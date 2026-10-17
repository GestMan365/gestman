import { expect, test } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
let server:Server;
let staticUrl:string;

test.beforeAll(async () => {
  server = createServer(async (request, response) => {
    const pathname = decodeURIComponent(new URL(request.url || '/', 'http://localhost').pathname);
    const file = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (file !== resolve(root, 'index.html') && !file.startsWith(resolve(root) + sep)) {
      response.writeHead(403).end();
      return;
    }
    try {
      const mime = ({ '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png', '.woff2':'font/woff2' } as Record<string,string>)[extname(file)] || 'application/octet-stream';
      response.writeHead(200, { 'content-type':mime });
      response.end(await readFile(file));
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise<void>(resolveReady => server.listen(0, '127.0.0.1', resolveReady));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Static test server unavailable');
  staticUrl = `http://127.0.0.1:${address.port}/`;
});

test.afterAll(async () => {
  await new Promise<void>((resolveDone, reject) => server.close(error => error ? reject(error) : resolveDone()));
});

test('publicação estática carrega leitor e tempo real sem erro e mostra uma só câmera', async ({ page }) => {
  const pageErrors:string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.setViewportSize({ width:390, height:844 });
  await page.goto(staticUrl, { waitUntil:'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => Boolean((window as any).GMAssetQrScanner && (window as any).GMTenantRealtime))).toBe(true);
  await page.evaluate(() => window.eval(`
    currentAccount={company:{id:'qa-static',name:'QA',login:'qa'},user:{id:'qa-admin',name:'Admin QA',role:'admin',accessProfile:'admin',active:true}};
    document.body.classList.remove('auth-required','auth-loading','auth-restoring');
    applyPermissionVisibility();
    render();
  `));
  const scannerButton = page.locator('.mobile-tech-scan');
  await expect(scannerButton).toBeVisible();
  await expect(scannerButton.locator('svg')).toHaveCount(1);
  await expect(scannerButton.locator('.gm-button-icon')).toHaveCount(0);
  await page.evaluate(() => {
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      configurable:true,
      value:async () => { throw new DOMException('Denied', 'NotAllowedError'); },
    });
  });
  await scannerButton.click();
  await expect(page.locator('#assetQrScanner')).toBeVisible();
  await expect(page.locator('#assetQrScanner .asset-qr-status')).toContainText('Acesso à câmera negado');
  await expect(page.locator('#stage21ErrorBoundary')).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});
