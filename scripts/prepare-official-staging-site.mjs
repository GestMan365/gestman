import fs from "node:fs";
import path from "node:path";
import { loadOfficialStagingEnv } from "./e2e-official-env.mjs";

const env = loadOfficialStagingEnv();
const outputDirectory = path.join(env.root, "supabase", ".temp", "official-e2e-site");
const sources = ["index.html", "404.html"];

function replaceSingle(text, pattern, replacement, label, file) {
  const matches = text.match(new RegExp(pattern.source, `${pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`}`));
  if (!matches || matches.length !== 1) {
    throw new Error(`${file}: expected one ${label} assignment, found ${matches?.length ?? 0}.`);
  }
  return text.replace(pattern, replacement);
}

fs.rmSync(outputDirectory, { recursive: true, force: true });
fs.mkdirSync(outputDirectory, { recursive: true });
const uiAssetsSource = path.join(env.root, "assets", "ui");
if (!fs.existsSync(uiAssetsSource)) {
  throw new Error("Professional UI assets are missing.");
}
fs.cpSync(uiAssetsSource, path.join(outputDirectory, "assets", "ui"), { recursive: true });

for (const file of sources) {
  let html = fs.readFileSync(path.join(env.root, file), "utf8");
  html = replaceSingle(
    html,
    /const SUPABASE_URL = "[^"]+";/,
    `const SUPABASE_URL = ${JSON.stringify(env.url)};`,
    "Supabase URL",
    file,
  );
  html = replaceSingle(
    html,
    /const SUPABASE_KEY = "[^"]+";/,
    `const SUPABASE_KEY = ${JSON.stringify(env.publishableKey)};`,
    "publishable key",
    file,
  );

  if (html.includes(env.serviceRoleKey) || /sb_secret_[A-Za-z0-9_-]+/.test(html)) {
    throw new Error(`${file}: server-only key leaked into browser artifact.`);
  }
  if (/data:image\/[^;]+;base64,/i.test(html)) {
    throw new Error(`${file}: Base64 image assets are forbidden in the browser artifact.`);
  }
  if (!html.includes('gmAuthenticatedFunction("bootstrap-company"')) {
    throw new Error(`${file}: secure bootstrap Edge contract is absent.`);
  }
  if (html.includes('gmRpc("gm_bootstrap_company"')) {
    throw new Error(`${file}: direct browser bootstrap RPC is forbidden.`);
  }

  fs.writeFileSync(path.join(outputDirectory, file), html, "utf8");
}

const sourceIndex = fs.readFileSync(path.join(env.root, "index.html"), "utf8");
const sourceFallback = fs.readFileSync(path.join(env.root, "404.html"), "utf8");
const contractPattern =
  /const bootstrapIdempotencyKey = `gm-\$\{Date\.now\(\)\}-\$\{crypto\.randomUUID\(\)\}`;[\s\S]*?const context = await gmLoadContext\(\);/;
const helperPattern =
  /async function gmAuthenticatedFunction\(name, body, options = \{\}\) \{[\s\S]*?return payload;\s*\}/;
for (const [name, pattern] of [["bootstrap contract", contractPattern], ["authenticated function helper", helperPattern]]) {
  const indexMatch = sourceIndex.match(pattern)?.[0] ?? "";
  const fallbackMatch = sourceFallback.match(pattern)?.[0] ?? "";
  if (!indexMatch || indexMatch !== fallbackMatch) {
    throw new Error(`index.html and 404.html differ in ${name}.`);
  }
}

console.log("Official monolith staging artifact prepared (index, 404 and local UI assets verified).");
