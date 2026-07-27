import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { loadOfficialStagingEnv } from "./e2e-official-env.mjs";

const env = loadOfficialStagingEnv();
const prepare = spawnSync(
  process.execPath,
  [path.join(env.root, "scripts", "prepare-official-staging-site.mjs")],
  { cwd: env.root, stdio: "inherit" },
);
if (prepare.status !== 0) process.exit(prepare.status ?? 1);

const root = path.join(env.root, "supabase", ".temp", "official-e2e-site");
const port = Number(process.env.OFFICIAL_E2E_PORT || 4173);
const host = "127.0.0.1";

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url || "/", `http://${host}:${port}`);
  const isIndex = requestUrl.pathname === "/" || requestUrl.pathname === "/index.html";
  const file = isIndex ? "index.html" : "404.html";
  const body = fs.readFileSync(path.join(root, file));
  response.writeHead(isIndex || requestUrl.pathname === "/404.html" ? 200 : 404, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(body);
});

server.listen(port, host, () => {
  console.log(`Official monolith staging server ready at http://${host}:${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
