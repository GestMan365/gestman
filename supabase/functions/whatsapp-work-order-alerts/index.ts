// deno-lint-ignore no-import-prefix
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const WHATSAPP_ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN") ?? "";
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") ?? "";
const WHATSAPP_GRAPH_API_VERSION = Deno.env.get("WHATSAPP_GRAPH_API_VERSION") ??
  "";
const WHATSAPP_TEMPLATE_WORK_ORDER =
  Deno.env.get("WHATSAPP_TEMPLATE_WORK_ORDER") ?? "";
const WHATSAPP_TEMPLATE_LANGUAGE = Deno.env.get("WHATSAPP_TEMPLATE_LANGUAGE") ??
  "pt_BR";
const WHATSAPP_TEMPLATE_TEST = Deno.env.get("WHATSAPP_TEMPLATE_TEST") ??
  "hello_world";
const WHATSAPP_TEMPLATE_TEST_LANGUAGE =
  Deno.env.get("WHATSAPP_TEMPLATE_TEST_LANGUAGE") ?? "en_US";
const WHATSAPP_SETTINGS_ENCRYPTION_KEY =
  Deno.env.get("WHATSAPP_SETTINGS_ENCRYPTION_KEY") ?? "";
const DEFAULT_APP_ORIGIN = "https://app.gestman.com.br";
const APP_ORIGIN = Deno.env.get("GESTMAN_APP_ORIGIN") ?? DEFAULT_APP_ORIGIN;
const ALLOWED_APP_ORIGINS = new Set([
  APP_ORIGIN,
  DEFAULT_APP_ORIGIN,
  "https://gestman365.github.io",
]);
const EVENT_TYPES = new Set([
  "created",
  "status_changed",
  "assigned",
  "priority_changed",
  "test",
]);
const MAX_EVENTS = 10;
const MAX_RECIPIENTS = 5;

type JsonRecord = Record<string, unknown>;

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

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function records(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.map(record) : [];
}

function text(value: unknown, max = 240) {
  return String(value ?? "").trim().slice(0, max);
}

function digits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function phone(value: unknown) {
  const normalized = digits(value);
  return /^\d{10,15}$/.test(normalized) ? normalized : "";
}

function eventLabel(type: string) {
  return ({
    created: "Nova ordem de serviço",
    status_changed: "Status da ordem atualizado",
    assigned: "Responsável da ordem atualizado",
    priority_changed: "Prioridade da ordem atualizada",
    test: "Teste de integração",
  } as Record<string, string>)[type] ?? "Atualização da ordem de serviço";
}

function configured() {
  return Boolean(
    SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY && WHATSAPP_ACCESS_TOKEN &&
      /^\d+$/.test(WHATSAPP_PHONE_NUMBER_ID) &&
      /^v\d+\.\d+$/.test(WHATSAPP_GRAPH_API_VERSION) &&
      /^[a-z0-9_]{3,512}$/.test(WHATSAPP_TEMPLATE_WORK_ORDER) &&
      /^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(WHATSAPP_TEMPLATE_LANGUAGE) &&
      encryptionKeyBytes() !== null,
  );
}

function testConfigured() {
  return Boolean(
    SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY && WHATSAPP_ACCESS_TOKEN &&
      /^\d+$/.test(WHATSAPP_PHONE_NUMBER_ID) &&
      /^v\d+\.\d+$/.test(WHATSAPP_GRAPH_API_VERSION) &&
      /^[a-z0-9_]{3,512}$/.test(WHATSAPP_TEMPLATE_TEST) &&
      /^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(WHATSAPP_TEMPLATE_TEST_LANGUAGE) &&
      encryptionKeyBytes() !== null,
  );
}

function missingConfiguration() {
  const missing: string[] = [];
  if (!WHATSAPP_ACCESS_TOKEN) missing.push("WHATSAPP_ACCESS_TOKEN");
  if (!/^\d+$/.test(WHATSAPP_PHONE_NUMBER_ID)) {
    missing.push("WHATSAPP_PHONE_NUMBER_ID");
  }
  if (!/^v\d+\.\d+$/.test(WHATSAPP_GRAPH_API_VERSION)) {
    missing.push("WHATSAPP_GRAPH_API_VERSION");
  }
  if (!/^[a-z0-9_]{3,512}$/.test(WHATSAPP_TEMPLATE_WORK_ORDER)) {
    missing.push("WHATSAPP_TEMPLATE_WORK_ORDER");
  }
  if (!/^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(WHATSAPP_TEMPLATE_LANGUAGE)) {
    missing.push("WHATSAPP_TEMPLATE_LANGUAGE");
  }
  if (!encryptionKeyBytes()) missing.push("WHATSAPP_SETTINGS_ENCRYPTION_KEY");
  return missing;
}

function missingTestConfiguration() {
  const missing: string[] = [];
  if (!WHATSAPP_ACCESS_TOKEN) missing.push("WHATSAPP_ACCESS_TOKEN");
  if (!/^\d+$/.test(WHATSAPP_PHONE_NUMBER_ID)) {
    missing.push("WHATSAPP_PHONE_NUMBER_ID");
  }
  if (!/^v\d+\.\d+$/.test(WHATSAPP_GRAPH_API_VERSION)) {
    missing.push("WHATSAPP_GRAPH_API_VERSION");
  }
  if (!/^[a-z0-9_]{3,512}$/.test(WHATSAPP_TEMPLATE_TEST)) {
    missing.push("WHATSAPP_TEMPLATE_TEST");
  }
  if (!/^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(WHATSAPP_TEMPLATE_TEST_LANGUAGE)) {
    missing.push("WHATSAPP_TEMPLATE_TEST_LANGUAGE");
  }
  if (!encryptionKeyBytes()) missing.push("WHATSAPP_SETTINGS_ENCRYPTION_KEY");
  return missing;
}

function createServiceClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}

function encryptionKeyBytes() {
  const raw = WHATSAPP_SETTINGS_ENCRYPTION_KEY.trim();
  try {
    if (/^[a-f0-9]{64}$/i.test(raw)) {
      return new Uint8Array(
        raw.match(/.{2}/g)!.map((part) => parseInt(part, 16)),
      );
    }
    const decoded = Uint8Array.from(
      atob(raw),
      (character) => character.charCodeAt(0),
    );
    return decoded.length === 32 ? decoded : null;
  } catch {
    return null;
  }
}

function bytesToBase64(value: Uint8Array) {
  let binary = "";
  value.forEach((byte) => binary += String.fromCharCode(byte));
  return btoa(binary);
}

function base64ToBytes(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

function settingsCryptoKey() {
  const key = encryptionKeyBytes();
  if (!key) throw new Error("WHATSAPP_SETTINGS_ENCRYPTION_KEY_INVALID");
  return crypto.subtle.importKey("raw", key, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

async function encryptRecipients(recipients: string[]) {
  if (!recipients.length) return { ciphertext: "", iv: "" };
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await settingsCryptoKey(),
    new TextEncoder().encode(JSON.stringify(recipients)),
  );
  return {
    ciphertext: bytesToBase64(new Uint8Array(encrypted)),
    iv: bytesToBase64(iv),
  };
}

async function decryptRecipients(ciphertext: unknown, iv: unknown) {
  const encrypted = text(ciphertext, 12000);
  const initializationVector = text(iv, 100);
  if (!encrypted || !initializationVector) return [];
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(initializationVector) },
    await settingsCryptoKey(),
    base64ToBytes(encrypted),
  );
  const parsed = JSON.parse(new TextDecoder().decode(decrypted));
  return Array.isArray(parsed)
    ? [...new Set(parsed.map(phone).filter(Boolean))].slice(0, MAX_RECIPIENTS)
    : [];
}

function canTrigger(context: JsonRecord) {
  if (text(context.member_role, 40) === "administrator") return true;
  const permissions = record(context.permission_levels);
  const explicit = text(permissions.orders, 20);
  if (explicit) return ["operate", "manage"].includes(explicit);
  return ["supervisor", "technician", "requester"].includes(
    text(context.access_profile, 40),
  );
}

function isDemoOrder(order: JsonRecord) {
  return text(order.demoBatchId, 80) === "gestman365-demo-v1" ||
    order.demo === true;
}

function orderFingerprint(order: JsonRecord, eventType: string) {
  const executorIds = Array.isArray(order.executorIds)
    ? [...order.executorIds].map(String).sort()
    : [];
  const fields: JsonRecord = {
    order_id: text(order.id, 160),
    event_type: eventType,
    updated_at: order.updatedAt ?? "",
  };
  if (eventType === "created") fields.created_at = order.createdAt ?? "";
  if (eventType === "status_changed") {
    fields.status = text(order.status, 80);
    fields.started_at = order.startedAt ?? "";
    fields.finished_at = order.finishedAt ?? "";
  }
  if (eventType === "assigned") {
    fields.executor = text(order.executor, 180);
    fields.executor_ids = executorIds;
  }
  if (eventType === "priority_changed") {
    fields.priority = text(order.priority, 80);
  }
  if (eventType === "test") fields.test_window = Math.floor(Date.now() / 60000);
  return JSON.stringify(fields);
}

function notificationEnabled(settings: JsonRecord, eventType: string) {
  if (eventType === "test") return true;
  if (settings.enabled !== true) return false;
  if (eventType === "created") return settings.notifyOnCreate !== false;
  if (eventType === "status_changed") return settings.notifyOnStatus !== false;
  if (eventType === "assigned") return settings.notifyOnAssignment !== false;
  if (eventType === "priority_changed") {
    return settings.notifyOnPriority === true;
  }
  return false;
}

function defaultNotificationSettings(): JsonRecord {
  return {
    enabled: false,
    recipients: [],
    notifyOnCreate: true,
    notifyOnStatus: true,
    notifyOnAssignment: true,
    notifyOnPriority: false,
  };
}

async function loadNotificationSettings(
  service: ReturnType<typeof createServiceClient>,
  companyId: string,
) {
  const { data, error } = await service.from("gm_whatsapp_settings")
    .select(
      "enabled,recipient_ciphertext,recipient_iv,recipient_last4,notify_on_create,notify_on_status,notify_on_assignment,notify_on_priority,updated_at",
    )
    .eq("company_id", companyId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return defaultNotificationSettings();
  const recipients = await decryptRecipients(
    data.recipient_ciphertext,
    data.recipient_iv,
  );
  return {
    enabled: data.enabled === true,
    recipients,
    recipientLast4: Array.isArray(data.recipient_last4)
      ? data.recipient_last4.map((item) => text(item, 4))
      : [],
    notifyOnCreate: data.notify_on_create !== false,
    notifyOnStatus: data.notify_on_status !== false,
    notifyOnAssignment: data.notify_on_assignment !== false,
    notifyOnPriority: data.notify_on_priority === true,
    updatedAt: data.updated_at ?? "",
  };
}

async function saveNotificationSettings(
  service: ReturnType<typeof createServiceClient>,
  companyId: string,
  actorId: string,
  input: JsonRecord,
) {
  const rawRecipients = Array.isArray(input.recipients)
    ? input.recipients.slice(0, MAX_RECIPIENTS + 1)
    : [];
  const recipients = [
    ...new Set(
      rawRecipients.map((item) =>
        phone(typeof item === "string" ? item : record(item).phone)
      ).filter(Boolean),
    ),
  ].slice(0, MAX_RECIPIENTS);
  if (
    rawRecipients.length > MAX_RECIPIENTS ||
    rawRecipients.some((item) =>
      !phone(typeof item === "string" ? item : record(item).phone)
    )
  ) {
    throw new Error("WHATSAPP_RECIPIENTS_INVALID");
  }
  const enabled = input.enabled === true;
  if (enabled && !recipients.length) {
    throw new Error("WHATSAPP_RECIPIENTS_REQUIRED");
  }
  const encrypted = await encryptRecipients(recipients);
  const { error } = await service.from("gm_whatsapp_settings").upsert({
    company_id: companyId,
    enabled,
    recipient_ciphertext: encrypted.ciphertext,
    recipient_iv: encrypted.iv,
    recipient_last4: recipients.map((item) => item.slice(-4)),
    notify_on_create: input.notifyOnCreate !== false,
    notify_on_status: input.notifyOnStatus !== false,
    notify_on_assignment: input.notifyOnAssignment !== false,
    notify_on_priority: input.notifyOnPriority === true,
    updated_by: actorId,
  }, { onConflict: "company_id" });
  if (error) throw error;
  return {
    ...defaultNotificationSettings(),
    enabled,
    recipients,
    notifyOnCreate: input.notifyOnCreate !== false,
    notifyOnStatus: input.notifyOnStatus !== false,
    notifyOnAssignment: input.notifyOnAssignment !== false,
    notifyOnPriority: input.notifyOnPriority === true,
  };
}

function formatDate(value: unknown) {
  const raw = text(value, 80);
  if (!raw) return "Não informado";
  const parsed = new Date(/^\d+$/.test(raw) ? Number(raw) : raw);
  return Number.isFinite(parsed.getTime())
    ? parsed.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
    : raw.slice(0, 40);
}

function templatePayload(
  companyName: string,
  state: JsonRecord,
  order: JsonRecord,
  eventType: string,
  recipient: string,
) {
  const assets = records(state.assets);
  const asset =
    assets.find((item) => text(item.id, 160) === text(order.assetId, 160)) ??
      {};
  const assetLabel =
    [text(asset.code, 80), text(asset.name, 140)].filter(Boolean).join(" - ") ||
    "Equipamento não disponível";
  const values = [
    text(companyName, 160) || "Empresa",
    eventLabel(eventType),
    text(order.number, 80) || "Sem número",
    assetLabel,
    text(order.status, 80) || "Não informado",
    text(order.priority, 80) || "Não informada",
    text(order.executor, 160) || "Não atribuído",
    formatDate(order.scheduledAt),
  ];
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: recipient,
    type: "template",
    template: {
      name: WHATSAPP_TEMPLATE_WORK_ORDER,
      language: { code: WHATSAPP_TEMPLATE_LANGUAGE },
      components: [{
        type: "body",
        parameters: values.map((value) => ({ type: "text", text: value })),
      }],
    },
  };
}

function testTemplatePayload(recipient: string) {
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: recipient,
    type: "template",
    template: {
      name: WHATSAPP_TEMPLATE_TEST,
      language: { code: WHATSAPP_TEMPLATE_TEST_LANGUAGE },
    },
  };
}

async function reserveDelivery(
  service: ReturnType<typeof createServiceClient>,
  companyId: string,
  actorId: string,
  orderId: string,
  eventType: string,
  eventKey: string,
  recipientHash: string,
  recipientLast4: string,
) {
  const { data: existing, error: readError } = await service.from(
    "gm_whatsapp_delivery_log",
  )
    .select("id,status,attempt_count,updated_at")
    .eq("company_id", companyId).eq("event_key", eventKey).eq(
      "recipient_hash",
      recipientHash,
    ).maybeSingle();
  if (readError) throw readError;
  if (existing?.status === "accepted" || existing?.status === "pending") {
    const updatedAt = Date.parse(String(existing.updated_at || ""));
    const pendingIsFresh = existing.status === "pending" &&
      Number.isFinite(updatedAt) && Date.now() - updatedAt < 5 * 60 * 1000;
    if (existing.status === "accepted" || pendingIsFresh) {
      return { id: String(existing.id), send: false };
    }
  }
  if (existing?.id) {
    const attempt = Math.min(10, Number(existing.attempt_count || 1) + 1);
    const { error } = await service.from("gm_whatsapp_delivery_log").update({
      status: "pending",
      attempt_count: attempt,
      error_code: null,
      error_message: null,
      provider_message_id: null,
    }).eq("id", existing.id);
    if (error) throw error;
    return { id: existing.id, send: true };
  }
  const { data, error } = await service.from("gm_whatsapp_delivery_log").insert(
    {
      company_id: companyId,
      order_id: orderId,
      event_key: eventKey,
      event_type: eventType,
      recipient_hash: recipientHash,
      recipient_last4: recipientLast4,
      status: "pending",
      created_by: actorId,
    },
  ).select("id").single();
  if (error) {
    if (String(error.code) === "23505") return { id: "", send: false };
    throw error;
  }
  return { id: String(data.id), send: true };
}

async function sendMetaMessage(payload: JsonRecord) {
  const response = await fetch(
    `https://graph.facebook.com/${WHATSAPP_GRAPH_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );
  const body = record(await response.json().catch(() => ({})));
  if (!response.ok) {
    const providerError = record(body.error);
    const error = new Error(
      text(providerError.message, 500) || `WHATSAPP_HTTP_${response.status}`,
    );
    (error as Error & { code?: string }).code = text(providerError.code, 80) ||
      String(response.status);
    throw error;
  }
  const messages = records(body.messages);
  return text(messages[0]?.id, 300);
}

function safeProviderError(value: unknown) {
  return text(value, 500)
    .replace(/\b\d{8,15}\b/g, "[telefone removido]")
    .replace(/bearer\s+[a-z0-9._~-]+/gi, "Bearer [removido]");
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
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
    return json(req, 503, { error: "Serviço temporariamente indisponível." });
  }

  const authorization = req.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) {
    return json(req, 401, { error: "Autenticação necessária." });
  }
  const token = authorization.slice(7);
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: actorData, error: actorError } = await userClient.auth.getUser(
    token,
  );
  if (actorError || !actorData.user) {
    return json(req, 401, { error: "Sessão inválida ou expirada." });
  }
  const { data: contexts, error: contextError } = await userClient.rpc(
    "gm_current_context",
  );
  const context = record(Array.isArray(contexts) ? contexts[0] : contexts);
  if (contextError || !context.company_id) {
    return json(req, 403, { error: "Empresa ativa não identificada." });
  }

  let input: JsonRecord;
  try {
    input = record(await req.json());
  } catch {
    return json(req, 400, { error: "Dados inválidos." });
  }
  const action = text(input.action, 30).toLowerCase();
  const isAdmin = text(context.member_role, 40) === "administrator";
  const service = createServiceClient();
  const companyId = text(context.company_id, 64);
  if (action === "status") {
    if (!isAdmin) {
      return json(req, 403, {
        error: "Somente o administrador pode consultar a integração.",
      });
    }
    let settings = defaultNotificationSettings();
    if (encryptionKeyBytes()) {
      try {
        settings = await loadNotificationSettings(service, companyId);
      } catch {
        return json(req, 503, {
          error: "A configuração segura do WhatsApp ainda não está disponível.",
        });
      }
    }
    return json(req, 200, {
      ok: true,
      configured: configured(),
      missing: missingConfiguration(),
      testConfigured: testConfigured(),
      testMissing: missingTestConfiguration(),
      settings,
    });
  }
  if (action === "configure") {
    if (!isAdmin) {
      return json(req, 403, {
        error: "Somente o administrador pode configurar a integração.",
      });
    }
    if (!encryptionKeyBytes()) {
      return json(req, 503, {
        error:
          "A chave de proteção dos destinatários ainda não foi configurada.",
      });
    }
    if (record(input.settings).enabled === true && !configured()) {
      return json(req, 409, {
        error:
          "O modo automático permanece bloqueado até o modelo operacional de O.S. ser configurado.",
        missing: missingConfiguration(),
      });
    }
    try {
      const settings = await saveNotificationSettings(
        service,
        companyId,
        actorData.user.id,
        record(input.settings),
      );
      return json(req, 200, { ok: true, settings });
    } catch (error) {
      const code = String((error as Error)?.message || "");
      if (code === "WHATSAPP_RECIPIENTS_INVALID") {
        return json(req, 400, {
          error: "Revise os destinatários. Use DDI, DDD e número.",
        });
      }
      if (code === "WHATSAPP_RECIPIENTS_REQUIRED") {
        return json(req, 400, {
          error: "Informe ao menos um destinatário autorizado.",
        });
      }
      return json(req, 503, {
        error: "Não foi possível salvar a configuração segura do WhatsApp.",
      });
    }
  }
  if (!["send", "test"].includes(action)) {
    return json(req, 400, { error: "Ação inválida." });
  }
  if (!canTrigger(context)) {
    return json(req, 403, {
      error: "Seu perfil não pode disparar avisos de O.S.",
    });
  }
  if (action === "test" && !isAdmin) {
    return json(req, 403, {
      error: "Somente o administrador pode enviar um teste.",
    });
  }
  if (action === "test" && !testConfigured()) {
    return json(req, 503, {
      error: "Ambiente de teste do WhatsApp ainda não configurado no servidor.",
      missing: missingTestConfiguration(),
    });
  }
  if (action === "send" && !configured()) {
    return json(req, 503, {
      error: "Integração WhatsApp ainda não configurada no servidor.",
      missing: missingConfiguration(),
    });
  }
  let settings: JsonRecord;
  try {
    settings = await loadNotificationSettings(service, companyId);
  } catch {
    return json(req, 503, {
      error: "Não foi possível consultar a configuração segura do WhatsApp.",
    });
  }
  if (action === "send" && settings.enabled !== true) {
    return json(req, 200, { ok: true, sent: 0, skipped: 0, disabled: true });
  }
  const recipients = Array.isArray(settings.recipients)
    ? settings.recipients.map(phone).filter(Boolean).slice(0, MAX_RECIPIENTS)
    : [];
  if (!recipients.length) {
    return json(req, 422, {
      error: "Nenhum destinatário válido foi configurado para o WhatsApp.",
    });
  }
  const { data: tenant, error: tenantError } = await service.from(
    "gm_tenant_state",
  ).select("state").eq("company_id", companyId).single();
  if (tenantError || !tenant?.state) {
    return json(req, 422, {
      error: "Não foi possível consultar os dados da empresa.",
    });
  }
  const state = record(tenant.state);

  const orders = records(state.orders);
  let requested = records(input.events).slice(0, MAX_EVENTS).map((item) => ({
    orderId: text(item.order_id, 160),
    eventType: text(item.event_type, 40),
  })).filter((item) =>
    item.orderId && EVENT_TYPES.has(item.eventType) && item.eventType !== "test"
  );
  if (action === "test") {
    const requestedOrderId = text(input.order_id, 160);
    const latest = orders.filter((order) =>
      !isDemoOrder(order) &&
      (!requestedOrderId || text(order.id, 160) === requestedOrderId)
    )
      .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))[0];
    if (!latest) {
      return json(req, 422, {
        error: "Cadastre uma O.S. real antes de enviar o teste.",
      });
    }
    requested = [{ orderId: text(latest.id, 160), eventType: "test" }];
  }
  if (!requested.length) {
    return json(req, 400, {
      error: "Nenhum evento de O.S. válido foi informado.",
    });
  }

  let sent = 0;
  let skipped = 0;
  const failures: JsonRecord[] = [];
  for (const event of requested) {
    const order = orders.find((item) => text(item.id, 160) === event.orderId);
    if (
      !order || isDemoOrder(order) ||
      !notificationEnabled(settings, event.eventType)
    ) {
      skipped += recipients.length;
      continue;
    }
    const eventKey = await sha256(
      `${companyId}:${orderFingerprint(order, event.eventType)}`,
    );
    for (const recipient of recipients) {
      const recipientHash = await sha256(`${companyId}:${recipient}`);
      let deliveryId = "";
      try {
        const reservation = await reserveDelivery(
          service,
          companyId,
          actorData.user.id,
          event.orderId,
          event.eventType,
          eventKey,
          recipientHash,
          recipient.slice(-4),
        );
        deliveryId = reservation.id;
        if (!reservation.send) {
          skipped += 1;
          continue;
        }
        const providerMessageId = await sendMetaMessage(
          event.eventType === "test"
            ? testTemplatePayload(recipient)
            : templatePayload(
              text(context.company_name, 160),
              state,
              order,
              event.eventType,
              recipient,
            ),
        );
        await service.from("gm_whatsapp_delivery_log").update({
          status: "accepted",
          provider_message_id: providerMessageId || null,
        }).eq("id", deliveryId);
        sent += 1;
      } catch (error) {
        const code = text((error as Error & { code?: string })?.code, 80) ||
          "WHATSAPP_SEND_FAILED";
        const message = safeProviderError((error as Error)?.message) ||
          "Falha ao enviar alerta.";
        if (deliveryId) {
          await service.from("gm_whatsapp_delivery_log").update({
            status: "failed",
            error_code: code,
            error_message: message,
          }).eq("id", deliveryId);
        }
        failures.push({
          order_id: event.orderId,
          event_type: event.eventType,
          recipient_last4: recipient.slice(-4),
          code,
        });
      }
    }
  }
  const status = failures.length && !sent ? 502 : 200;
  return json(req, status, {
    ok: failures.length === 0,
    sent,
    skipped,
    failed: failures.length,
    failures,
  });
});
