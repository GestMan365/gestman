import { expect, test } from '@playwright/test';

test('campos e rodapé do login não se sobrepõem', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1410, height: 900 });
  await page.goto('./');
  await page.evaluate(() => document.body.classList.add('auth-required'));
  const layout = await page.evaluate(() => {
    const inputs = ['authCompanyLogin', 'authEmail', 'authPassword'].map(id => {
      const input = document.getElementById(id)!;
      const icon = input.parentElement!.querySelector('.auth-field-icon')!;
      const field = input.getBoundingClientRect();
      const symbol = icon.getBoundingClientRect();
      return { id, paddingLeft: getComputedStyle(input).paddingLeft, fieldLeft: field.left, iconRight: symbol.right };
    });
    const footer = document.querySelector('.auth-reference-footer')!.getBoundingClientRect();
    const items = Array.from(document.querySelectorAll('.auth-footer-item')).map(item => item.getBoundingClientRect());
    return { inputs, footer: { top: footer.top, bottom: footer.bottom }, items: items.map(item => ({ top: item.top, bottom: item.bottom, width: item.width })) };
  });
  for (const input of layout.inputs) {
    expect(input.fieldLeft + parseFloat(input.paddingLeft)).toBeGreaterThan(input.iconRight + 8);
  }
  expect(layout.footer.bottom).toBeLessThanOrEqual(900);
  expect(layout.items.every(item => item.width > 240)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('login-desktop.png') });
});

test('login mantém campos legíveis em tela estreita', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await page.evaluate(() => document.body.classList.add('auth-required'));
  const fields = await page.evaluate(() => ['authCompanyLogin', 'authEmail', 'authPassword'].map(id => {
    const input = document.getElementById(id)!;
    const icon = input.parentElement!.querySelector('.auth-field-icon')!;
    return { start: input.getBoundingClientRect().left + parseFloat(getComputedStyle(input).paddingLeft), iconEnd: icon.getBoundingClientRect().right, width: input.getBoundingClientRect().width };
  }));
  for (const field of fields) {
    expect(field.start).toBeGreaterThan(field.iconEnd + 8);
    expect(field.width).toBeGreaterThan(250);
  }
});

test('rodapé se organiza em duas colunas no tablet', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 900 });
  await page.goto('./');
  await page.evaluate(() => document.body.classList.add('auth-required'));
  const footer = page.locator('.auth-reference-footer');
  await expect(footer).toBeVisible();
  const rows = await footer.locator('.auth-footer-item').evaluateAll(items => items.map(item => Math.round(item.getBoundingClientRect().top)));
  expect(rows[0]).toBe(rows[1]);
  expect(rows[2]).toBe(rows[3]);
  expect(rows[2]).toBeGreaterThan(rows[0]);
});
