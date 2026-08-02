import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const iconRoot = path.join(root, "assets", "icons", "flaticon");
const manifestFile = path.join(iconRoot, "icon-manifest.json");
const registryFile = path.join(iconRoot, "icon-registry.js");
const cssFile = path.join(root, "assets", "ui", "gestman-3d.css");
const categories = new Set(["modules", "actions", "status", "kpi", "states"]);

const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
const registry = fs.readFileSync(registryFile, "utf8");
const css = fs.readFileSync(cssFile, "utf8");
const records = Object.entries(manifest);
const failures = [];
const files = new Set();

if (records.length !== 117) failures.push(`manifesto possui ${records.length} conceitos; esperado: 117`);

for (const [semanticName, item] of records) {
  if (!categories.has(item.category)) failures.push(`${semanticName}: categoria inválida ${item.category}`);
  if (!item.file.startsWith(`assets/icons/flaticon/${item.category}/`)) {
    failures.push(`${semanticName}: caminho fora da categoria declarada`);
  }
  if (files.has(item.file)) failures.push(`${semanticName}: arquivo semântico duplicado ${item.file}`);
  files.add(item.file);

  const absolute = path.join(root, item.file);
  if (!fs.existsSync(absolute)) {
    failures.push(`${semanticName}: arquivo inexistente ${item.file}`);
    continue;
  }

  const svg = fs.readFileSync(absolute, "utf8");
  if (!/^<svg\b[^>]*viewBox="0 0 300 300"/i.test(svg)) failures.push(`${semanticName}: SVG sem viewBox esperado`);
  if (!/<path\b[^>]*d="[^"]+"/i.test(svg)) failures.push(`${semanticName}: SVG sem path vetorial`);
  if (/<(?:script|image|foreignObject|rect)\b/i.test(svg)) failures.push(`${semanticName}: elemento proibido no SVG`);
  const svgWithoutNamespace = svg.replace(/\sxmlns="http:\/\/www\.w3\.org\/2000\/svg"/i, "");
  if (/data:|https?:|javascript:/i.test(svgWithoutNamespace)) failures.push(`${semanticName}: referência externa ou embutida no SVG`);
  if (!registry.includes(JSON.stringify(item.file))) failures.push(`${semanticName}: arquivo ausente do registro central`);
  if (!item.author || !item.sourceUrl || !item.licenseUrl || !item.attribution) {
    failures.push(`${semanticName}: metadados de licença incompletos`);
  }
}

const diskSvgs = [];
for (const category of categories) {
  const directory = path.join(iconRoot, category);
  if (!fs.existsSync(directory)) {
    failures.push(`pasta obrigatória ausente: ${category}`);
    continue;
  }
  for (const file of fs.readdirSync(directory)) {
    if (file.endsWith(".svg")) diskSvgs.push(path.join("assets", "icons", "flaticon", category, file).replaceAll("\\", "/"));
  }
}

if (diskSvgs.length !== records.length) failures.push(`${diskSvgs.length} SVGs no disco; esperado: ${records.length}`);
for (const file of diskSvgs) if (!files.has(file)) failures.push(`SVG sem registro: ${file}`);

if (/data:image|<svg\b|<path\b/i.test(registry)) failures.push("registro central contém SVG/Base64 inline");
if (!registry.includes("Uicons by Flaticon") || !registry.includes("https://www.flaticon.com/uicons")) {
  failures.push("atribuição Flaticon ausente do registro central");
}
if (!css.includes(".gm-flaticon-icon") || !css.includes("mask-image: var(--gm-icon-source)")) {
  failures.push("integração CSS dos SVGs locais ausente");
}

for (const htmlFile of ["index.html", "404.html"]) {
  const html = fs.readFileSync(path.join(root, htmlFile), "utf8");
  if (!html.includes('src="assets/icons/flaticon/icon-registry.js"')) failures.push(`${htmlFile}: registro Flaticon não carregado`);
  if (html.includes('src="assets/ui/icon-registry.js"')) failures.push(`${htmlFile}: registro antigo ainda referenciado`);
  if (/auth-(?:field-icon|password-toggle|submit-arrow|footer-icon)[^>]*>[\s\S]{0,120}<svg\b/i.test(html)) {
    failures.push(`${htmlFile}: ícone SVG antigo ainda presente na autenticação`);
  }
}

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}

console.log(JSON.stringify({
  semanticIcons: records.length,
  localSvgFiles: diskSvgs.length,
  categories: Object.fromEntries([...categories].map((category) => [category, records.filter(([, item]) => item.category === category).length])),
  missingAssets: 0,
  externalIconRuntimeReferences: 0,
  attribution: "Uicons by Flaticon",
}, null, 2));
