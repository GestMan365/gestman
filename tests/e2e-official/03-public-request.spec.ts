import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";
import { api, env, fixture, marker, rows } from "./support/staging-api.mjs";

async function fillValidRequest(page: import("@playwright/test").Page) {
  const form = page.locator("#companyRequestForm");
  await form.locator('[name="trade_name"]').fill(`${marker}SOLICITACAO`);
  await form.locator('[name="legal_name"]').fill(`${marker}SOLICITACAO LTDA`);
  await form.locator('[name="cnpj"]').fill(fixture.requestCnpj);
  await form.locator('[name="responsible_name"]').fill(`${marker}RESPONSAVEL`);
  await form.locator('[name="responsible_role"]').fill("QA");
  await form.locator('[name="responsible_email"]').fill(fixture.requestEmail);
  await form.locator('[name="responsible_phone"]').fill("(11) 99999-0001");
  await form.locator('[name="city"]').fill("São Paulo");
  await form.locator('[name="state"]').selectOption("SP");
  await form.locator('[name="estimated_users"]').fill("5");
  await form.locator('[name="estimated_units"]').fill("1");
  await form.locator('[name="message"]').fill(`${marker}VALIDACAO PUBLICA`);
}

function validCnpj(sequence: number) {
  const base = `9000000${String(sequence).padStart(5, "0")}`;
  const digit = (value: string, weights: number[]) => {
    const remainder = value.split("").reduce((sum, number, index) =>
      sum + Number(number) * weights[index], 0) % 11;
    const result = 11 - remainder;
    return result >= 10 ? 0 : result;
  };
  const first = digit(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = digit(`${base}${first}`, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return `${base}${first}${second}`;
}

test("fallback 404 abre onboarding, valida e evita envio duplicado", async ({ page }) => {
  const response = await page.goto("/cadastrar-empresa");
  expect(response?.status()).toBe(404);
  await expect(page.locator("#companyRequestForm")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Cadastre sua empresa/i })).toBeVisible();

  await page.locator("#companyRequestSubmit").click();
  await expect(page.locator('[data-error="trade_name"]')).not.toBeEmpty();
  await page.locator('[name="responsible_email"]').fill("email-invalido");
  await page.locator('[name="responsible_phone"]').fill("123");
  await page.locator('[name="estimated_users"]').fill("100001");
  await page.locator("#companyRequestSubmit").click();
  await expect(page.locator('[data-error="responsible_email"]')).not.toBeEmpty();

  await fillValidRequest(page);
  await page.locator("#companyRequestSubmit").dblclick();
  await expect(page.locator("#companyRequestSuccess")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#companyRequestSuccess")).toContainText(/enviada com sucesso/i);

  const created = await rows(
    "company_requests",
    `select=id,status,trade_name,cnpj&trade_name=eq.${encodeURIComponent(`${marker}SOLICITACAO`)}`,
  );
  expect(created.status).toBe(200);
  expect(created.payload).toHaveLength(1);
  expect(created.payload[0].status).toBe("pending");

  await page.goto("/index.html#cadastrar-empresa");
  await fillValidRequest(page);
  await page.locator("#companyRequestSubmit").click();
  await expect(page.locator("#companyRequestStatus")).toBeVisible();
  await expect(page.locator("#companyRequestStatus")).toContainText(/já|existente|enviada|solicitação/i);
  const duplicateCheck = await rows(
    "company_requests",
    `select=id&trade_name=eq.${encodeURIComponent(`${marker}SOLICITACAO`)}`,
  );
  expect(duplicateCheck.payload).toHaveLength(1);
});

test("onboarding público limita rajadas, preserva idempotência e recupera a interface", async ({ page }) => {
  const startedAt = new Date(Date.now() - 1000).toISOString();
  const responses = await Promise.all(Array.from({ length: 8 }, (_, offset) => {
    const index = offset + 1;
    return api("/functions/v1/submit-company-request", {
      method: "POST",
      key: env.publishableKey,
      token: env.publishableKey,
      headers: { "x-rate-limit-key": `browser-controlled-${index}` },
      body: {
        trade_name: `${marker}RATE-${index}`,
        legal_name: `${marker}RATE-${index} LTDA`,
        cnpj: validCnpj(index),
        responsible_name: `${marker}RESPONSAVEL-${index}`,
        responsible_role: "QA",
        responsible_email: `qa-e2e-staging-rate-${index}@example.invalid`,
        responsible_phone: "11999990001",
        city: "Sao Paulo",
        state: "SP",
        estimated_users: 2,
        estimated_units: 1,
        message: `${marker}TESTE DE RATE LIMIT`,
        rate_limit_key: `browser-controlled-${index}`,
      },
    });
  }));
  const statuses = responses.map((response) => response.status);
  expect(statuses).toContain(429);
  expect(statuses.filter((status) => status === 201 || status === 202).length).toBeLessThanOrEqual(6);
  expect(responses.filter((response) => response.status === 429).every((response) =>
    response.payload?.code === "RATE_LIMITED"
    && /^req_[0-9a-f]{24}$/.test(String(response.payload?.trace_id || ""))
  )).toBe(true);

  const idempotentRetry = await api("/functions/v1/submit-company-request", {
    method: "POST",
    key: env.publishableKey,
    token: env.publishableKey,
    body: {
      trade_name: `${marker}SOLICITACAO`,
      legal_name: `${marker}SOLICITACAO LTDA`,
      cnpj: fixture.requestCnpj,
      responsible_name: `${marker}RESPONSAVEL`,
      responsible_email: fixture.requestEmail,
      responsible_phone: "11999990001",
      city: "Sao Paulo",
      state: "SP",
    },
  });
  expect(idempotentRetry.status).toBe(409);
  expect(idempotentRetry.payload?.code).toBe("GM_REQUEST_EXISTS");

  const rpcKey = createHash("sha256")
    .update(`${marker}RATE-RPC-${Date.now()}`)
    .digest("hex");
  const atomic = await Promise.all(Array.from({ length: 8 }, () =>
    api("/rest/v1/rpc/gm_consume_public_rate_limit", {
      method: "POST",
      body: { p_key_hash: rpcKey, p_limit: 3, p_window_seconds: 60 },
    })
  ));
  expect(atomic.every((response) => response.status === 200)).toBe(true);
  expect(atomic.filter((response) => response.payload === true).length).toBe(3);
  await api(`/rest/v1/gm_public_rate_limits?key_hash=eq.${rpcKey}`, {
    method: "PATCH",
    body: {
      window_started_at: new Date(Date.now() - 120_000).toISOString(),
      attempts: 3,
    },
    headers: { Prefer: "return=minimal" },
  });
  const newWindow = await api("/rest/v1/rpc/gm_consume_public_rate_limit", {
    method: "POST",
    body: { p_key_hash: rpcKey, p_limit: 3, p_window_seconds: 60 },
  });
  expect(newWindow.status).toBe(200);
  expect(newWindow.payload).toBe(true);

  await page.route("**/functions/v1/submit-company-request", (route) =>
    route.fulfill({
      status: 429,
      contentType: "application/json",
      body: JSON.stringify({
        error: "Muitas solicitações foram enviadas.",
        code: "RATE_LIMITED",
        trace_id: "req_000000000000000000000000",
      }),
    })
  );
  await page.goto("/cadastrar-empresa");
  await fillValidRequest(page);
  await page.locator("#companyRequestSubmit").click();
  await expect(page.locator("#companyRequestStatus")).toContainText(
    /Muitas solicitações foram enviadas.*tente novamente/i,
  );
  await expect(page.locator("#companyRequestSubmit")).toBeEnabled();
  await expect(page.locator("#companyRequestSubmit")).toHaveText("Enviar para análise");

  await api(`/rest/v1/gm_public_rate_limits?key_hash=eq.${rpcKey}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
  await api(
    `/rest/v1/gm_public_rate_limits?updated_at=gte.${encodeURIComponent(startedAt)}`,
    {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    },
  );
});
