import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const index = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const fallback = fs.readFileSync(new URL("../404.html", import.meta.url), "utf8");
const icons = fs.readFileSync(new URL("../assets/icons/flaticon/icon-registry.js", import.meta.url), "utf8");
const fixture = fs.readFileSync(new URL("./fixtures/phase05-ui-audit.js", import.meta.url), "utf8");
const standardUi = fs.readFileSync(new URL("../assets/ui/gestman-stage01-standard.css", import.meta.url), "utf8");

test("a página oficial e o fallback continuam em paridade", () => {
  assert.equal(index, fallback);
});

test("o contrato compacto usa alvos adequados em desktop e mobile", () => {
  assert.match(index, /--gm-hit-target-compact:36px/);
  assert.match(index, /@media \(max-width:600px\)[\s\S]*--gm-hit-target-compact:40px/);
  assert.match(index, /details\[class\*=\"row-actions\"\] > summary/);
  assert.match(index, /details\[class\$=\"-menu\"\] > summary/);
  assert.match(index, /\.stage18-more-filters:not\(\[open\]\) > div[\s\S]*display:none !important/);
  assert.match(index, /@media \(min-width:651px\)[\s\S]*\.stage18-more-filters > div[\s\S]*left:0/);
});

test("o foco visível alcança controles e campos do workspace", () => {
  assert.match(index, /\.workspace :is\([\s\S]*\[tabindex\]:not\(\[tabindex=\"-1\"\]\)[\s\S]*\):focus-visible/);
  assert.match(index, /outline:2px solid var\(--gm-info\)/);
});

test("Relatórios empilha o cabeçalho junto das ações até 1024px", () => {
  assert.match(standardUi, /@media \(max-width: 1024px\)[\s\S]*:is\(\[class\$="-page-head"\],\.industrial-dashboard-heading,\.s16-head\)[\s\S]*flex-direction: column !important/);
});

test("o seletor de visualização de Documentos usa ícones licenciados e estado acessível", () => {
  assert.match(icons, /function decorateDocumentViewButtons\(root\)/);
  assert.match(icons, /name=list\?"workOrders":"dashboard"/);
  assert.match(icons, /button\.dataset\.gmDocumentViewIcon!==name\|\|!button\.querySelector\("\.gm-icon"\)/);
  assert.match(icons, /button\.setAttribute\("aria-label",label\)/);
  assert.match(icons, /button\.setAttribute\("aria-pressed",String\(button\.classList\.contains\("active"\)\)\)/);
  assert.match(icons, /decorateButtons\(root\);decorateDocumentViewButtons\(root\);decorateProfessionalIcons\(root\)/);
});

test("ícones genéricos são decorados somente fora dos grupos do sidebar", () => {
  assert.match(icons, /button,details:not\(\.nav-group\)>summary/);
  assert.doesNotMatch(icons, /button,\.nav-group>summary/);
  assert.match(icons, /industrial-map-search>span/);
  assert.match(icons, /os-search-row label>span/);
  assert.match(icons, /decorate\(node\.parentElement\|\|node\)/);
});

test("a fixture visual é local, hermética e sem persistência", () => {
  assert.match(fixture, /remoteSync:\s*false/);
  assert.match(fixture, /saveState\s*=\s*\(\)\s*=>\s*\{\}/);
  assert.match(fixture, /saveOrderSupabaseNow\s*=\s*async\s*\(\)\s*=>\s*false/);
  assert.doesNotMatch(fixture, /https?:\/\//);
});
