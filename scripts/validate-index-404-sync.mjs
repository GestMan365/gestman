import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = ["index.html", "404.html"];
const rawSources = Object.fromEntries(files.map((file) => [file, fs.readFileSync(path.join(root, file))]));
const sources = Object.fromEntries(
  files.map((file) => [file, rawSources[file].toString("utf8").replace(/\r\n/g, "\n")]),
);

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function collectIds(html) {
  const staticHtml = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  const counts = new Map();
  for (const match of staticHtml.matchAll(/\sid=(["'])([^"']+)\1/g)) {
    counts.set(match[2], (counts.get(match[2]) || 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count > 1);
}

function validateInlineJavaScript(file, html) {
  let count = 0;
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attributes = match[1] || "";
    if (/\bsrc\s*=/.test(attributes) || /\btype\s*=\s*["'](?:application\/json|importmap)["']/.test(attributes)) continue;
    count += 1;
    try {
      new vm.Script(match[2], { filename: `${file}:script-${count}` });
    } catch (error) {
      throw new Error(`${file}: JavaScript inválido no bloco ${count}: ${error.message}`);
    }
  }
  return count;
}

function validateExternalAssets(file, html) {
  if (/data:image\/[^;]+;base64,/i.test(html)) {
    throw new Error(`${file}: imagens Base64 ainda estão presentes.`);
  }
  const references = new Set();
  for (const match of html.matchAll(/\b(?:src|href)=(["'])(assets\/ui\/[^"']+)\1/gi)) {
    references.add(match[2]);
  }
  const missing = [...references].filter((reference) => !fs.existsSync(path.join(root, reference)));
  if (missing.length) {
    throw new Error(`${file}: assets inexistentes: ${missing.join(", ")}`);
  }
  return references.size;
}

function validateExternalJavaScript() {
  const file = path.join(root, "assets", "icons", "flaticon", "icon-registry.js");
  const source = fs.readFileSync(file, "utf8");
  new vm.Script(source, { filename: "assets/icons/flaticon/icon-registry.js" });
  return { file: path.relative(root, file).replaceAll("\\", "/"), bytes: Buffer.byteLength(source) };
}

function validateQuickAccessWithoutFavorites(file, html) {
  if (/favorit/i.test(html)) {
    throw new Error(`${file}: o módulo removido de Favoritos ainda possui referências.`);
  }
  const requiredMarkers = [
    'data-view="quickAccess"',
    '<h1>Acessos Rápidos</h1>',
    'stage20OpenQuickCustomize()',
    '<h2>Meus atalhos</h2>',
  ];
  const missing = requiredMarkers.filter((marker) => !html.includes(marker));
  if (missing.length) {
    throw new Error(`${file}: Acessos Rápidos perdeu marcadores obrigatórios: ${missing.join(", ")}`);
  }
  if (/renderStage20Quick\s*=/.test(html)) {
    throw new Error(`${file}: renderStage20Quick não pode ser substituído por outro módulo.`);
  }
  return true;
}

function validateOrderExecutionActions(file, html) {
  const requiredMarkers = [
    "function orderExecutionCta(order, placement",
    'data-order-execution-cta',
    'data-order-primary-action="start"',
    'data-order-primary-action="finish"',
    'data-order-primary-action="resume"',
    "Iniciar O.S. agora",
    "Finalizar O.S.",
    "Retomar O.S.",
    'class="toolbar order-detail-savebar"',
    "function confirmStartOrder(id, reopenDetails = false)",
    "#genericModal #orderDetailForm .detail-tabs",
    "flex-direction: row !important;",
  ];
  const missing = requiredMarkers.filter((marker) => !html.includes(marker));
  if (missing.length) {
    throw new Error(`${file}: ações operacionais da O.S. perderam marcadores obrigatórios: ${missing.join(", ")}`);
  }
  const oldIconOnlyActions = [
    'title="Iniciar O.S." aria-label="Iniciar O.S."',
    'title="Finalizar O.S." aria-label="Finalizar O.S."',
  ];
  if (oldIconOnlyActions.some((marker) => html.includes(marker))) {
    throw new Error(`${file}: uma ação operacional principal voltou a depender de um ícone sem texto.`);
  }
  return true;
}

function validateMobileFieldMode(file, html) {
  const requiredMarkers = [
    "const MOBILE_OPERATIONAL_VIEWS = new Set",
    "function mobileOperationalViewAllowed(view)",
    "    function setView(view, options = {}) {",
    "window.setView = setView;",
    "Somente registros e documentos",
    "Modo mobile de campo: somente execução, consulta e fechamento de documentos.",
    'data-mobile-operational data-view="orders"',
    'data-mobile-operational data-view="checklists"',
    'data-mobile-operational data-view="measurements"',
    'data-mobile-operational data-view="documentsCenter"',
    '#mainNavigation .tab:not([data-mobile-operational])',
    'body.dashboard-editing #dashboard .industrial-dashboard-shell { display:none !important; }',
  ];
  const missing = requiredMarkers.filter((marker) => !html.includes(marker));
  if (missing.length) {
    throw new Error(`${file}: modo mobile de campo perdeu marcadores obrigatórios: ${missing.join(", ")}`);
  }
  if (html.includes("+    function setView(view")) {
    throw new Error(`${file}: declaração de setView contém prefixo inválido.`);
  }
  return true;
}

function validateTypographyAndText(file, html) {
  const requiredMarkers = [
    'href="assets/fonts/inter/InterVariable.woff2"',
    'href="assets/ui/gestman-typography.css"',
    '--gestman-font-family: var(--gm-font-sans)',
    'ADMINISTRAÇÃO GESTMAN365',
    'Últimos 90 dias',
    'Último acesso',
    'aria-label="Fechar">×</button>',
  ];
  const missing = requiredMarkers.filter((marker) => !html.includes(marker));
  if (missing.length) {
    throw new Error(`${file}: tipografia/textos perderam marcadores obrigatórios: ${missing.join(", ")}`);
  }

  const forbiddenMarkers = [
    "fonts.googleapis.com",
    "fonts.gstatic.com",
    "ADMINISTRAÃ",
    "Ãšlt",
    ">Ã—</button>",
    "â€”",
    "â€¦",
    "\uFFFD",
    "--gestman-font-family: Consolas",
    "font-family: Bahnschrift",
    'font-family: "Arial Black"',
    'font-family: Roboto, "Helvetica Neue"',
  ];
  const present = forbiddenMarkers.filter((marker) => html.includes(marker));
  if (present.length) {
    throw new Error(`${file}: resíduos tipográficos ou caracteres corrompidos: ${present.join(", ")}`);
  }

  return true;
}

function validateTypographyAssets() {
  const cssFile = path.join(root, "assets", "ui", "gestman-typography.css");
  const fontFiles = [
    path.join(root, "assets", "fonts", "inter", "InterVariable.woff2"),
    path.join(root, "assets", "fonts", "inter", "InterVariable-Italic.woff2"),
    path.join(root, "assets", "fonts", "inter", "LICENSE.txt"),
  ];
  const missing = [cssFile, ...fontFiles].filter((file) => !fs.existsSync(file));
  if (missing.length) {
    throw new Error(`assets tipográficos ausentes: ${missing.map((file) => path.relative(root, file)).join(", ")}`);
  }

  const css = fs.readFileSync(cssFile, "utf8");
  const requiredCss = [
    '@font-face',
    'font-family: "Inter"',
    'InterVariable.woff2',
    'InterVariable-Italic.woff2',
    'font-variant-numeric: tabular-nums',
    'overflow-wrap: break-word',
    'word-break: normal',
  ];
  const missingCss = requiredCss.filter((marker) => !css.includes(marker));
  if (missingCss.length) {
    throw new Error(`gestman-typography.css incompleto: ${missingCss.join(", ")}`);
  }
  const undersized = fontFiles.slice(0, 2).filter((file) => fs.statSync(file).size < 100_000);
  if (undersized.length) {
    throw new Error(`fontes Inter inválidas: ${undersized.map((file) => path.basename(file)).join(", ")}`);
  }
  return fontFiles.map((file) => ({
    file: path.relative(root, file).replaceAll("\\", "/"),
    bytes: fs.statSync(file).size,
  }));
}

if (!rawSources["index.html"].equals(rawSources["404.html"])) {
  throw new Error("index.html e 404.html não são binariamente idênticos.");
}

if (sources["index.html"] !== sources["404.html"]) {
  throw new Error(
    "index.html e 404.html divergiram. Revise o diff e classifique qualquer diferença antes de aceitar o fallback.",
  );
}

for (const file of files) {
  const duplicateIds = collectIds(sources[file]);
  if (duplicateIds.length) {
    throw new Error(`${file}: IDs HTML duplicados: ${duplicateIds.map(([id, count]) => `${id} (${count})`).join(", ")}`);
  }
  validateQuickAccessWithoutFavorites(file, sources[file]);
  validateOrderExecutionActions(file, sources[file]);
  validateMobileFieldMode(file, sources[file]);
  validateTypographyAndText(file, sources[file]);
}

const scriptCounts = Object.fromEntries(files.map((file) => [file, validateInlineJavaScript(file, sources[file])]));
const assetCounts = Object.fromEntries(files.map((file) => [file, validateExternalAssets(file, sources[file])]));
const externalJavaScript = validateExternalJavaScript();
const typographyAssets = validateTypographyAssets();
console.log(
  JSON.stringify(
    {
      synchronized: true,
      binarySha256: sha256(rawSources["index.html"]),
      normalizedSha256: sha256(sources["index.html"]),
      duplicateIds: 0,
      quickAccessWithoutFavorites: true,
      visibleOrderExecutionActions: true,
      mobileFieldMode: true,
      typography: "Inter local",
      textEncoding: "UTF-8 sem mojibake conhecido",
      typographyAssets,
      inlineScriptBlocks: scriptCounts,
      localUiAssetReferences: assetCounts,
      externalJavaScript,
    },
    null,
    2,
  ),
);
