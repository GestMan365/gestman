import { expect, test } from "@playwright/test";
import { env } from "./support/staging-api.mjs";
import { login, logout, monitorPage, readFixture } from "./support/ui";

test("login inválido é controlado, login válido persiste e logout encerra sessão", async ({ page }, testInfo) => {
  const finishMonitor = monitorPage(page, testInfo);
  const data = readFixture();
  await page.goto("/");
  await expect(page.getByLabel("Domínio")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Usuário", exact: true })).toBeVisible();
  await expect(page.locator("#authPassword")).toBeVisible();

  await page.locator("#authCompanyLogin").fill(data.identities.adminA.slug);
  await page.locator("#authEmail").fill(data.identities.adminA.username);
  await page.locator("#authPassword").fill("senha-incorreta");
  await page.locator("#authLoginForm button[type=submit]").click();
  await expect(page.locator("#authScreen")).toBeVisible();
  await expect(page.locator(".toast, [role=alert]").filter({ hasText: /não foi possível|verifique|incorret/i }).first()).toBeVisible();

  await login(page, data.identities.adminA);
  await expect.poll(() => page.evaluate(() =>
    Boolean(sessionStorage.getItem("gestman365.supabase.session.v1")))).toBe(true);
  await page.reload();
  await expect(page.getByRole("banner")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: "Abrir perfil do usuário" })).toContainText(data.marker);
  await logout(page);
  expect(await page.evaluate(() => sessionStorage.getItem("gestman365.supabase.session.v1"))).toBeNull();
  await finishMonitor();
});

test("empresa cruzada e usuário inativo não autenticam", async ({ page }) => {
  const data = readFixture();
  for (const attempt of [
    { slug: data.identities.adminB.slug, username: data.identities.adminA.username, password: env.qaPassword },
    { slug: data.identities.inactive.slug, username: data.identities.inactive.username, password: env.qaPassword },
  ]) {
    await page.goto("/");
    await page.locator("#authCompanyLogin").fill(attempt.slug);
    await page.locator("#authEmail").fill(attempt.username);
    await page.locator("#authPassword").fill(attempt.password);
    await page.locator("#authLoginForm button[type=submit]").click();
    await expect(page.locator("#authScreen")).toBeVisible();
    await expect(page.getByRole("banner")).toBeHidden();
  }
});

test("falha de rede mantém mensagem controlada e não expõe token", async ({ page }) => {
  const data = readFixture();
  await page.route(`${env.url}/auth/v1/**`, (route) => route.abort("internetdisconnected"));
  await page.goto("/");
  await page.locator("#authCompanyLogin").fill(data.identities.adminA.slug);
  await page.locator("#authEmail").fill(data.identities.adminA.username);
  await page.locator("#authPassword").fill(env.qaPassword);
  await page.locator("#authLoginForm button[type=submit]").click();
  await expect(page.locator("#authScreen")).toBeVisible();
  const body = await page.locator("body").innerText();
  expect(body).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}/);
  expect(body).not.toContain(env.publishableKey);
});
