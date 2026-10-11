import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('quantidade solicitada e limites usam passo inteiro para UN', () => {
  for (const file of ['index.html', '404.html']) {
    const source = readFileSync(file, 'utf8');
    const requestRow = source.split('\n').find(line => line.includes('function renderMaterialRequestDraftItems()'));
    expect(requestRow).toContain('min="${unitRequiresInteger(byId(state.spareParts,item.spareId)?.unit||"UN")?1:.01}"');
    expect(requestRow).toContain('step="${unitRequiresInteger(byId(state.spareParts,item.spareId)?.unit||"UN")?1:.01}"');
    expect(source).toContain('$("materialPartUnit").addEventListener("input", refreshMaterialPartLimitSteps)');
    expect(source).toContain('input.step = integerOnly ? "1" : "0.01"');
    expect(source).toContain('validateWholeQuantityForUnit(unit, minimum, "Estoque mínimo")');
    expect(source).toContain('validateWholeQuantityForUnit(unit, maximum, "Estoque máximo")');
  }
});

test('setas do navegador avançam de 3 para 4 unidades, não 3,01', async ({ page }) => {
  await page.setContent('<input id="quantity" type="number" min="1" step="1" value="3">');
  const result = await page.locator('#quantity').evaluate((input: HTMLInputElement) => {
    input.stepUp();
    return { value: input.value, valid: input.validity.valid };
  });
  expect(result).toEqual({ value: '4', valid: true });
});
