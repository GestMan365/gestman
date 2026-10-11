import { expect, test } from '@playwright/test';

for (const width of [1000, 390]) test(`ações de O.S. ficam apenas no fim da rolagem (${width}px)`, async ({ page }) => {
  await page.setViewportSize({ width, height: 700 });
  await page.goto('./');
  await page.evaluate(() => {
    document.getElementById('genericBody')?.removeAttribute('id');
    const fixture = document.createElement('div');
    fixture.id = 'genericBody';
    fixture.style.cssText = 'height:400px;overflow:auto;padding:16px';
    fixture.innerHTML = '<form class="os-simple-form" id="orderForm"><div style="height:1000px">Campos da O.S.</div><div class="os-create-actions"><button type="button">Cancelar</button><button type="submit">Salvar O.S.</button></div></form>';
    document.body.append(fixture);
  });
  const layout = await page.evaluate(() => {
    const container = document.getElementById('genericBody')!;
    const actions = container.querySelector<HTMLElement>('.os-create-actions')!;
    const before = actions.getBoundingClientRect();
    const viewport = container.getBoundingClientRect();
    container.scrollTop = container.scrollHeight;
    const after = actions.getBoundingClientRect();
    return { position: getComputedStyle(actions).position, beforeTop: before.top, afterTop: after.top, viewportBottom: viewport.bottom };
  });
  expect(layout.position).toBe('static');
  expect(layout.beforeTop).toBeGreaterThan(layout.viewportBottom);
  expect(layout.afterTop).toBeLessThan(layout.viewportBottom);
});
