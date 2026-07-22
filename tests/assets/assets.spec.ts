import { expect, test, type Locator, type Page } from "@playwright/test";

const DEMO_EMAIL = "admin@gestman365.local";
const DEMO_PASSWORD = "admin";
const INVALID_RENDER_TOKENS = /\b(?:NaN|undefined|null|Infinity)\b/i;

async function login(page: Page) {
  await page.goto("./#/login");
  await page.getByLabel("E-mail", { exact: true }).fill(DEMO_EMAIL);
  await page.getByLabel("Senha", { exact: true }).fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/#\/dashboard$/);
}

async function openAssets(page: Page) {
  await login(page);
  await page.getByRole("link", { name: "Ativos", exact: true }).click();
  await expect(page).toHaveURL(/#\/ativos$/);
  await expect(page.getByRole("heading", { name: "Ativos", exact: true })).toBeVisible();
  await expect(page.getByText("Carregando ativos...")).toHaveCount(0);
}

async function fillRequiredAssetFields(dialog: Locator, tag: string, name: string) {
  await dialog.getByRole("textbox", { name: "TAG", exact: true }).fill(tag);
  await dialog.getByRole("textbox", { name: "Nome", exact: true }).fill(name);
}

async function createAsset(page: Page, tag: string, name: string) {
  await page.getByRole("button", { name: "Novo ativo", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Novo ativo" });
  await fillRequiredAssetFields(dialog, tag, name);
  await dialog.getByRole("button", { name: "Salvar ativo", exact: true }).click();
  await expect(dialog).toHaveCount(0);
}

async function installRoleSession(page: Page, role: "ADMINISTRADOR" | "SUPERVISOR" | "PLANEJADOR" | "TECNICO" | "SOLICITANTE") {
  await page.addInitScript(selectedRole => {
    localStorage.setItem("gestman365.react.auth", JSON.stringify({
      id: "demo-admin",
      name: `Perfil ${selectedRole}`,
      email: "admin@gestman365.local",
      role: selectedRole,
      empresaId: "empresa-demo",
      isActive: true
    }));
  }, role);
}

test.describe("GestMan365 - Ativos", () => {
  test("bloqueia o modulo sem autenticacao", async ({ page }) => {
    await page.goto("./#/ativos");

    await expect(page).toHaveURL(/#\/login$/);
    await expect(page.getByRole("button", { name: "Entrar", exact: true })).toBeVisible();
  });

  test("exibe estrutura, listagem deterministica e valores validos", async ({ page }) => {
    await openAssets(page);

    await expect(page.getByRole("region", { name: "Filtros de ativos" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Lista de ativos" })).toBeVisible();
    await expect(page.getByText("QA-AUTO-ATIVO-MOT-001", { exact: true })).toBeVisible();
    await expect(page.getByText("QA-AUTO-ATIVO-BOM-001", { exact: true })).toBeVisible();
    await expect(page.getByText("QA-AUTO-ATIVO-CMP-001", { exact: true })).toBeVisible();
    await expect(page.getByText("3 de 3 ativo(s)", { exact: true })).toBeVisible();
    await expect(page.locator("body")).not.toContainText(INVALID_RENDER_TOKENS);
  });

  test("mostra estado vazio quando a busca nao encontra registros", async ({ page }) => {
    await openAssets(page);
    await page.getByPlaceholder("Buscar por TAG, nome, categoria ou local").fill("ATIVO-INEXISTENTE");

    await expect(page.getByText("Nenhum ativo encontrado para os filtros informados.")).toBeVisible();
    await expect(page.getByText("0 de 3 ativo(s)", { exact: true })).toBeVisible();
  });

  test("busca ativo por TAG", async ({ page }) => {
    await openAssets(page);
    await page.getByPlaceholder("Buscar por TAG, nome, categoria ou local").fill("BOM-001");

    await expect(page.getByText("QA-AUTO-ATIVO-BOM-001", { exact: true })).toBeVisible();
    await expect(page.getByText("QA-AUTO-ATIVO-MOT-001", { exact: true })).toHaveCount(0);
  });

  test("busca ativo por nome", async ({ page }) => {
    await openAssets(page);
    await page.getByPlaceholder("Buscar por TAG, nome, categoria ou local").fill("Compressor de Ar");

    await expect(page.getByText("Compressor de Ar 01", { exact: true })).toBeVisible();
    await expect(page.getByText("Motor Elétrico da Esteira 01", { exact: true })).toHaveCount(0);
  });

  test("filtra por status, criticidade e setor", async ({ page }) => {
    await openAssets(page);

    await page.getByRole("combobox", { name: "Status", exact: true }).selectOption("EM_MANUTENCAO");
    await expect(page.getByText("QA-AUTO-ATIVO-BOM-001", { exact: true })).toBeVisible();
    await expect(page.getByText("1 de 3 ativo(s)", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Limpar filtros", exact: true }).click();
    await page.getByRole("combobox", { name: "Criticidade", exact: true }).selectOption("ALTA");
    await expect(page.getByText("QA-AUTO-ATIVO-MOT-001", { exact: true })).toBeVisible();
    await expect(page.getByText("1 de 3 ativo(s)", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Limpar filtros", exact: true }).click();
    await page.getByRole("combobox", { name: "Setor", exact: true }).selectOption({ label: "Utilidades" });
    await expect(page.getByText("QA-AUTO-ATIVO-CMP-001", { exact: true })).toBeVisible();
    await expect(page.getByText("1 de 3 ativo(s)", { exact: true })).toBeVisible();
  });

  test("cria um ativo valido com feedback", async ({ page }) => {
    await openAssets(page);
    await page.getByRole("button", { name: "Novo ativo", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Novo ativo" });
    await fillRequiredAssetFields(dialog, "QA-AUTO-ATIVO-ENV-002", "Envasadora QA 02");
    await dialog.getByRole("textbox", { name: "Categoria", exact: true }).fill("Envasadora");
    await dialog.getByRole("combobox", { name: "Setor", exact: true }).selectOption("Envase");
    await dialog.getByRole("combobox", { name: "Criticidade", exact: true }).selectOption("CRITICA");
    await dialog.getByRole("button", { name: "Salvar ativo", exact: true }).click();

    await expect(page.getByRole("status")).toHaveText("Ativo criado com sucesso.");
    await expect(page.getByText("QA-AUTO-ATIVO-ENV-002", { exact: true })).toBeVisible();
    await expect(page.getByText("4 de 4 ativo(s)", { exact: true })).toBeVisible();
  });

  test("valida TAG e nome obrigatorios sem fechar o formulario", async ({ page }) => {
    await openAssets(page);
    await page.getByRole("button", { name: "Novo ativo", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Novo ativo" });
    const tagInput = dialog.getByRole("textbox", { name: "TAG", exact: true });
    const nameInput = dialog.getByRole("textbox", { name: "Nome", exact: true });

    await dialog.getByRole("button", { name: "Salvar ativo", exact: true }).click();

    await expect(dialog).toBeVisible();
    expect(await tagInput.evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(true);
    expect(await nameInput.evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(true);
  });

  test("rejeita TAG duplicada dentro da empresa", async ({ page }) => {
    await openAssets(page);
    await page.getByRole("button", { name: "Novo ativo", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Novo ativo" });
    await fillRequiredAssetFields(dialog, "qa-auto-ativo-mot-001", "Duplicado");
    await dialog.getByRole("button", { name: "Salvar ativo", exact: true }).click();

    await expect(dialog.getByRole("alert")).toHaveText("Já existe um ativo com esta TAG nesta empresa.");
    await expect(dialog.getByRole("textbox", { name: "Nome", exact: true })).toHaveValue("Duplicado");
  });

  test("edita nome, criticidade e status e persiste apos recarregar", async ({ page }) => {
    await openAssets(page);
    await page.getByRole("button", { name: "Ver detalhes de QA-AUTO-ATIVO-MOT-001" }).click();
    await page.getByRole("button", { name: "Editar ativo", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Editar ativo" });
    await dialog.getByRole("textbox", { name: "Nome", exact: true }).fill("Motor Elétrico QA Atualizado");
    await dialog.getByRole("combobox", { name: "Criticidade", exact: true }).selectOption("CRITICA");
    await dialog.getByRole("combobox", { name: "Status", exact: true }).selectOption("EM_MANUTENCAO");
    await dialog.getByRole("button", { name: "Salvar ativo", exact: true }).click();

    await expect(page.getByRole("status")).toHaveText("Ativo atualizado com sucesso.");
    await page.reload();
    await expect(page.getByText("Motor Elétrico QA Atualizado", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Ver detalhes de QA-AUTO-ATIVO-MOT-001" }).click();
    const details = page.getByRole("dialog", { name: "Motor Elétrico QA Atualizado" });
    await expect(details.getByText("Crítica", { exact: true })).toBeVisible();
    await expect(details.getByText("Em manutenção", { exact: true })).toBeVisible();
  });

  test("mostra detalhes tecnicos do ativo", async ({ page }) => {
    await openAssets(page);
    await page.getByRole("button", { name: "Ver detalhes de QA-AUTO-ATIVO-BOM-001" }).click();
    const details = page.getByRole("dialog", { name: "Bomba Centrífuga de Processo 01" });

    await expect(details.getByText("QA-AUTO-ATIVO-BOM-001", { exact: true })).toBeVisible();
    await expect(details.getByText("Sala de bombas", { exact: true })).toBeVisible();
    await expect(details.getByText("QA-BOM-001", { exact: true })).toBeVisible();
  });

  test("inativa o ativo sem exclusao fisica", async ({ page }) => {
    await openAssets(page);
    await page.getByRole("button", { name: "Ver detalhes de QA-AUTO-ATIVO-CMP-001" }).click();
    const details = page.getByRole("dialog", { name: "Compressor de Ar 01" });
    await details.getByRole("button", { name: "Inativar ativo", exact: true }).click();

    await expect(page.getByRole("status")).toHaveText("Ativo inativado com sucesso.");
    await expect(details.getByText("Inativo", { exact: true })).toBeVisible();
    await expect(details.getByRole("button", { name: "Ativo inativo", exact: true })).toBeDisabled();
  });

  test("nao oferece exclusao fisica de ativos", async ({ page }) => {
    await openAssets(page);
    await page.getByRole("button", { name: "Ver detalhes de QA-AUTO-ATIVO-MOT-001" }).click();

    await expect(page.getByRole("button", { name: /excluir ativo/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Inativar ativo", exact: true })).toBeVisible();
  });

  test("restringe cadastro e edicao para o perfil Tecnico", async ({ page }) => {
    await installRoleSession(page, "TECNICO");
    await page.goto("./#/ativos");
    await expect(page.getByRole("heading", { name: "Ativos", exact: true })).toBeVisible();

    await expect(page.getByRole("button", { name: "Novo ativo", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Limpar dados QA", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Ver detalhes de QA-AUTO-ATIVO-MOT-001" }).click();
    await expect(page.getByRole("button", { name: "Editar ativo", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Inativar ativo", exact: true })).toHaveCount(0);
  });

  test("permite cadastro e edicao ao Supervisor sem liberar limpeza QA", async ({ page }) => {
    await installRoleSession(page, "SUPERVISOR");
    await page.goto("./#/ativos");
    await expect(page.getByRole("heading", { name: "Ativos", exact: true })).toBeVisible();

    await expect(page.getByRole("button", { name: "Novo ativo", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Limpar dados QA", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Ver detalhes de QA-AUTO-ATIVO-MOT-001" }).click();
    await expect(page.getByRole("button", { name: "Editar ativo", exact: true })).toBeVisible();
  });

  test("nao gera erros de console nem falhas criticas de rede", async ({ page }) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];
    page.on("pageerror", error => pageErrors.push(error.message));
    page.on("console", message => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("requestfailed", request => failedRequests.push(request.url()));

    await openAssets(page);
    await expect(page.getByRole("region", { name: "Lista de ativos" })).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
    expect(failedRequests).toEqual([]);
  });

  test("abre o cadastro por teclado", async ({ page }) => {
    await openAssets(page);
    const createButton = page.getByRole("button", { name: "Novo ativo", exact: true });
    await createButton.focus();
    await expect(createButton).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(page.getByRole("dialog", { name: "Novo ativo" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "TAG", exact: true })).toBeFocused();
  });

  for (const viewport of [
    { name: "desktop", width: 1920, height: 1080 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "celular", width: 390, height: 844 }
  ]) {
    test(`mantem consulta e cadastro acessiveis em ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openAssets(page);

      await expect(page.getByPlaceholder("Buscar por TAG, nome, categoria ou local")).toBeVisible();
      await expect(page.getByText("QA-AUTO-ATIVO-MOT-001", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Novo ativo", exact: true }).click();
      await expect(page.getByRole("dialog", { name: "Novo ativo" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Salvar ativo", exact: true })).toBeVisible();
    });
  }

  test("limpa somente registros QA-AUTO e preserva ativo sem o prefixo", async ({ page }) => {
    await openAssets(page);
    await createAsset(page, "REAL-DEMO-001", "Ativo preservado");
    page.once("dialog", dialog => dialog.accept());
    await page.getByRole("button", { name: "Limpar dados QA", exact: true }).click();

    await expect(page.getByRole("status")).toHaveText("3 ativo(s) QA removido(s) desta sessão.");
    await expect(page.getByText("REAL-DEMO-001", { exact: true })).toBeVisible();
    await expect(page.getByText("QA-AUTO-ATIVO-MOT-001", { exact: true })).toHaveCount(0);
    await page.reload();
    await expect(page.getByText("REAL-DEMO-001", { exact: true })).toBeVisible();
    await expect(page.getByText("QA-AUTO-ATIVO-MOT-001", { exact: true })).toHaveCount(0);
  });
});
