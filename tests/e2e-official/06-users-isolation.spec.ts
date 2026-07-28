import { expect, test } from "@playwright/test";
import { api, env, serviceInsert, signIn } from "./support/staging-api.mjs";
import { login, readFixture } from "./support/ui";

test("admin lista somente usuários da empresa e desativa operador sem alterar perfil global", async ({ page }) => {
  const data = readFixture();
  const secondMembership = await serviceInsert("gm_company_members", {
    company_id: data.companyBId,
    user_id: data.identities.operatorA.userId,
    role: "technician",
    active: true,
    access_username: "operador.b",
    access_profile: "technician",
    permission_levels: {},
  });
  expect([200, 201]).toContain(secondMembership.status);

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
  await page.locator("#tenantInactiveConfirm").getByRole(
    "button",
    { name: /Remover acesso desta empresa/i },
  ).click();
  await expect(operatorRow).toContainText(/Inativo/i, { timeout: 30_000 });
  await expect(page.locator("#tenantUserForm")).toBeHidden();

  const authStillValid = await signIn(data.identities.operatorA.email);
  expect(authStillValid.access_token).toBeTruthy();
  const memberships = await api(
    `/rest/v1/gm_company_members?select=company_id,active&user_id=eq.${data.identities.operatorA.userId}&order=company_id.asc`,
  );
  expect(memberships.payload).toEqual(expect.arrayContaining([
    { company_id: data.companyAId, active: false },
    { company_id: data.companyBId, active: true },
  ]));
  const profile = await api(
    `/rest/v1/gm_profiles?select=active&user_id=eq.${data.identities.operatorA.userId}`,
  );
  expect(profile.payload).toEqual([{ active: true }]);

  const isolatedContext = await api("/rest/v1/rpc/gm_current_context", {
    method: "POST",
    key: env.publishableKey,
    token: authStillValid.access_token,
    body: {},
  });
  expect(isolatedContext.status).toBe(200);
  expect(JSON.stringify(isolatedContext.payload)).toContain(data.companyBId);
  expect(JSON.stringify(isolatedContext.payload)).not.toContain(data.companyAId);

  const adminASession = await signIn(data.identities.adminA.email);
  const forbiddenGlobal = await api("/rest/v1/rpc/gm_set_global_user_active_internal", {
    method: "POST",
    key: env.publishableKey,
    token: adminASession.access_token,
    body: {
      p_actor_user_id: data.identities.adminA.userId,
      p_user_id: data.identities.operatorA.userId,
      p_active: false,
    },
  });
  expect(forbiddenGlobal.status).toBeGreaterThanOrEqual(400);

  const globalOff = await api("/rest/v1/rpc/gm_set_global_user_active_internal", {
    method: "POST",
    body: {
      p_actor_user_id: data.identities.platform.userId,
      p_user_id: data.identities.operatorA.userId,
      p_active: false,
    },
  });
  expect(globalOff.status).toBe(200);
  expect(globalOff.payload).toBe(true);
  const globallyBlocked = await api("/rest/v1/rpc/gm_current_context", {
    method: "POST",
    key: env.publishableKey,
    token: authStillValid.access_token,
    body: {},
  });
  expect(
    globallyBlocked.status >= 400
    || (Array.isArray(globallyBlocked.payload) && globallyBlocked.payload.length === 0),
  ).toBe(true);

  const globalOn = await api("/rest/v1/rpc/gm_set_global_user_active_internal", {
    method: "POST",
    body: {
      p_actor_user_id: data.identities.platform.userId,
      p_user_id: data.identities.operatorA.userId,
      p_active: true,
    },
  });
  expect(globalOn.status).toBe(200);
  const restoreA = await api("/functions/v1/manage-company-user", {
    method: "POST",
    key: env.publishableKey,
    token: adminASession.access_token,
    body: {
      action: "set_active",
      user_id: data.identities.operatorA.userId,
      active: true,
    },
  });
  expect(restoreA.status).toBe(200);
  const removeAAgain = await api("/functions/v1/manage-company-user", {
    method: "POST",
    key: env.publishableKey,
    token: adminASession.access_token,
    body: {
      action: "set_active",
      user_id: data.identities.operatorA.userId,
      active: false,
    },
  });
  expect(removeAAgain.status).toBe(200);
  const finalRestoreA = await api("/functions/v1/manage-company-user", {
    method: "POST",
    key: env.publishableKey,
    token: adminASession.access_token,
    body: {
      action: "set_active",
      user_id: data.identities.operatorA.userId,
      active: true,
    },
  });
  expect(finalRestoreA.status).toBe(200);

  const [membershipAudit, globalAudit] = await Promise.all([
    api(`/rest/v1/gm_audit_log?select=action,entity&entity_id=eq.${data.identities.operatorA.userId}`),
    api(`/rest/v1/gm_platform_audit_log?select=action,entity&entity_id=eq.${data.identities.operatorA.userId}`),
  ]);
  expect(JSON.stringify(membershipAudit.payload)).toContain("membership.deactivate");
  expect(JSON.stringify(globalAudit.payload)).toContain("user.global.deactivate");
});
