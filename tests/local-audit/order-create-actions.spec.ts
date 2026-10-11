import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('criação de O.S. oferece apenas salvar, sem iniciar automaticamente', () => {
  for (const file of ['index.html', '404.html']) {
    const source = readFileSync(file, 'utf8');
    expect(source).not.toContain('Salvar e Iniciar');
    expect(source).not.toContain('button?.value === "start"');
    expect(source).not.toContain('button?.value==="start"');
    expect(source.match(/<button class="btn primary" type="submit" value="save">Salvar O\.S\.<\/button>/g)).toHaveLength(2);
  }
});
