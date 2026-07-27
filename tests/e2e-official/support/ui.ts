import fs from "node:fs";
import { expect, type Page, type TestInfo } from "@playwright/test";
import { env, fixtureFile } from "./staging-api.mjs";

export type QaFixtureState = {
  marker: string;
  companyAId: string;
  companyBId: string;
  identities: Record<string, {
    slug: string;
    username: string;
    email: string;
    displayName: string;
    userId: string;
  }>;
};

export function readFixture(): QaFixtureState {
  return JSON.parse(fs.readFileSync(fixtureFile, "utf8")) as QaFixtureState;
}

export async function login(
  page: Page,
  identity: { slug: string; username: string },
  password = env.qaPassword,
) {
  await page.goto("/");
  await page.locator("#authCompanyLogin").fill(identity.slug);
  await page.locator("#authEmail").fill(identity.username);
  await page.locator("#authPassword").fill(password);
  await page.locator("#authLoginForm button[type=submit]").click();
  await expect(page.getByRole("banner")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("#authScreen")).toBeHidden();
}

export async function logout(page: Page) {
  await page.getByRole("button", { name: "Abrir perfil do usuário" }).click();
  await page.getByRole("button", { name: "Sair da conta" }).click();
  const confirm = page.getByRole("button", { name: /Sair|Confirmar/i }).last();
  if (await confirm.isVisible().catch(() => false)) await confirm.click();
  await expect(page.locator("#authScreen")).toBeVisible();
}

export async function openView(page: Page, view: string) {
  const button = page.locator(`[data-view="${view}"]`);
  await expect(button).toHaveCount(1);
  await page.evaluate((target) => {
    const button = document.querySelector<HTMLElement>(`[data-view="${target}"]`);
    button?.click();
  }, view);
  await expect(page.locator(`#${view}`)).toHaveClass(/active/);
}

export function monitorPage(page: Page, testInfo: TestInfo) {
  const issues: Array<{ type: string; text: string }> = [];
  page.on("pageerror", (error) => issues.push({ type: "pageerror", text: error.message }));
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      issues.push({ type: `console:${message.type()}`, text: message.text() });
    }
  });
  page.on("requestfailed", (request) => {
    issues.push({
      type: "requestfailed",
      text: `${request.method()} ${request.url()} ${request.failure()?.errorText || ""}`.trim(),
    });
  });
  return async () => {
    await testInfo.attach("browser-issues.json", {
      body: Buffer.from(JSON.stringify(issues, null, 2)),
      contentType: "application/json",
    });
    return issues;
  };
}

export async function expectNoGlobalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth, JSON.stringify(dimensions)).toBeLessThanOrEqual(dimensions.innerWidth);
  return dimensions;
}
