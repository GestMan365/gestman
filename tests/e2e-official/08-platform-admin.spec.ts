import { expect, test } from "@playwright/test";
import { api, env, fixture, marker, rows } from "./support/staging-api.mjs";
import { readFixture } from "./support/ui";

test("platform admin aprova, converte uma única vez e registra trilha", async ({ page }) => {
  const data = readFixture();
  test.setTimeout(120_000);
  const existing = await rows(
    "company_requests",
    `select=id&trade_name=eq.${encodeURIComponent(`${marker}SOLICITACAO`)}`,
  );
  if (!Array.isArray(existing.payload) || existing.payload.length === 0) {
    const created = await api("/functions/v1/submit-company-request", {
      method: "POST",
      key: env.publishableKey,
      token: env.publishableKey,
      body: {
        trade_name: `${marker}SOLICITACAO`,
        legal_name: `${marker}SOLICITACAO LTDA`,
        cnpj: fixture.requestCnpj,
        responsible_name: `${marker}RESPONSAVEL`,
        responsible_role: "QA",
        responsible_email: fixture.requestEmail,
        responsible_phone: "11999990001",
        city: "Sao Paulo",
        state: "SP",
        estimated_users: 5,
        estimated_units: 1,
        message: `${marker}VALIDACAO PUBLICA`,
      },
    });
    expect([201, 202]).toContain(created.status);
  }
  await page.goto("/");
  await page.locator("#authCompanyLogin").fill(data.identities.platform.slug);
  await page.locator("#authEmail").fill(data.identities.platform.username);
  await page.locator("#authPassword").fill(env.qaPassword);
  await page.locator("#authLoginForm button[type=submit]").click();
  await expect(page.locator("#platformOwnerHeader")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("#platformRequests")).toBeVisible();

  await page.locator("#platformRequestSearch").fill(`${marker}SOLICITACAO`);
  const requestRow = page.locator("#platformRequestRows tr").filter({ hasText: `${marker}SOLICITACAO` });
  await expect(requestRow).toHaveCount(1);
  await requestRow.getByRole("button").click();
  await expect(page.locator("#platformRequestDialog")).toBeVisible();
  await page.getByRole("button", { name: "Aprovar e criar acesso" }).click();
  await expect(page.locator("#platformConversionForm")).toBeVisible();

  const form = page.locator("#platformConversionForm");
  await form.locator('[name="company_slug"]').fill(fixture.convertedSlug);
  await form.locator('[name="admin_username"]').fill("admin.convertido");
  await form.locator('[name="admin_password"]').fill(env.qaPassword);
  await form.locator('[name="admin_name"]').fill(`${marker}ADMIN-CONVERTIDO`);
  await form.locator('[name="plan_code"]').fill("QA");
  await form.locator('[name="main_unit_name"]').fill(`${marker}UNIDADE`);
  await form.getByRole("button", { name: "Criar empresa e liberar acesso" }).click();
  await expect(page.locator("#platformCreatedDomain")).toHaveText(fixture.convertedSlug, { timeout: 60_000 });

  const [companies, requests, audits] = await Promise.all([
    rows("gm_companies", `select=id,slug&slug=eq.${fixture.convertedSlug}`),
    rows("company_requests", `select=id,status,converted_company_id&trade_name=eq.${encodeURIComponent(`${marker}SOLICITACAO`)}`),
    rows("gm_platform_audit_log", `select=id,action,metadata&action=ilike.*convert*`),
  ]);
  expect(companies.payload).toHaveLength(1);
  expect(requests.payload).toHaveLength(1);
  expect(requests.payload[0].status).toBe("converted");
  expect(requests.payload[0].converted_company_id).toBe(companies.payload[0].id);
  expect(JSON.stringify([companies.payload, requests.payload, audits.payload])).not.toContain(env.qaPassword);

  await page.locator("#platformRequestDialog").getByRole("button", { name: /Fechar/i }).click().catch(() => {});
  await page.locator("#platformRequestSearch").fill(`${marker}SOLICITACAO`);
  await requestRow.getByRole("button").click();
  await expect(page.locator("#platformRequestDialogBody")).toContainText(/já criados|não pode gerar um segundo/i);
  await expect(page.locator("#platformConversionForm")).toHaveCount(0);
  expect((await rows("gm_companies", `select=id&slug=eq.${fixture.convertedSlug}`)).payload).toHaveLength(1);
});
