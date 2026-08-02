import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const htmlFiles = ["index.html", "404.html"];
const uiRoot = path.join(root, "assets", "ui");
const illustrationRoot = path.join(uiRoot, "illustrations");
const iconRegistryPath = path.join(root, "assets", "icons", "flaticon", "icon-registry.js");
const stylesheetHref = "assets/ui/gestman-3d.css";
const iconRegistrySrc = "assets/icons/flaticon/icon-registry.js";

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function assetName(mime, bytes, context) {
  if (mime === "x-icon") return "favicon.ico";
  if (mime === "gif") return "transparent.gif";
  if (/apple-touch-icon/i.test(context)) return "apple-touch-icon.png";
  if (/sizes=["']32x32["']/i.test(context)) return "favicon-32.png";
  return "gestman365-logo.png";
}

function extractImages(html) {
  const byDigest = new Map();
  const expression = /data:image\/(x-icon|png|gif);base64,([^"']+)/gi;
  let output = "";
  let cursor = 0;

  for (const match of html.matchAll(expression)) {
    const bytes = Buffer.from(match[2], "base64");
    const digest = sha256(bytes);
    const context = html.slice(Math.max(0, match.index - 220), match.index);
    const fileName = byDigest.get(digest) || assetName(match[1].toLowerCase(), bytes, context);
    byDigest.set(digest, fileName);
    fs.writeFileSync(path.join(illustrationRoot, fileName), bytes);
    output += html.slice(cursor, match.index);
    output += `assets/ui/illustrations/${fileName}`;
    cursor = match.index + match[0].length;
  }

  output += html.slice(cursor);
  return output;
}

function externalizeIconRegistry(html) {
  if (html.includes(`src="${iconRegistrySrc}"`)) return html;

  const marker = "const paths = {";
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) throw new Error("Central icon registry was not found.");

  const scriptStart = html.lastIndexOf("<script>", markerIndex);
  const scriptEnd = html.indexOf("</script>", markerIndex);
  if (scriptStart < 0 || scriptEnd < 0) throw new Error("Central icon registry script boundaries were not found.");

  const bodyStart = html.indexOf(">", scriptStart) + 1;
  const body = html.slice(bodyStart, scriptEnd).replace(/^\s*\r?\n/, "").replace(/\s*$/, "");
  if (!body.includes("window.GMIcons") || !body.includes("window.gmIcon")) {
    throw new Error("The selected script is not the GestMan365 icon registry.");
  }

  fs.writeFileSync(
    iconRegistryPath,
    `/* GestMan365 professional icon registry — generated from the validated monolith. */\n${body}\n`,
    "utf8",
  );

  return `${html.slice(0, scriptStart)}<script src="${iconRegistrySrc}"></script>${html.slice(scriptEnd + "</script>".length)}`;
}

function includeStylesheet(html) {
  if (html.includes(`href="${stylesheetHref}"`)) return html;
  const closingHead = html.indexOf("</head>");
  if (closingHead < 0) throw new Error("Closing head tag was not found.");
  const newline = html.includes("\r\n") ? "\r\n" : "\n";
  return `${html.slice(0, closingHead)}  <link rel="stylesheet" href="${stylesheetHref}">${newline}${html.slice(closingHead)}`;
}

function normalizeChangedAssetLines(html) {
  return html
    .split("\n")
    .map((line) => (line.includes("assets/ui/") ? line.replace(/\r$/, "") : line))
    .join("\n");
}

const sources = Object.fromEntries(
  htmlFiles.map((file) => [file, fs.readFileSync(path.join(root, file), "utf8")]),
);
if (sources["index.html"] !== sources["404.html"]) {
  throw new Error("index.html and 404.html must be identical before preparing UI assets.");
}

fs.mkdirSync(illustrationRoot, { recursive: true });
fs.mkdirSync(path.dirname(iconRegistryPath), { recursive: true });

let prepared = extractImages(sources["index.html"]);
prepared = externalizeIconRegistry(prepared);
prepared = includeStylesheet(prepared);
prepared = normalizeChangedAssetLines(prepared);

for (const file of htmlFiles) {
  fs.writeFileSync(path.join(root, file), prepared, "utf8");
}

console.log(
  JSON.stringify(
    {
      synchronized: true,
      htmlSha256: sha256(prepared),
      iconRegistry: path.relative(root, iconRegistryPath).replaceAll("\\", "/"),
      illustrations: fs.readdirSync(illustrationRoot).sort(),
    },
    null,
    2,
  ),
);
