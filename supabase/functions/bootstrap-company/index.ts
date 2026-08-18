import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const DEFAULT_APP_ORIGIN = "https://app.gestman.com.br";
const APP_ORIGIN = Deno.env.get("GESTMAN_APP_ORIGIN") ?? DEFAULT_APP_ORIGIN;
const ALLOWED_APP_ORIGINS = new Set([APP_ORIGIN, DEFAULT_APP_ORIGIN, "https://gestman365.github.io"]);

function isAllowedOrigin(origin: string) {
  return ALLOWED_APP_ORIGINS.has(origin)
    || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}
const MAX_BODY_BYTES = 8 * 1024;
const ALLOWED_FIELDS = new Set(["name", "slug", "display_name"]);

type BootstrapPayload = {
  name: string;
  slug: string;
  display_name: string;
};

function requestId() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return `req_${Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function cors(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allowed = !origin
    || isAllowedOrigin(origin);
  return {
    "Access-Control-Allow-Origin": allowed && origin ? origin : DEFAULT_APP_ORIGIN,
    "Access-Control-Allow-Headers":
      "authorization, apikey, content-type, x-client-info, x-idempotency-key",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(
  req: Request,
  status: number,
  body: Record<string, unknown>,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors(req),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function normalizeText(value: unknown, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

function validatePayload(input: unknown): BootstrapPayload | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const record = input as Record<string, unknown>;
  if (Object.keys(record).some((key) => !ALLOWED_FIELDS.has(key))) return null;

  const payload = {
    name: normalizeText(record.name, 160),
    slug: normalizeText(record.slug, 63).toLowerCase(),
    display_name: normalizeText(record.display_name, 160),
  };
  if (payload.name.length < 2 || payload.display_name.length < 2) return null;
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(payload.slug)) return null;
  return payload;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

Deno.serve(async (req) => {
  const reqId = requestId();
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors(req) });
  }
  if (req.method !== "POST") {
    return json(req, 405, { error: "Solicitação não permitida.", request_id: reqId });
  }

  const origin = req.headers.get("origin") ?? "";
  if (
    origin
    && !isAllowedOrigin(origin)
  ) {
    return json(req, 403, { error: "Solicitação não autorizada.", request_id: reqId });
  }
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
    console.error("bootstrap_company_configuration_missing", { requestId: reqId });
    return json(req, 503, { error: "Serviço temporariamente indisponível.", request_id: reqId });
  }

  const authorization = req.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
  if (!token) {
    return json(req, 401, { error: "Sessão inválida.", request_id: reqId });
  }

  const idempotencyKey = req.headers.get("x-idempotency-key")?.trim() ?? "";
  if (
    idempotencyKey.length < 16
    || idempotencyKey.length > 128
    || !/^[A-Za-z0-9._:-]+$/.test(idempotencyKey)
  ) {
    return json(req, 400, { error: "Solicitação inválida.", request_id: reqId });
  }

  const declaredLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return json(req, 413, { error: "Solicitação muito grande.", request_id: reqId });
  }

  let bodyText = "";
  try {
    bodyText = await req.text();
  } catch {
    return json(req, 400, { error: "Solicitação inválida.", request_id: reqId });
  }
  if (new TextEncoder().encode(bodyText).byteLength > MAX_BODY_BYTES) {
    return json(req, 413, { error: "Solicitação muito grande.", request_id: reqId });
  }

  let input: unknown;
  try {
    input = JSON.parse(bodyText);
  } catch {
    return json(req, 400, { error: "Solicitação inválida.", request_id: reqId });
  }
  const payload = validatePayload(input);
  if (!payload) {
    return json(req, 400, { error: "Solicitação inválida.", request_id: reqId });
  }

  const service = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await service.auth.getUser(token);
  const user = authData?.user;
  if (authError || !user) {
    return json(req, 401, { error: "Sessão inválida.", request_id: reqId });
  }

  const rateKey = await sha256(`bootstrap-company:${user.id}`);
  const { data: rateAllowed, error: rateError } = await service.rpc(
    "gm_consume_public_rate_limit",
    {
      p_key_hash: rateKey,
      p_limit: 10,
      p_window_seconds: 3600,
    },
  );
  if (rateError) {
    console.error("bootstrap_company_rate_limit_failed", { requestId: reqId });
    return json(req, 503, { error: "Serviço temporariamente indisponível.", request_id: reqId });
  }
  if (!rateAllowed) {
    return json(req, 429, { error: "Tente novamente mais tarde.", request_id: reqId });
  }

  const { data, error } = await service.rpc("gm_bootstrap_company_server", {
    p_user_id: user.id,
    p_name: payload.name,
    p_slug: payload.slug,
    p_display_name: payload.display_name,
    p_idempotency_key: idempotencyKey,
  });
  if (error) {
    const conflict = error.code === "23505";
    console.warn("bootstrap_company_rejected", {
      requestId: reqId,
      category: conflict ? "conflict" : "database",
    });
    return json(req, conflict ? 409 : 422, {
      error: conflict
        ? "Não foi possível concluir com os dados informados."
        : "Não foi possível concluir o cadastro.",
      request_id: reqId,
    });
  }

  const result = Array.isArray(data) ? data[0] : data;
  console.info("bootstrap_company_completed", {
    requestId: reqId,
    created: result?.created === true,
  });
  return json(req, result?.created === true ? 201 : 200, {
    ok: true,
    company: {
      name: String(result?.company_name ?? payload.name),
      slug: String(result?.company_slug ?? payload.slug),
    },
    request_id: reqId,
  });
});
