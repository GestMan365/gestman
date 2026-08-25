import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = ["index.html", "404.html"];
const sources = Object.fromEntries(files.map((file) => [file, fs.readFileSync(path.join(root, file), "utf8")]));

const requiredMarkers = [
  "const APPLICATION_ROUTE_SLUGS = Object.freeze",
  "const APPLICATION_ROUTE_FILTERS = Object.freeze",
  "function applicationRouteTenantAllowed()",
  "function applicationRouteUrl(view, options = {})",
  "function writeApplicationRoute(view, options = {})",
  "function applyApplicationRouteFilters(view)",
  "function restoreApplicationRoute(options = {})",
  "applicationRouteTenantAllowed()",
  'route.searchParams.set("modulo", APPLICATION_ROUTE_SLUGS[param === "os" ? "orders" : "assets"]);',
  'window.addEventListener("popstate", () => {',
  "restoreApplicationRoute({ fromHistory:true })",
  'writeApplicationRoute("orders", { entityKey:"os", entityId:id });',
  'writeApplicationRoute("assets",{entityKey:"ativo",entityId:id});',
];

for (const [file, source] of Object.entries(sources)) {
  const missing = requiredMarkers.filter((marker) => !source.includes(marker));
  if (missing.length) throw new Error(`${file}: rotas incompletas: ${missing.join(", ")}`);
  if (!/orders:\{ q:"osSearch"[^}]+status:"osStatusFilter"/.test(source)) {
    throw new Error(`${file}: filtros de O.S. não estão representados na URL.`);
  }
  if (!/assets:\{ q:"assetWorkspaceSearch"[^}]+status:"assetStatusFilter"/.test(source)) {
    throw new Error(`${file}: filtros de ativos não estão representados na URL.`);
  }
  if (!/requestedOrderId && !byId\(state\.orders, requestedOrderId\)/.test(source)) {
    throw new Error(`${file}: ID de O.S. não é validado no estado da empresa atual.`);
  }
  if (!/requestedAssetId && !byId\(state\.assets, requestedAssetId\)/.test(source)) {
    throw new Error(`${file}: ID de ativo não é validado no estado da empresa atual.`);
  }
}

if (sources["index.html"] !== sources["404.html"]) {
  throw new Error("index.html e 404.html não estão sincronizados.");
}

console.log(JSON.stringify({
  files,
  moduleRoutes:true,
  entityRoutes:["os", "ativo"],
  legacyLinksPreserved:true,
  historyNavigation:true,
  routeFilters:true,
  permissionCheck:true,
  tenantCheck:true,
  fallbackSynchronized:true,
}, null, 2));
