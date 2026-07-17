import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const EMAIL_FROM = Deno.env.get("GESTMAN_EMAIL_FROM") ?? "";
const NOTIFICATION_EMAIL = Deno.env.get("GESTMAN_REQUEST_EMAIL_TO") ?? "andsantos15@hotmail.com";
const APP_ORIGIN = Deno.env.get("GESTMAN_APP_ORIGIN") ?? "https://gestman365.github.io";

type CompanyRequest = {
  trade_name: string;
  legal_name: string;
  cnpj: string;
  responsible_name: string;
  responsible_role?: string;
  responsible_email: string;
  responsible_phone: string;
  city: string;
  state: string;
  estimated_users?: number | null;
  estimated_units?: number | null;
  message?: string;
  website?: string;
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
    headers: {
      ...cors(req),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function text(value: unknown, max = 200) {
  return String(value ?? "").trim().slice(0, max);
}

function digits(value: unknown, max: number) {
  return String(value ?? "").replace(/\D/g, "").slice(0, max);
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalize(input: Record<string, unknown>): CompanyRequest {
  return {
    trade_name: text(input.trade_name, 160),
    legal_name: text(input.legal_name, 200),
    cnpj: digits(input.cnpj, 14),
    responsible_name: text(input.responsible_name, 160),
    responsible_role: text(input.responsible_role, 120),
    responsible_email: text(input.responsible_email, 200).toLowerCase(),
    responsible_phone: digits(input.responsible_phone, 13),
    city: text(input.city, 120),
    state: text(input.state, 2).toUpperCase(),
    estimated_users: input.estimated_users ? Number(input.estimated_users) : null,
    estimated_units: input.estimated_units ? Number(input.estimated_units) : null,
    message: text(input.message, 4000),
    website: text(input.website, 200),
  };
}

function validate(data: CompanyRequest) {
  if (data.website) return "BOT";
  if ([data.trade_name, data.legal_name, data.responsible_name, data.city].some((value) => value.length < 2)) {
    return "Preencha os dados obrigatórios.";
  }
  if (!/^\d{14}$/.test(data.cnpj)) return "Informe um CNPJ válido.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.responsible_email)) return "Informe um e-mail válido.";
  if (data.responsible_phone.length < 10 || data.responsible_phone.length > 13) return "Informe um telefone válido.";
  if (!/^[A-Z]{2}$/.test(data.state)) return "Selecione um estado válido.";
  if (data.estimated_users !== null && (!Number.isInteger(data.estimated_users) || data.estimated_users < 1 || data.estimated_users > 100000)) {
    return "Quantidade de usuários inválida.";
  }
  if (data.estimated_units !== null && (!Number.isInteger(data.estimated_units) || data.estimated_units < 1 || data.estimated_units > 10000)) {
    return "Quantidade de unidades inválida.";
  }
  return "";
}

function formatCnpj(value: string) {
  return value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

function emailHtml(data: CompanyRequest, requestId: string) {
  const row = (label: string, value: unknown) => `
    <tr>
      <td style="padding:8px 12px;color:#64748b;border-bottom:1px solid #e2e8f0;width:210px">${escapeHtml(label)}</td>
      <td style="padding:8px 12px;color:#0f172a;font-weight:600;border-bottom:1px solid #e2e8f0">${escapeHtml(value || "Não informado")}</td>
    </tr>`;
  return `<!doctype html>
  <html lang="pt-BR"><body style="margin:0;background:#eef4f9;font-family:Arial,sans-serif;color:#0f172a">
    <div style="max-width:720px;margin:24px auto;padding:0 14px">
      <div style="background:#07182b;color:#fff;padding:24px 28px;border-radius:14px 14px 0 0">
        <div style="font-size:12px;letter-spacing:.14em;color:#60a5fa">GESTMAN365</div>
        <h1 style="margin:8px 0 0;font-size:24px">Nova solicitação de empresa</h1>
      </div>
      <div style="background:#fff;padding:24px 28px;border-radius:0 0 14px 14px">
        <p style="margin-top:0;color:#475569">Uma empresa preencheu o formulário público de cadastro.</p>
        <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px">
          ${row("Protocolo", requestId)}
          ${row("Nome fantasia", data.trade_name)}
          ${row("Razão social", data.legal_name)}
          ${row("CNPJ", formatCnpj(data.cnpj))}
          ${row("Responsável", data.responsible_name)}
          ${row("Cargo", data.responsible_role)}
          ${row("E-mail", data.responsible_email)}
          ${row("Telefone/WhatsApp", data.responsible_phone)}
          ${row("Cidade / Estado", `${data.city} / ${data.state}`)}
          ${row("Usuários estimados", data.estimated_users)}
          ${row("Unidades estimadas", data.estimated_units)}
          ${row("Mensagem", data.message)}
        </table>
        <p style="margin:20px 0 0;color:#64748b;font-size:12px">Mensagem automática do cadastro público GestMan365.</p>
      </div>
    </div>
  </body></html>`;
}

function emailText(data: CompanyRequest, requestId: string) {
  return [
    "Nova solicitação de empresa no GestMan365",
    `Protocolo: ${requestId}`,
    `Nome fantasia: ${data.trade_name}`,
    `Razão social: ${data.legal_name}`,
    `CNPJ: ${formatCnpj(data.cnpj)}`,
    `Responsável: ${data.responsible_name}`,
    `Cargo: ${data.responsible_role || "Não informado"}`,
    `E-mail: ${data.responsible_email}`,
    `Telefone/WhatsApp: ${data.responsible_phone}`,
    `Cidade / Estado: ${data.city} / ${data.state}`,
    `Usuários estimados: ${data.estimated_users ?? "Não informado"}`,
    `Unidades estimadas: ${data.estimated_units ?? "Não informado"}`,
    `Mensagem: ${data.message || "Não informada"}`,
  ].join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") return json(req, 405, { error: "Método não permitido." });

  const origin = req.headers.get("origin") ?? "";
  if (origin && origin !== APP_ORIGIN && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    return json(req, 403, { error: "Origem não autorizada." });
  }
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
    return json(req, 503, { error: "O serviço de cadastro ainda não foi configurado." });
  }

  let input: Record<string, unknown>;
  try {
    input = await req.json();
  } catch {
    return json(req, 400, { error: "Dados inválidos." });
  }
  const data = normalize(input);
  const validationError = validate(data);
  if (validationError === "BOT") return json(req, 201, { ok: true });
  if (validationError) return json(req, 400, { error: validationError });

  const publicClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: inserted, error: insertError } = await publicClient.rpc("gm_submit_company_request", {
    p_request: data,
  });
  if (insertError) {
    const duplicate = insertError.code === "23505";
    return json(req, duplicate ? 409 : 422, {
      error: duplicate
        ? "Já existe uma solicitação ou empresa cadastrada para este CNPJ."
        : "Não foi possível registrar a solicitação.",
      code: insertError.code ?? "",
    });
  }

  const requestId = String(inserted?.[0]?.request_id ?? "");
  if (!RESEND_API_KEY || !EMAIL_FROM) {
    return json(req, 201, {
      ok: true,
      request_id: requestId,
      panel_registered: true,
      email_sent: false,
      message: "Solicitação registrada no painel administrativo GestMan365.",
    });
  }

  const mailResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: [NOTIFICATION_EMAIL],
      reply_to: data.responsible_email,
      subject: `Nova solicitação GestMan365 — ${data.trade_name}`,
      html: emailHtml(data, requestId),
      text: emailText(data, requestId),
    }),
  });
  const mailResult = await mailResponse.json().catch(() => ({}));
  const service = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (!mailResponse.ok) {
    const providerError = text(mailResult?.message || `HTTP ${mailResponse.status}`, 500);
    await service.from("company_requests").update({
      notification_email: NOTIFICATION_EMAIL,
      notification_error: providerError,
    }).eq("id", requestId);
    console.error("company_request_email_failed", { requestId, status: mailResponse.status, providerError });
    return json(req, 202, {
      ok: true,
      request_id: requestId,
      panel_registered: true,
      email_sent: false,
      warning: "Solicitação registrada no painel; a notificação interna por e-mail será revisada.",
    });
  }

  await service.from("company_requests").update({
    notification_email: NOTIFICATION_EMAIL,
    notification_sent_at: new Date().toISOString(),
    notification_error: null,
  }).eq("id", requestId);

  return json(req, 201, {
    ok: true,
    request_id: requestId,
    panel_registered: true,
    email_sent: true,
    notification_email: NOTIFICATION_EMAIL,
  });
});
