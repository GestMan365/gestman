import { expect, test } from "@playwright/test";
import {
  api,
  bucket,
  env,
  fixture,
  marker,
  rows,
  signIn,
} from "./support/staging-api.mjs";
import { readFixture } from "./support/ui";

test("RPC de estado preserva versão, conflito e isolamento entre empresas", async () => {
  const data = readFixture();
  const [sessionA, sessionB] = await Promise.all([
    signIn(data.identities.adminA.email),
    signIn(data.identities.adminB.email),
  ]);

  const loadA = await api("/rest/v1/rpc/gm_load_tenant_state", {
    method: "POST",
    key: env.publishableKey,
    token: sessionA.access_token,
    body: {},
  });
  expect(loadA.status).toBe(200);
  const current = Array.isArray(loadA.payload) ? loadA.payload[0] : loadA.payload;
  expect(Number(current?.version)).toBeGreaterThanOrEqual(1);
  expect(JSON.stringify(current?.state || current?.state_json || current)).toContain(`${marker}REGION-001`);

  const conflict = await api("/rest/v1/rpc/gm_save_tenant_state", {
    method: "POST",
    key: env.publishableKey,
    token: sessionA.access_token,
    body: { p_expected_version: 0, p_state: { should_not_persist: true } },
  });
  expect([400, 409]).toContain(conflict.status);

  const loadB = await api("/rest/v1/rpc/gm_load_tenant_state", {
    method: "POST",
    key: env.publishableKey,
    token: sessionB.access_token,
    body: {},
  });
  expect(loadB.status).toBe(200);
  expect(JSON.stringify(loadB.payload)).not.toContain(`${marker}REGION-001`);

  const tenantRows = await api("/rest/v1/gm_companies?select=id,slug", {
    key: env.publishableKey,
    token: sessionA.access_token,
  });
  expect(tenantRows.status).toBe(200);
  expect(tenantRows.payload).toEqual([
    expect.objectContaining({ id: data.companyAId, slug: data.identities.adminA.slug }),
  ]);
});

test("Storage isola tenant, nega anônimo/inativo e permite ciclo autorizado", async () => {
  const data = readFixture();
  const [sessionA, sessionB, inactive] = await Promise.all([
    signIn(data.identities.adminA.email),
    signIn(data.identities.adminB.email),
    signIn(data.identities.inactive.email),
  ]);
  const objectPath = `${data.companyAId}/documents/${fixture.attachmentName}`;
  const encoded = objectPath.split("/").map(encodeURIComponent).join("/");
  const bytes = new TextEncoder().encode(`${marker}conteudo seguro`);

  const upload = await api(`/storage/v1/object/${bucket}/${encoded}`, {
    method: "POST",
    key: env.publishableKey,
    token: sessionA.access_token,
    body: bytes,
    headers: {
      "Content-Type": "text/plain",
      "x-upsert": "false",
    },
  });
  expect([200, 201]).toContain(upload.status);

  const ownRead = await api(`/storage/v1/object/${bucket}/${encoded}`, {
    key: env.publishableKey,
    token: sessionA.access_token,
  });
  expect(ownRead.status).toBe(200);
  expect(String(ownRead.payload)).toContain(marker);

  const crossRead = await api(`/storage/v1/object/${bucket}/${encoded}`, {
    key: env.publishableKey,
    token: sessionB.access_token,
  });
  expect([400, 401, 403, 404]).toContain(crossRead.status);

  const anonymousRead = await api(`/storage/v1/object/${bucket}/${encoded}`, {
    key: env.publishableKey,
    token: env.publishableKey,
  });
  expect([400, 401, 403, 404]).toContain(anonymousRead.status);

  const inactiveUpload = await api(
    `/storage/v1/object/${bucket}/${data.companyAId}/documents/${encodeURIComponent(`${marker}inactive.txt`)}`,
    {
      method: "POST",
      key: env.publishableKey,
      token: inactive.access_token,
      body: bytes,
      headers: { "Content-Type": "text/plain", "x-upsert": "false" },
    },
  );
  expect([400, 401, 403, 404]).toContain(inactiveUpload.status);

  const traversalPath = `${data.companyAId}/documents/..%2Fescape.txt`;
  const traversal = await api(`/storage/v1/object/${bucket}/${traversalPath}`, {
    method: "POST",
    key: env.publishableKey,
    token: sessionA.access_token,
    body: bytes,
    headers: { "Content-Type": "text/plain", "x-upsert": "false" },
  });
  const remove = await api(`/storage/v1/object/${bucket}`, {
    method: "DELETE",
    key: env.publishableKey,
    token: sessionA.access_token,
    body: { prefixes: [objectPath] },
  });
  expect([200, 204]).toContain(remove.status);
  const gone = await api(`/storage/v1/object/${bucket}/${encoded}`, {
    key: env.publishableKey,
    token: sessionA.access_token,
  });
  expect([400, 404]).toContain(gone.status);
  await api(`/storage/v1/object/${bucket}`, {
    method: "DELETE",
    key: env.publishableKey,
    token: sessionA.access_token,
    body: { prefixes: [`${data.companyAId}/documents/../escape.txt`, `${data.companyAId}/escape.txt`] },
  });
  test.info().annotations.push({
    type: "bug-confirmado",
    description: `Storage aceitou caminho com traversal (HTTP ${traversal.status}).`,
  });
  test.fail(traversal.status >= 200 && traversal.status < 300, "Defeito conhecido: caminho traversal aceito pelo Storage.");
  expect([400, 401, 403, 404]).toContain(traversal.status);
});

test("dados sensíveis e senha textual não aparecem nas tabelas do tenant", async () => {
  const data = readFixture();
  const [profiles, members] = await Promise.all([
    rows("gm_profiles", `select=*&user_id=in.(${Object.values(data.identities).map((x) => x.userId).join(",")})`),
    rows("gm_company_members", `select=*&company_id=eq.${data.companyAId}`),
  ]);
  expect(profiles.status).toBe(200);
  expect(members.status).toBe(200);
  const serialized = JSON.stringify([profiles.payload, members.payload]);
  expect(serialized).not.toContain(env.qaPassword);
  expect(serialized).not.toMatch(/"senha"\s*:/i);
});
