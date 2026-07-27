import { expect, test } from "@playwright/test";
import { api, env, signIn } from "./support/staging-api.mjs";
import { login, readFixture } from "./support/ui";

test("admin lista somente usuários da empresa e desativa operador sem alterar perfil global", async ({ page }) => {
  const data = readFixture();
  await login(page, data.identities.adminA);
  await page.getByRole("button", { name: "Abrir perfil do usuário" }).click();
  await expect(page.locator("#tenantUserRows")).toContainText(data.identities.operatorA.displayName);
  await expect(page.locator("#tenantUserRows")).not.toContainText(data.identities.adminB.displayName);

  const operatorRow = page.locator("#tenantUserRows tr").filter({ hasText: data.identities.operatorA.displayName });
  await operatorRow.locator("summary").click();
  await operatorRow.getByRole("button", { name: /Editar/i }).click();
  await page.locator("#tenantUserContactEmail").fill(data.identities.operatorA.email);
  await page.locator("#tenantUserActive").selectOption("false");
  await page.locator("#tenantUserForm button[type=submit]").click();
  await expect(page.locator("#tenantInactiveConfirm")).toBeVisible();
  await page.locator("#tenantInactiveConfirm").getByRole("button", { name: /Desativar usuário/i }).click();
  await expect(operatorRow).toContainText(/Inativo/i, { timeout: 30_000 });
  await expect(page.locator("#tenantUserForm")).toBeHidden();

  const authStillValid = await signIn(data.identities.operatorA.email);
  expect(authStillValid.access_token).toBeTruthy();
  const membership = await api(
    `/rest/v1/gm_company_members?select=active&company_id=eq.${data.companyAId}&user_id=eq.${data.identities.operatorA.userId}`,
  );
  expect(membership.payload).toEqual([{ active: false }]);
  const profile = await api(
    `/rest/v1/gm_profiles?select=active&user_id=eq.${data.identities.operatorA.userId}`,
  );
  test.fail(
    profile.payload?.[0]?.active === false,
    "Defeito conhecido: desativar membership também desativa o perfil global do usuário.",
  );
  expect(profile.payload).toEqual([{ active: true }]);

  const isolatedContext = await api("/rest/v1/rpc/gm_current_user_context", {
    method: "POST",
    key: env.publishableKey,
    token: authStillValid.access_token,
    body: {},
  });
  expect([200, 401, 403]).toContain(isolatedContext.status);
  expect(JSON.stringify(isolatedContext.payload)).not.toContain(data.identities.adminB.slug);
});
