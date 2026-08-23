// deno-lint-ignore no-import-prefix
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { calculateMaintenanceMetrics } from "../_shared/maintenance-metrics.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const DEFAULT_APP_ORIGIN = "https://app.gestman.com.br";
const APP_ORIGIN = Deno.env.get("GESTMAN_APP_ORIGIN") ?? DEFAULT_APP_ORIGIN;
const ALLOWED_APP_ORIGINS = new Set([
  APP_ORIGIN,
  DEFAULT_APP_ORIGIN,
  "https://gestman365.github.io",
]);
const MAX_BODY_BYTES = 16_384;

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function text(value: unknown, max = 240) {
  return String(value ?? "").trim().slice(0, max);
}

function isAllowedOrigin(origin: string) {
  return ALLOWED_APP_ORIGINS.has(origin) ||
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

function cors(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": isAllowedOrigin(origin)
      ? origin
      : DEFAULT_APP_ORIGIN,
    "Access-Control-Allow-Headers":
      "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(req: Request, status: number, body: JsonRecord) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors(req),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function permissionLevel(context: JsonRecord, module: string) {
  return text(record(context.permission_levels)[module], 20);
}

function canViewMetrics(context: JsonRecord) {
  if (text(context.member_role, 40) === "administrator") return true;
  const reports = permissionLevel(context, "reports");
  const dashboard = permissionLevel(context, "dashboard");
  const explicitLevels = [reports, dashboard].filter(Boolean);
  if (explicitLevels.length) {
    return explicitLevels.some((level) => ["view", "operate", "manage"].includes(level));
  }
  return ["supervisor", "technician", "warehouse", "viewer", "requester"].includes(
    text(context.access_profile, 40),
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors(req) });
  }
  if (req.method !== "POST") {
    return json(req, 405, { error: "Método não permitido." });
  }

  const origin = req.headers.get("origin") ?? "";
  if (origin && !isAllowedOrigin(origin)) {
    return json(req, 403, { error: "Origem não autorizada." });
  }
  if (!SUPABASE_URL || !ANON_KEY) {
    return json(req, 503, {
      code: "METRICS_BACKEND_NOT_CONFIGURED",
      error: "O serviço de indicadores está temporariamente indisponível.",
    });
  }

  const authorization = req.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) {
    return json(req, 401, { error: "Autenticação necessária." });
  }
  const contentLength = Number(req.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return json(req, 413, { error: "Filtros excedem o limite permitido." });
  }

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const token = authorization.slice(7);
  const { data: actorData, error: actorError } = await userClient.auth.getUser(token);
  if (actorError || !actorData.user) {
    return json(req, 401, { error: "Sessão inválida ou expirada." });
  }

  const { data: contexts, error: contextError } = await userClient.rpc(
    "gm_current_context",
  );
  const context = Array.isArray(contexts)
    ? record(contexts[0])
    : record(contexts);
  if (
    contextError || !context.company_id ||
    text(context.company_status, 40) !== "active"
  ) {
    return json(req, 403, { error: "Empresa ou acesso indisponível." });
  }
  if (!canViewMetrics(context)) {
    return json(req, 403, {
      error: "Seu perfil não possui acesso aos indicadores de manutenção.",
    });
  }

  let input: JsonRecord;
  try {
    const body = await req.text();
    if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) {
      return json(req, 413, { error: "Filtros excedem o limite permitido." });
    }
    input = record(JSON.parse(body));
  } catch {
    return json(req, 400, { error: "Filtros inválidos." });
  }

  const { data: tenantRows, error: tenantError } = await userClient.rpc(
    "gm_load_tenant_state",
  );
  const tenant = Array.isArray(tenantRows)
    ? record(tenantRows[0])
    : record(tenantRows);
  if (tenantError || !tenant.state) {
    return json(req, 503, {
      error: "Não foi possível consultar os dados autorizados da empresa.",
    });
  }

  try {
    const contract = calculateMaintenanceMetrics(
      tenant.state,
      input.filters,
      new Date(),
    );
    return json(req, 200, {
      ok: true,
      tenant_state_version: Number(tenant.version || 0),
      contract,
    });
  } catch (error) {
    console.error("maintenance_metrics_failed", {
      userId: actorData.user.id,
      companyId: context.company_id,
      message: error instanceof Error ? error.message : "unknown",
    });
    return json(req, 422, {
      error: "Não foi possível calcular os indicadores com os filtros informados.",
    });
  }
});
