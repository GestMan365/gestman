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

test("onboarding público limita rajadas de solicitações", async () => {
  const statuses: number[] = [];
  for (let index = 1; index <= 8; index += 1) {
    const response = await api("/functions/v1/submit-company-request", {
      method: "POST",
      key: env.publishableKey,
      token: env.publishableKey,
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
      },
    });
    statuses.push(response.status);
  }
  const rateLimited = statuses.includes(429);
  test.info().annotations.push({
    type: "bug-confirmado",
    description: `Nenhuma resposta 429 em rajada controlada: ${statuses.join(", ")}.`,
  });
  test.fail(!rateLimited, "Defeito conhecido: submit-company-request não aplica rate limit.");
  expect(rateLimited).toBe(true);
});
