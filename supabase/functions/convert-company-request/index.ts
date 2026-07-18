import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const APP_ORIGIN = Deno.env.get("GESTMAN_APP_ORIGIN") ?? "https://gestman365.github.io";

function cors(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allowed = origin === APP_ORIGIN || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return {
    "Access-Control-Allow-Origin": allowed ? origin : APP_ORIGIN,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(req: Request, status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors(req),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function normalizeAccessUsername(value: unknown) {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, ".")
    .replace(/[._-]{2,}/g, ".")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 48);
}

function tenantAuthEmail(companySlug: string, username: string) {
  const domainKey = companySlug.replace(/[^a-z0-9]+/g, "").slice(0, 48);
  return `${username}.${domainKey}@login.gestman365.com.br`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") return json(req, 405, { error: "Método não permitido." });
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
    return json(req, 503, { error: "Serviço temporariamente indisponível." });
  }

  const origin = req.headers.get("origin") ?? "";
  if (origin && origin !== APP_ORIGIN && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    return json(req, 403, { error: "Origem não autorizada." });
  }

  const authorization = req.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) {
    return json(req, 401, { error: "Autenticação necessária." });
  }

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser(authorization.slice(7));
  if (userError || !userData.user) {
    return json(req, 401, { error: "Sessão inválida ou expirada." });
  }

  const { data: platformRole } = await userClient.rpc("gm_current_platform_role");
  if (!(["owner", "superadmin"].includes(String(platformRole)))) {
    return json(req, 403, { error: "Acesso restrito à administração GestMan365." });
  }

  let input: Record<string, unknown>;
  try {
    input = await req.json();
  } catch {
    return json(req, 400, { error: "Dados inválidos." });
  }

  const required = [
    "request_id", "company_slug", "plan_code", "user_limit", "unit_limit",
    "starts_on", "initial_status", "main_unit_name",
    "admin_name", "admin_username", "admin_password",
  ];
  if (required.some((key) => !String(input[key] ?? "").trim())) {
    return json(req, 400, { error: "Preencha todos os dados obrigatórios da conversão." });
  }

  const companySlug = String(input.company_slug).trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{2,47}$/.test(companySlug)) {
    return json(req, 400, {
      error: "O domínio deve ter entre 3 e 48 caracteres, usando apenas letras minúsculas, números e hífen.",
    });
  }

  const adminUsername = normalizeAccessUsername(input.admin_username);
  if (adminUsername.length < 2) {
    return json(req, 400, { error: "Informe um nome de usuario com pelo menos 2 caracteres." });
  }
  const adminEmail = tenantAuthEmail(companySlug, adminUsername);
  const adminPassword = String(input.admin_password);
  if (adminPassword.length < 8 || adminPassword.length > 128) {
    return json(req, 400, { error: "A senha deve ter entre 8 e 128 caracteres." });
  }

  const service = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: created, error: createError } = await service.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
    user_metadata: {
      display_name: String(input.admin_name).trim(),
      access_username: adminUsername,
      onboarding: "company_admin",
      company_slug: companySlug,
    },
  });
  if (createError || !created.user?.id) {
    const duplicate = /already|registered|exists/i.test(String(createError?.message ?? ""));
    return json(req, duplicate ? 409 : 422, {
      error: duplicate
        ? "Este nome de usuário já está em uso neste domínio. Informe outro usuário."
        : "Não foi possível criar o usuário de acesso.",
    });
  }

  const args = {
    p_request_id: input.request_id,
    p_actor_user_id: userData.user.id,
    p_admin_user_id: created.user.id,
    p_company_slug: companySlug,
    p_plan_code: String(input.plan_code).trim(),
    p_user_limit: Number(input.user_limit),
    p_unit_limit: Number(input.unit_limit),
    p_storage_limit_mb: 10240,
    p_starts_on: input.starts_on,
    p_trial_ends_on: input.trial_ends_on || null,
    p_initial_status: input.initial_status,
    p_main_unit_name: String(input.main_unit_name).trim(),
    p_admin_name: String(input.admin_name).trim(),
    p_admin_email: adminEmail,
  };
  const { data: companyId, error: conversionError } = await service.rpc(
    "gm_convert_company_request_with_access_internal",
    args,
  );
  if (conversionError) {
    await service.auth.admin.deleteUser(created.user.id);
    const duplicate = conversionError.code === "23505";
    return json(req, duplicate ? 409 : 422, {
      error: duplicate
        ? "A solicitação, o domínio ou a empresa já foi convertido/cadastrado."
        : "Não foi possível concluir a conversão. Nenhuma empresa foi criada.",
    });
  }

  return json(req, 201, {
    ok: true,
    company_id: companyId,
    access: { domain: companySlug, username: adminUsername },
    email_sent: false,
    message: "Empresa e acesso criados. Nenhum e-mail foi enviado ao cliente.",
  });
});
