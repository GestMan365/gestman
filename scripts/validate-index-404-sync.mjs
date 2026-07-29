import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = ["index.html", "404.html"];
const sources = Object.fromEntries(
  files.map((file) => [file, fs.readFileSync(path.join(root, file), "utf8").replace(/\r\n/g, "\n")]),
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
}

const scriptCounts = Object.fromEntries(files.map((file) => [file, validateInlineJavaScript(file, sources[file])]));
console.log(
  JSON.stringify(
    {
      synchronized: true,
      normalizedSha256: sha256(sources["index.html"]),
      duplicateIds: 0,
      inlineScriptBlocks: scriptCounts,
    },
    null,
    2,
  ),
);
