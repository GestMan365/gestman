import { expect, test, type Page } from "@playwright/test";

const DEMO_EMAIL = "admin@gestman365.local";
const DEMO_PASSWORD = "admin";
const INVALID_RENDER_TOKENS = /\b(?:NaN|undefined|null|Infinity)\b/i;

async function loginToDashboard(page: Page) {
  await page.goto("./#/login");
  await page.getByLabel("E-mail", { exact: true }).fill(DEMO_EMAIL);
  await page.getByLabel("Senha", { exact: true }).fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/#\/dashboard$/);
}

test.describe("GestMan365 - Dashboard", () => {
  test("protege o Dashboard quando nao ha autenticacao", async ({ page }) => {
    await page.goto("./#/dashboard");

    await expect(page).toHaveURL(/#\/login$/);
    await expect(page.getByRole("button", { name: "Entrar", exact: true })).toBeVisible();
  });

  test("exibe a estrutura autenticada e o estado vazio dos indicadores", async ({ page }) => {
    await loginToDashboard(page);

    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
    await expect(page.getByText(/Visao executiva para indicadores/)).toBeVisible();
    await expect(page.getByRole("region", { name: "Resumo do Dashboard" })).toBeVisible();

    for (const title of ["Indicadores CMMS", "Backlog", "Confiabilidade"]) {
      const card = page.getByRole("region", { name: title });
      await expect(card).toBeVisible();
      await expect(card.getByText("Estrutura base", { exact: true })).toBeVisible();
    }

    await expect(page.locator("body")).not.toContainText(INVALID_RENDER_TOKENS);
  });

  test("mantem o filtro de empresa ligado ao contexto autenticado", async ({ page }) => {
    await loginToDashboard(page);

    const tenantFilter = page.getByLabel("Empresa ativa", { exact: true });
    await expect(tenantFilter).toBeVisible();
    await expect(tenantFilter).toHaveValue("empresa-demo");
    await expect(tenantFilter.locator("option")).toHaveText(["GestMan365 Demo"]);
  });

  test("navega pelos modulos disponiveis a partir do menu", async ({ page }) => {
    await loginToDashboard(page);

    const destinations = [
      ["Ativos", "ativos", /^Ativos$/],
      ["Solicitacoes", "solicitacoes", /^Solicita/],
      ["Ordens de Servico", "ordens-servico", /^Ordens de Servi/],
      ["PCM", "pcm", /^PCM$/],
      ["Relatorios", "relatorios", /^Relatorios$/],
      ["Administracao", "administracao", /^Administracao$/]
    ] as const;

    for (const [label, path, heading] of destinations) {
      await page.getByRole("link", { name: label, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`#\\/${path}$`));
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    }
  });

  test("preserva sessao e Dashboard depois de atualizar a pagina", async ({ page }) => {
    await loginToDashboard(page);
    await page.reload();

    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
    await expect(page.locator(".route-loading")).toHaveCount(0);
    await expect(page).toHaveURL(/#\/dashboard$/);
  });

  test("recupera de sessao corrompida sem deixar erro permanente", async ({ page }) => {
    await page.goto("./#/login");
    await page.evaluate(() => localStorage.setItem("gestman365.react.auth", "{sessao-corrompida"));
    await page.goto("./#/dashboard");

    await expect(page).toHaveURL(/#\/login$/);
    await expect(page.getByRole("button", { name: "Entrar", exact: true })).toBeVisible();
    await expect(page.locator(".route-loading")).toHaveCount(0);
  });

  test("nao registra erros de console nem falhas de rede no fluxo principal", async ({ page }) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];

    page.on("pageerror", error => pageErrors.push(error.message));
    page.on("console", message => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("requestfailed", request => failedRequests.push(request.url()));

    await loginToDashboard(page);
    await expect(page.getByRole("region", { name: "Resumo do Dashboard" })).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
    expect(failedRequests).toEqual([]);
  });

  for (const viewport of [
    { name: "desktop", width: 1920, height: 1080 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "celular", width: 390, height: 844 }
  ]) {
    test(`permanece legivel e navegavel em ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await loginToDashboard(page);

      await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Menu principal" })).toBeVisible();
      await expect(page.getByRole("region", { name: "Resumo do Dashboard" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Sair", exact: true })).toBeVisible();
      await expect(page.locator("body")).not.toContainText(INVALID_RENDER_TOKENS);
    });
  }

  test("oferece navegacao basica por teclado", async ({ page }) => {
    await loginToDashboard(page);

    const assetsLink = page.getByRole("link", { name: "Ativos", exact: true });
    await assetsLink.focus();
    await expect(assetsLink).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/#\/ativos$/);
    await expect(page.getByRole("heading", { name: "Ativos", exact: true })).toBeVisible();
  });

  test("respeita a navegacao permitida para perfil tecnico", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("gestman365.react.auth", JSON.stringify({
        id: "demo-admin",
        name: "Tecnico QA",
        email: "admin@gestman365.local",
        role: "TECNICO",
        empresaId: "empresa-demo",
        isActive: true
      }));
    });

    await page.goto("./#/dashboard");

    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ativos", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ordens de Servico", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Administracao", exact: true })).toHaveCount(0);
  });
});
