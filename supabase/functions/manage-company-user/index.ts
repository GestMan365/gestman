import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const APP_ORIGIN = Deno.env.get("GESTMAN_APP_ORIGIN") ?? "https://gestman365.github.io";
const MODULES = ["dashboard", "map", "assets", "tags", "locations", "documents", "orders", "preventivePlans", "checklists", "stock", "suppliers", "resources", "reports", "assistant"];
const LEVELS = new Set(["none", "view", "operate", "manage"]);

const TEMPLATES: Record<string, Record<string, string>> = {
  admin: Object.fromEntries(MODULES.map((key) => [key, "manage"])),
  supervisor: { dashboard:"view", map:"view", assets:"view", tags:"view", locations:"view", documents:"view", orders:"manage", preventivePlans:"manage", checklists:"manage", stock:"operate", suppliers:"view", resources:"manage", reports:"view", assistant:"view" },
  technician: { dashboard:"view", map:"view", assets:"view", tags:"none", locations:"none", documents:"view", orders:"operate", preventivePlans:"none", checklists:"operate", stock:"none", suppliers:"none", resources:"none", reports:"view", assistant:"view" },
  warehouse: { dashboard:"view", map:"none", assets:"view", tags:"none", locations:"none", documents:"none", orders:"view", preventivePlans:"none", checklists:"none", stock:"manage", suppliers:"manage", resources:"none", reports:"none", assistant:"none" },
  requester: { dashboard:"view", map:"none", assets:"none", tags:"none", locations:"none", documents:"none", orders:"operate", preventivePlans:"none", checklists:"none", stock:"none", suppliers:"none", resources:"none", reports:"none", assistant:"none" },
  viewer: { dashboard:"view", map:"view", assets:"view", tags:"none", locations:"none", documents:"view", orders:"view", preventivePlans:"view", checklists:"none", stock:"none", suppliers:"none", resources:"none", reports:"view", assistant:"none" },
};

const ROLES: Record<string, string> = {
  admin: "administrator", supervisor: "supervisor", technician: "technician",
  warehouse: "warehouse", requester: "requester", viewer: "viewer",
};

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
    headers: { ...cors(req), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function normalizeUsername(value: unknown) {
  return String(value ?? "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9._-]+/g, ".").replace(/[._-]{2,}/g, ".")
    .replace(/^[._-]+|[._-]+$/g, "").slice(0, 48);
}

function authEmail(slug: string, username: string) {
  return `${username}.${slug.replace(/[^a-z0-9]+/g, "").slice(0, 48)}@login.gestman365.com.br`;
}

function cleanString(value: unknown, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

function profileOf(value: unknown) {
  const profile = cleanString(value, 30);
  return Object.hasOwn(TEMPLATES, profile) ? profile : "technician";
}

function permissionLevels(profile: string, value: unknown) {
  if (profile === "admin") return TEMPLATES.admin;
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return Object.fromEntries(MODULES.map((key) => {
    const level = String(source[key] ?? TEMPLATES[profile][key] ?? "none");
    return [key, LEVELS.has(level) ? level : TEMPLATES[profile][key] ?? "none"];
  }));
}

function friendlyError(error: unknown) {
  const message = String((error as { message?: string })?.message ?? error ?? "");
  if (/already|registered|exists|duplicate|23505/i.test(message)) return "Já existe um usuário com este nome de acesso nesta empresa.";
  if (/password/i.test(message)) return "A senha deve ter entre 8 e 128 caracteres.";
  if (/PRIMARY_ADMIN|SELF_DEACTIVATION/i.test(message)) return "O administrador principal não pode ser desativado, excluído ou rebaixado.";
  if (/ADMIN_REQUIRED/i.test(message)) return "Somente um administrador ativo pode gerenciar usuários.";
  return "Não foi possível concluir a operação do usuário no Supabase.";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") return json(req, 405, { error: "Método não permitido." });
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) return json(req, 503, { error: "Serviço temporariamente indisponível." });

  const origin = req.headers.get("origin") ?? "";
  if (origin && origin !== APP_ORIGIN && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    return json(req, 403, { error: "Origem não autorizada." });
  }
  const authorization = req.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return json(req, 401, { error: "Autenticação necessária." });

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const token = authorization.slice(7);
  const { data: actorData, error: actorError } = await userClient.auth.getUser(token);
  if (actorError || !actorData.user) return json(req, 401, { error: "Sessão inválida ou expirada." });

  const { data: contexts, error: contextError } = await userClient.rpc("gm_current_context");
  const context = Array.isArray(contexts) ? contexts[0] : contexts;
  if (contextError || !context?.company_id || context.member_role !== "administrator") {
    return json(req, 403, { error: "Somente um administrador ativo pode gerenciar usuários." });
  }

  let input: Record<string, unknown>;
  try { input = await req.json(); } catch { return json(req, 400, { error: "Dados inválidos." }); }
  const action = cleanString(input.action, 30).toLowerCase();
  const service = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

  if (action === "list") {
    const { data, error } = await userClient.rpc("gm_list_company_users");
    if (error) return json(req, 422, { error: friendlyError(error) });
    return json(req, 200, { ok: true, users: data ?? [] });
  }

  if (action === "set_active") {
    const userId = cleanString(input.user_id, 64);
    if (!userId) return json(req, 400, { error: "Usuário não informado." });
    const { error } = await service.rpc("gm_set_company_user_active_internal", {
      p_actor_user_id: actorData.user.id, p_company_id: context.company_id,
      p_user_id: userId, p_active: input.active === true,
    });
    if (error) return json(req, 422, { error: friendlyError(error) });
    return json(req, 200, { ok: true, user_id: userId, active: input.active === true });
  }

  if (action === "delete") {
    const userId = cleanString(input.user_id, 64);
    if (!userId || userId === actorData.user.id) return json(req, 422, { error: "Você não pode excluir o próprio usuário logado." });
    const { data: members, error: membersError } = await service.from("gm_company_members")
      .select("user_id,role,created_at").eq("company_id", context.company_id).order("created_at", { ascending: true });
    if (membersError || !members?.some((item) => item.user_id === userId)) return json(req, 404, { error: "Usuário não encontrado nesta empresa." });
    const primaryAdmin = members.find((item) => item.role === "administrator")?.user_id;
    if (userId === primaryAdmin) return json(req, 422, { error: "O administrador principal não pode ser excluído." });
    await service.from("gm_audit_log").insert({ company_id: context.company_id, user_id: actorData.user.id, action: "user.delete", entity: "company_user", entity_id: userId, metadata: {} });
    const { error } = await service.auth.admin.deleteUser(userId);
    if (error) return json(req, 422, { error: friendlyError(error) });
    return json(req, 200, { ok: true, user_id: userId });
  }

  if (!(["create", "update"].includes(action))) return json(req, 400, { error: "Ação inválida." });
  const username = normalizeUsername(input.username);
  const password = String(input.password ?? "");
  const displayName = cleanString(input.display_name, 160);
  const accessProfile = profileOf(input.access_profile);
  if (username.length < 2 || !displayName) return json(req, 400, { error: "Informe nome e usuário de acesso válidos." });
  if (action === "create" && (password.length < 8 || password.length > 128)) return json(req, 400, { error: "A senha inicial deve ter entre 8 e 128 caracteres." });
  if (action === "update" && password && (password.length < 8 || password.length > 128)) return json(req, 400, { error: "A nova senha deve ter entre 8 e 128 caracteres." });

  const email = authEmail(context.company_slug, username);
  const metadata = { display_name: displayName, access_username: username, company_slug: context.company_slug, access_profile: accessProfile };
  let userId = cleanString(input.user_id, 64);
  let createdUser = false;
  if (action === "create") {
    const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: metadata });
    if (error || !data.user?.id) return json(req, /already|registered|exists/i.test(String(error?.message ?? "")) ? 409 : 422, { error: friendlyError(error) });
    userId = data.user.id;
    createdUser = true;
  } else {
    const update: Record<string, unknown> = { email, email_confirm: true, user_metadata: metadata };
    if (password) update.password = password;
    const { error } = await service.auth.admin.updateUserById(userId, update);
    if (error) return json(req, 422, { error: friendlyError(error) });
  }

  const details = input.details && typeof input.details === "object" ? input.details : {};
  const { error: upsertError } = await service.rpc("gm_upsert_company_user_internal", {
    p_actor_user_id: actorData.user.id,
    p_company_id: context.company_id,
    p_user_id: userId,
    p_display_name: displayName,
    p_contact_email: cleanString(input.contact_email, 320) || null,
    p_job_title: cleanString(input.job_title, 160) || null,
    p_avatar_url: cleanString(input.avatar_url, 2500000) || null,
    p_access_username: username,
    p_member_role: ROLES[accessProfile],
    p_access_profile: accessProfile,
    p_permission_levels: permissionLevels(accessProfile, input.permission_levels),
    p_region_id: cleanString(input.region_id, 160) || null,
    p_executor: input.executor === true,
    p_active: input.active !== false,
    p_details: details,
  });
  if (upsertError) {
    if (createdUser) await service.auth.admin.deleteUser(userId);
    return json(req, 422, { error: friendlyError(upsertError) });
  }

  return json(req, action === "create" ? 201 : 200, {
    ok: true,
    access_ready: input.active !== false,
    user: { user_id: userId, auth_email: email, access_username: username, display_name: displayName,
      contact_email: cleanString(input.contact_email, 320), job_title: cleanString(input.job_title, 160),
      avatar_url: cleanString(input.avatar_url, 2500000), member_role: ROLES[accessProfile], access_profile: accessProfile,
      permission_levels: permissionLevels(accessProfile, input.permission_levels), region_id: cleanString(input.region_id, 160),
      executor: input.executor === true, active: input.active !== false, profile_details: details },
  });
});
