import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Local-only QA: never serve environment/config files or enable remote connections.
const root = fileURLToPath(new URL("../", import.meta.url));
const host = "127.0.0.1", port = 4186;
const fixture = fs.readFileSync(new URL("../tests/fixtures/preventive-local-qa.js", import.meta.url), "utf8");
const types = { ".js":"text/javascript", ".css":"text/css", ".svg":"image/svg+xml", ".png":"image/png", ".ico":"image/x-icon", ".woff2":"font/woff2" };
const server = http.createServer((request, response) => {
  try {
    if (request.method !== "GET") { response.writeHead(405).end(); return; }
    const url = new URL(request.url, `http://${host}:${port}`);
    let body, type;
    if (url.pathname === "/" || url.pathname === "/login") {
      body = fs.readFileSync(path.join(root, "index.html"), "utf8");
      if (url.pathname === "/") body = body.replace("</body>", `<script>${fixture}</script></body>`);
      type = "text/html; charset=utf-8";
    } else {
      const file = path.resolve(root, "." + decodeURIComponent(url.pathname));
      const assetsRoot = path.join(root, "assets") + path.sep;
      if (!file.startsWith(assetsRoot) || !types[path.extname(file)]) {
        response.writeHead(404).end(); return;
      }
      body = fs.readFileSync(file);
      type = types[path.extname(file)];
    }
    response.writeHead(200, {
      "Content-Type":type,
      "Cache-Control":"no-store",
      "Content-Security-Policy":"default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'none'; frame-src 'none'; form-action 'none'; object-src 'none'; base-uri 'self'",
      "X-Content-Type-Options":"nosniff",
    });
    response.end(body);
  } catch { response.writeHead(404).end(); }
});
server.listen(port, host, () => console.log(`QA preventiva offline: http://${host}:${port}/`));
for (const signal of ["SIGINT","SIGTERM"]) process.on(signal, () => server.close(() => process.exit(0)));
