import fs from "node:fs";

const index = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const fallback = fs.readFileSync(new URL("../404.html", import.meta.url), "utf8");
const icons = fs.readFileSync(new URL("../assets/icons/flaticon/icon-registry.js", import.meta.url), "utf8");

const checks = [];
function expect(condition, message) {
  if (!condition) throw new Error(message);
  checks.push(message);
}

expect(index === fallback, "index.html e 404.html permanecem idênticos");
expect(index.includes("Phase 05 — final contract for compact controls outside the sidebar."), "contrato visual da Fase 05 presente");
expect(index.includes("--gm-hit-target-compact:36px"), "alvo compacto desktop de 36px presente");
expect(index.includes("--gm-hit-target-compact:40px"), "alvo compacto mobile de 40px presente");
expect(index.includes(".workspace :is("), "contrato visual limitado ao conteúdo da aplicação");
expect(index.includes("details[class*=\"row-actions\"] > summary"), "menus de linha cobertos pelo alvo mínimo");
expect(index.includes("details[class$=\"-menu\"] > summary"), "menus contextuais cobertos pelo alvo mínimo");
expect(index.includes(".stage18-more-filters:not([open]) > div"), "filtro avançado fechado não permanece exposto");
expect(index.includes("@media (min-width:651px)"), "filtro avançado ancorado fora do layout mobile");
expect(index.includes(":focus-visible"), "foco por teclado explicitamente visível");
expect(icons.includes("button,details:not(.nav-group)>summary"), "decorador cobre menus fora da navegação");
expect(!icons.includes("button,.nav-group>summary"), "decorador não altera summaries do sidebar");
expect(icons.includes("decorate(node.parentElement||node)"), "controles atualizados dinamicamente são redecorados");
for (const selector of ["industrial-map-search>span", "materials-search>span", "preventive-search>span", "os-search-row label>span"]) {
  expect(icons.includes(selector), `busca profissionalizada: ${selector}`);
}

console.log(`Fase 05 UI: ${checks.length}/${checks.length} verificações aprovadas.`);
