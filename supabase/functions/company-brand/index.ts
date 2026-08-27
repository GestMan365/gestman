import { createSupabaseContext } from "npm:@supabase/server";

const DEFAULT_APP_ORIGIN = "https://app.gestman.com.br";
const APP_ORIGIN = Deno.env.get("GESTMAN_APP_ORIGIN") ?? DEFAULT_APP_ORIGIN;
const ALLOWED_ORIGINS = new Set([APP_ORIGIN, DEFAULT_APP_ORIGIN, "https://gestman365.github.io"]);
const RATE_LIMIT_ATTEMPTS = 180;
const RATE_LIMIT_WINDOW_SECONDS = 60 * 60;
const MAX_LOGO_DATA_URL_LENGTH = 1024 * 1024;

function isAllowedOrigin(origin: string) {
  return !origin
    || ALLOWED_ORIGINS.has(origin)
    || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

function cors(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": origin && isAllowedOrigin(origin) ? origin : DEFAULT_APP_ORIGIN,
    "Access-Control-Allow-Headers": "apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(req: Request, status: number, body: Record<string, unknown>, cache = "no-store") {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors(req),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": cache,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function requestOriginSignal(req: Request) {
  for (const name of ["cf-connecting-ip", "x-forwarded-for", "x-real-ip"]) {
    const candidate = (req.headers.get(name) ?? "").split(",")[0].trim().toLowerCase();
    if (candidate.length >= 3 && candidate.length <= 64 && /^[0-9a-f:.]+$/i.test(candidate)) return candidate;
  }
  return "unavailable";
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function normalizeSlug(value: unknown) {
  const slug = String(value ?? "").trim().toLowerCase();
  return /^[a-z0-9][a-z0-9-]{1,62}$/.test(slug) ? slug : "";
}

function safeLogo(value: unknown) {
  const logo = String(value ?? "").trim();
  if (
    logo.length <= MAX_LOGO_DATA_URL_LENGTH
    && /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=\s]+$/i.test(logo)
  ) return logo;
  try {
    const url = new URL(logo);
    return url.protocol === "https:" && url.href.length <= 2048 ? url.href : "";
  } catch {
    return "";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") return json(req, 405, { error: "Método não permitido.", code: "METHOD_NOT_ALLOWED" });

  const origin = req.headers.get("origin") ?? "";
  if (!isAllowedOrigin(origin)) return json(req, 403, { error: "Origem não autorizada.", code: "ORIGIN_NOT_ALLOWED" });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(req, 400, { error: "Dados inválidos.", code: "INVALID_REQUEST" });
  }
  const slug = normalizeSlug(body.slug);
  if (!slug) return json(req, 400, { error: "Endereço da empresa inválido.", code: "INVALID_COMPANY_SLUG" });

  const { data: context, error: contextError } = await createSupabaseContext(req, { auth: "publishable" });
  if (contextError || !context?.supabaseAdmin) {
    return json(req, 401, { error: "Chave pública inválida.", code: "INVALID_API_KEY" });
  }
  const service = context.supabaseAdmin;

  const rateKey = await sha256(`company-brand:v1:${requestOriginSignal(req)}`);
  const { data: allowed, error: rateError } = await service.rpc("gm_consume_public_rate_limit", {
    p_key_hash: rateKey,
    p_limit: RATE_LIMIT_ATTEMPTS,
    p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
  });
  if (rateError) return json(req, 503, { error: "Serviço temporariamente indisponível.", code: "RATE_LIMIT_UNAVAILABLE" });
  if (!allowed) return json(req, 429, { error: "Muitas consultas. Aguarde alguns minutos.", code: "RATE_LIMITED" });

  const { data: company, error: companyError } = await service.rpc("gm_public_company_brand", {
    p_slug: slug,
  });
  if (companyError) {
    console.error("company_brand_lookup_failed", {
      code: companyError.code ?? "unknown",
      message: companyError.message ?? "unknown",
    });
    return json(req, 503, { error: "Serviço temporariamente indisponível.", code: "BRAND_LOOKUP_FAILED" });
  }
  if (!company) return json(req, 404, { error: "Empresa não encontrada.", code: "COMPANY_NOT_FOUND", found: false });
  const logo = safeLogo(company.logo_url);

  return json(req, 200, {
    found: true,
    company: {
      slug: company.slug,
      name: String(company.name || "Empresa").trim().slice(0, 160),
      logo_url: logo,
    },
  }, "public, max-age=300, stale-while-revalidate=1800");
});
