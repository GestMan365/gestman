import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('nova O.S. exige solicitante e não mostra busca redundante de equipamento', () => {
  for (const file of ['index.html', '404.html']) {
    const source = readFileSync(file, 'utf8');
    const form = source.split('function openOrderModalV2(')[1]?.split('openOrderModal = openOrderModalV2;')[0];
    expect(form).toBeTruthy();
    expect(form).toContain('id="orderRequester" required');
    expect(form).toContain('if (!value("orderRequester"))');
    expect(form).toContain('id="orderRequesterError"');
    expect(form).not.toContain('id="orderAssetSearch"');
    expect(form).not.toContain('$("orderAssetSearch").addEventListener');
  }
});

test('executante tem fundo e texto legíveis no modo claro', async ({ page }) => {
  await page.goto('./');
  const colors = await page.evaluate(() => {
    document.body.classList.add('theme-light');
    const fixture = document.createElement('form');
    fixture.className = 'os-simple-form';
    fixture.innerHTML = '<div class="order-executor-field"><span class="order-executor-chip"><span><strong>Executante</strong><small>Técnico de manutenção</small></span><button type="button"></button></span><label class="order-executor-option"><input type="checkbox"><span><strong>Outro técnico</strong></span></label></div>';
    document.body.append(fixture);
    const color = (selector: string, property: 'backgroundColor' | 'color') => getComputedStyle(fixture.querySelector(selector)!).getPropertyValue(property.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`));
    return {
      field: color('.order-executor-field', 'backgroundColor'),
      chip: color('.order-executor-chip', 'backgroundColor'),
      name: color('.order-executor-chip strong', 'color'),
      option: color('.order-executor-option', 'backgroundColor'),
    };
  });
  expect(colors.field).toBe('rgb(248, 251, 255)');
  expect(colors.chip).toBe('rgb(234, 243, 255)');
  expect(colors.name).toBe('rgb(18, 53, 83)');
  expect(colors.option).toBe('rgb(255, 255, 255)');
});
