import { test, expect, type Page } from "@playwright/test";

const DEMO_EMAIL = "admin@gestman365.local";
const DEMO_PASSWORD = "admin";

async function openLogin(page: Page) {
  await page.goto("./#/login");
  await expect(page.getByText("GESTMAN365", { exact: true })).toBeVisible();
}

async function signIn(page: Page, email = DEMO_EMAIL, password = DEMO_PASSWORD) {
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
}

test.describe("GestMan365 - Autenticacao", () => {
  test("realiza login valido e redireciona para o Dashboard", async ({ page }) => {
    await openLogin(page);
    await signIn(page);

    await expect(page).toHaveURL(/#\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
  });

  test("rejeita credenciais invalidas", async ({ page }) => {
    await openLogin(page);
    await signIn(page, "usuario-invalido@teste.local", "senha-incorreta");

    await expect(page.getByRole("alert")).toHaveText("E-mail ou senha invalidos.");
    await expect(page).toHaveURL(/#\/login$/);
  });

  test("preserva a sessao local apos recarregar", async ({ page }) => {
    await openLogin(page);
    await signIn(page);
    await expect(page).toHaveURL(/#\/dashboard$/);

    await page.reload();

    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
    await expect(page).toHaveURL(/#\/dashboard$/);
  });

  test("encerra a sessao com logout", async ({ page }) => {
    await openLogin(page);
    await signIn(page);
    await page.getByRole("button", { name: "Sair", exact: true }).click();

    await expect(page).toHaveURL(/#\/login$/);
    await expect(page.getByRole("button", { name: "Entrar", exact: true })).toBeVisible();
  });

  test("protege rota quando nao ha autenticacao", async ({ page }) => {
    await page.goto("./#/dashboard");

    await expect(page).toHaveURL(/#\/login$/);
    await expect(page.getByRole("button", { name: "Entrar", exact: true })).toBeVisible();
  });

  test("descarta sessao local com JSON invalido", async ({ page }) => {
    await openLogin(page);
    await page.evaluate(() => localStorage.setItem("gestman365.react.auth", "{json-invalido"));
    await page.reload();

    await expect(page.getByRole("button", { name: "Entrar", exact: true })).toBeVisible();
    await expect(page).toHaveURL(/#\/login$/);
  });
});
