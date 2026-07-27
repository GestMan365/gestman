import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { loadOfficialStagingEnv } from "../../../scripts/e2e-official-env.mjs";

export const env = loadOfficialStagingEnv();
export const bucket = "gestman-attachments";
export const marker = "QA-E2E-STAGING-";
export const fixtureFile = path.join(env.root, "supabase", ".temp", "official-e2e-fixture.json");

export const fixture = Object.freeze({
  slugA: "qa-e2e-staging-a",
  slugB: "qa-e2e-staging-b",
  convertedSlug: "qa-e2e-staging-converted",
  companyAName: `${marker}EMPRESA-A`,
  companyBName: `${marker}EMPRESA-B`,
  adminAUsername: "admin.a",
  adminBUsername: "admin.b",
  operatorAUsername: "operador.a",
  inactiveUsername: "inativo.a",
  platformUsername: "platform.qa",
  requestCnpj: "11222333000181",
  requestEmail: "qa-e2e-staging-request@example.invalid",
  attachmentName: `${marker}attachment.txt`,
});

export function authEmail(slug, username) {
  return `${username}.${slug.replace(/[^a-z0-9]+/g, "").slice(0, 48)}@login.gestman365.com.br`;
}

export async function api(pathname, {
  method = "GET",
  key = env.serviceRoleKey,
  token = key,
  body,
  headers = {},
} = {}) {
  const response = await fetch(`${env.url}${pathname}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...headers,
    },
    body: body === undefined
      ? undefined
      : typeof body === "string" || body instanceof Uint8Array
      ? body
      : JSON.stringify(body),
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  return { status: response.status, payload, headers: response.headers };
}

export async function createAuthUser(email, displayName, metadata = {}) {
  const result = await api("/auth/v1/admin/users", {
    method: "POST",
    body: {
      email,
      password: env.qaPassword,
      email_confirm: true,
      user_metadata: {
        qa_marker: marker,
        display_name: displayName,
        ...metadata,
      },
    },
  });
  if (![200, 201].includes(result.status) || !result.payload?.id) {
    throw new Error(`Unable to create QA Auth user (${result.status}).`);
  }
  return result.payload;
}

export async function signIn(email, password = env.qaPassword) {
  const result = await api("/auth/v1/token?grant_type=password", {
    method: "POST",
    key: env.publishableKey,
    token: env.publishableKey,
    body: { email, password },
  });
  if (result.status !== 200 || !result.payload?.access_token) {
    throw new Error(`Unable to create QA session (${result.status}).`);
  }
  return result.payload;
}

export async function bootstrap(token, slug, name) {
  const result = await api("/functions/v1/bootstrap-company", {
    method: "POST",
    key: env.publishableKey,
    token,
    headers: { "x-idempotency-key": `${marker.toLowerCase()}${slug}-0001` },
    body: { name, slug, display_name: `${name} Administrador` },
  });
  if (![200, 201].includes(result.status)) {
    throw new Error(`Unable to bootstrap ${slug} (${result.status}).`);
  }
  return result;
}

export async function rows(table, query = "") {
  return api(`/rest/v1/${table}?${query}`);
}

export async function serviceInsert(table, body) {
  return api(`/rest/v1/${table}`, {
    method: "POST",
    body,
    headers: { Prefer: "return=representation" },
  });
}

async function deleteMatchingStorageObjects(companyIds) {
  for (const companyId of companyIds.filter(Boolean)) {
    const knownPath = `${companyId}/documents/${fixture.attachmentName}`;
    await api(`/storage/v1/object/${bucket}`, {
      method: "DELETE",
      body: { prefixes: [knownPath, `${companyId}/escape.txt`] },
    });
  }
}

export async function cleanupQa() {
  const companyResult = await rows("gm_companies", "select=id,slug&slug=like.qa-e2e-staging-*");
  const companyIds = Array.isArray(companyResult.payload)
    ? companyResult.payload.map((item) => item.id)
    : [];
  await deleteMatchingStorageObjects(companyIds);

  await api(`/rest/v1/company_requests?trade_name=like.${encodeURIComponent(`${marker}*`)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
  await api("/rest/v1/gm_companies?slug=like.qa-e2e-staging-*", {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });

  const listed = await api("/auth/v1/admin/users?per_page=1000");
  const users = Array.isArray(listed.payload?.users) ? listed.payload.users : [];
  for (const user of users) {
    const email = String(user.email || "").toLowerCase();
    const metadata = user.user_metadata || {};
    if (
      metadata.qa_marker === marker
      || email.includes("qae2estaging")
      || String(metadata.company_slug || "").startsWith("qa-e2e-staging-")
    ) {
      const hash = createHash("sha256")
        .update(`bootstrap-company:${user.id}`)
        .digest("hex");
      await api(`/rest/v1/gm_public_rate_limits?key_hash=eq.${hash}`, {
        method: "DELETE",
        headers: { Prefer: "return=minimal" },
      });
      await api(`/auth/v1/admin/users/${encodeURIComponent(user.id)}`, {
        method: "DELETE",
      });
    }
  }

  if (fs.existsSync(fixtureFile)) fs.rmSync(fixtureFile, { force: true });
}

export async function cleanupSummary() {
  const [companies, requests, profiles, objects] = await Promise.all([
    rows("gm_companies", "select=id&slug=like.qa-e2e-staging-*"),
    rows("company_requests", `select=id&trade_name=like.${encodeURIComponent(`${marker}*`)}`),
    rows("gm_profiles", `select=user_id&display_name=like.${encodeURIComponent(`${marker}*`)}`),
    api(`/storage/v1/object/list/${bucket}`, {
      method: "POST",
      body: { prefix: "", limit: 1000, offset: 0 },
    }),
  ]);
  const listed = await api("/auth/v1/admin/users?per_page=1000");
  const users = Array.isArray(listed.payload?.users)
    ? listed.payload.users.filter((user) =>
      user.user_metadata?.qa_marker === marker
      || String(user.email || "").toLowerCase().includes("qae2estaging"))
    : [];
  const storage = Array.isArray(objects.payload)
    ? objects.payload.filter((item) => String(item.name || "").includes(marker))
    : [];
  return {
    companies: companies.payload?.length ?? -1,
    requests: requests.payload?.length ?? -1,
    profiles: profiles.payload?.length ?? -1,
    users: users.length,
    storage: storage.length,
  };
}
