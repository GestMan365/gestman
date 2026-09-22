import fs from "node:fs";

const index = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const fallback = fs.readFileSync(new URL("../404.html", import.meta.url), "utf8");
const spec = fs.readFileSync(new URL("../tests/local-audit/ui-standardization.spec.ts", import.meta.url), "utf8");
const checks = [];
function expect(condition, message) {
  if (!condition) throw new Error(message);
  checks.push(message);
}

expect(index === fallback, "index.html e 404.html permanecem idênticos");
expect(index.includes("id=\"assetPatrimony\" disabled"), "campo visual de patrimônio sem persistência presente");
expect(index.includes("id=\"materialPartReferenceValue\" type=\"text\" inputmode=\"decimal\""), "preço de referência editável presente");
expect(index.includes("Não altera o custo médio nem o valor do estoque."), "preço de referência separado da valorização do estoque");
expect(index.includes("function materialFinancialInfo"), "cálculo financeiro derivado de entradas existente");
expect(index.includes("#measurements .stage15-tabs"), "abas de medições mobile cobertas");
expect(index.includes("--gm-page-gap"), "tokens visuais transversais presentes");
expect(spec.includes("insideHorizontalScroller"), "QA diferencia rolagem intencional de corte real");
expect(spec.includes("innerWidth"), "QA confirma dimensões CSS internas");
console.log(`Padronização visual estática: ${checks.length}/${checks.length} verificações aprovadas.`);
