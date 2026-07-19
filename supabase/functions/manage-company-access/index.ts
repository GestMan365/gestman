import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const APP_ORIGIN = Deno.env.get("GESTMAN_APP_ORIGIN") ?? "https://gestman365.github.io";
const COMPANY_DELETE_PASSWORD = Deno.env.get("GESTMAN_COMPANY_DELETE_PASSWORD") ?? "";

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

function isUuid(value: unknown) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value ?? ""));
}

async function secureEqual(left: string, right: string) {
  const encoder = new TextEncoder();
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right)),
  ]);
  const leftBytes = new Uint8Array(leftHash);
  const rightBytes = new Uint8Array(rightHash);
  let difference = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }
  return difference === 0;
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
  if (userError || !userData.user) return json(req, 401, { error: "Sessão inválida ou expirada." });

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

  const companyId = String(input.company_id ?? "");
  const action = String(input.action ?? "");
  if (!isUuid(companyId)) return json(req, 400, { error: "Empresa inválida." });
  const statusActions = ["suspend_company", "reactivate_company", "archive_company"];
  if (!["inspect", "reset_password", "delete_company", ...statusActions].includes(action)) {
    return json(req, 400, { error: "Ação inválida." });
  }

  const service = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: company, error: companyError } = await userClient
    .from("gm_companies")
    .select("id,name,slug,status")
    .eq("id", companyId)
    .maybeSingle();
  if (companyError || !company) {
    console.error("Falha ao localizar empresa", companyError?.message ?? "registro ausente");
    return json(req, 404, { error: "Empresa não encontrada." });
  }

  const { data: members, error: membersError } = await userClient
    .from("gm_company_members")
    .select("user_id,role,active")
    .eq("company_id", companyId);
  if (membersError) return json(req, 422, { error: "Não foi possível consultar os usuários da empresa." });

  const memberList = Array.isArray(members) ? members : [];
  if (action === "delete_company") {
    if (!COMPANY_DELETE_PASSWORD) {
      return json(req, 503, { error: "A senha de exclusÃ£o ainda nÃ£o foi configurada no servidor." });
    }
    const deletionPassword = String(input.deletion_password ?? "");
    if (!deletionPassword || !(await secureEqual(deletionPassword, COMPANY_DELETE_PASSWORD))) {
      return json(req, 403, { error: "Senha de exclusÃ£o incorreta." });
    }
    if (String(company.slug ?? "").toLowerCase() === "gestman") {
      return json(req, 403, { error: "A empresa da plataforma nÃ£o pode ser excluÃ­da." });
    }

    const memberUserIds = memberList.map((member) => String(member.user_id));
    const protectedAuthUsers = new Set<string>();
    if (memberUserIds.length) {
      const [{ data: otherMemberships }, { data: platformAdmins }] = await Promise.all([
        userClient
          .from("gm_company_members")
          .select("user_id")
          .in("user_id", memberUserIds)
          .neq("company_id", companyId),
        userClient
          .from("gm_platform_admins")
          .select("user_id")
          .in("user_id", memberUserIds)
          .eq("active", true),
      ]);
      [...(otherMemberships ?? []), ...(platformAdmins ?? [])].forEach((entry) => {
        protectedAuthUsers.add(String(entry.user_id));
      });
    }

    const { data: deletedMemberIds, error: deletionError } = await userClient.rpc(
      "gm_permanently_delete_company",
      { p_company_id: companyId },
    );
    if (deletionError) {
      console.error("Falha ao excluir empresa", deletionError.message);
      return json(req, 422, { error: "NÃ£o foi possÃ­vel excluir a empresa e seus dados." });
    }

    const authUserIds = (Array.isArray(deletedMemberIds) ? deletedMemberIds.map(String) : memberUserIds)
      .filter((userId) => !protectedAuthUsers.has(userId));
    const authFailures: string[] = [];
    for (const userId of [...new Set(authUserIds)]) {
      let removed = false;
      for (let attempt = 0; attempt < 3 && !removed; attempt += 1) {
        const { error: authDeleteError } = await service.auth.admin.deleteUser(userId);
        removed = !authDeleteError;
      }
      if (!removed) authFailures.push(userId);
    }

    if (authFailures.length) {
      console.error("Falha ao remover alguns usuarios do Auth", authFailures);
      return json(req, 207, {
        ok: false,
        company_id: companyId,
        database_deleted: true,
        auth_failures: authFailures.length,
        error: "A empresa foi removida, mas alguns usuÃ¡rios do Auth exigem revisÃ£o manual.",
      });
    }

    return json(req, 200, {
      ok: true,
      company_id: companyId,
      database_deleted: true,
      auth_users_deleted: authUserIds.length,
      shared_users_preserved: protectedAuthUsers.size,
    });
  }

  if (action === "inspect") {
    const users = await Promise.all(memberList.map(async (member) => {
      const { data: authData } = await service.auth.admin.getUserById(String(member.user_id));
      const authUser = authData?.user;
      return {
        user_id: member.user_id,
        role: member.role,
        active: member.active !== false,
        username: String(authUser?.user_metadata?.access_username ?? ""),
        display_name: String(authUser?.user_metadata?.display_name ?? ""),
        last_sign_in_at: authUser?.last_sign_in_at ?? null,
      };
    }));
    return json(req, 200, { ok: true, company_id: companyId, users });
  }

  if (statusActions.includes(action)) {
    const rpcAction = {
      suspend_company: "suspend",
      reactivate_company: "reactivate",
      archive_company: "archive",
    }[action] as string;
    const { error: manageError } = await userClient.rpc("gm_manage_company", {
      p_company_id: companyId,
      p_action: rpcAction,
      p_payload: {},
    });
    if (manageError) return json(req, 422, { error: "Não foi possível alterar a situação da empresa." });

    const banDuration = action === "reactivate_company" ? "none" : "876000h";
    const failures: string[] = [];
    for (const member of memberList) {
      const { error: accessError } = await service.auth.admin.updateUserById(String(member.user_id), {
        ban_duration: banDuration,
      });
      if (accessError) failures.push(String(member.user_id));
    }
    if (failures.length) {
      return json(req, 207, {
        ok: false,
        company_id: companyId,
        status_changed: true,
        access_failures: failures.length,
        error: "A situação foi alterada, mas alguns acessos exigem revisão manual.",
      });
    }
    return json(req, 200, {
      ok: true,
      company_id: companyId,
      status_changed: true,
      users_updated: memberList.length,
    });
  }

  const userId = String(input.user_id ?? "");
  const newPassword = String(input.new_password ?? "");
  if (!isUuid(userId) || !memberList.some((member) => String(member.user_id) === userId)) {
    return json(req, 404, { error: "Usuário não pertence a esta empresa." });
  }
  if (newPassword.length < 8 || newPassword.length > 128) {
    return json(req, 400, { error: "A nova senha deve ter entre 8 e 128 caracteres." });
  }
  if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    return json(req, 400, { error: "Use ao menos uma letra maiúscula, uma minúscula e um número." });
  }

  const { error: resetError } = await service.auth.admin.updateUserById(userId, { password: newPassword });
  if (resetError) return json(req, 422, { error: "Não foi possível redefinir a senha." });

  const { error: auditError } = await service.from("gm_platform_audit_log").insert({
    actor_user_id: userData.user.id,
    action: "company.access.password_reset",
    entity: "company",
    entity_id: companyId,
    metadata: { user_id: userId },
  });
  if (auditError) console.error("Falha ao registrar auditoria", auditError.message);

  return json(req, 200, {
    ok: true,
    company_id: companyId,
    user_id: userId,
    password_changed: true,
  });
});
