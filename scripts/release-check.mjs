import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
const run = (command, args) => execFileSync(command, args, { cwd: root, stdio: "inherit" });
const node = (...args) => run(process.execPath, args);
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url)));

// Fail-fast, local only. Publishing and production smoke are separate gates.
run("git", ["diff", "--check"]);
run("git", ["diff", "--cached", "--check"]);
node("--test", ...readdirSync(new URL("../tests/", import.meta.url))
  .filter(name => name.endsWith(".test.mjs")).map(name => "tests/" + name));
for (const [name, command] of Object.entries(pkg.scripts)) {
  if (name.endsWith(":static")) {
    if (!/^node scripts\/[\w-]+\.mjs$/.test(command)) throw Error("Unexpected validator command: " + name);
    node(command.slice(5));
  }
}
node("scripts/validate-index-404-sync.mjs");
node(require.resolve("typescript/bin/tsc"), "--noEmit", "-p", "tsconfig.json");
node(fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url)), "build");
node(require.resolve("@playwright/test/cli"), "test", "-c", "playwright.audit.config.ts");
console.log("GATE LOCAL APROVADO. Publicação e smoke autenticado não foram executados.");
