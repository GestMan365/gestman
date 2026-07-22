import { expect, test, type Locator, type Page } from "@playwright/test";

const DEMO_EMAIL = "admin@gestman365.local";
const DEMO_PASSWORD = "admin";
const REQUEST_STORAGE_KEY = "gestman365.demo.requests.empresa-demo";
const INVALID_RENDER_TOKENS = /\b(?:NaN|undefined|null|Infinity)\b/i;

async function login(page: Page) {
  await page.goto("./#/login");
  await page.getByLabel("E-mail", { exact: true }).fill(DEMO_EMAIL);
  await page.getByLabel("Senha", { exact: true }).fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/#\/dashboard$/);
}

async function openRequests(page: Page) {
  await login(page);
  await page.getByRole("link", { name: /Solicita/ }).click();
  await expect(page).toHaveURL(/#\/solicitacoes$/);
  await expect(page.getByRole("heading", { name: /Solicita/ }).first()).toBeVisible();
  await expect(page.getByText(/Carregando solicita/)).toHaveCount(0);
}

async function installRoleSession(
  page: Page,
  role: "ADMINISTRADOR" | "SUPERVISOR" | "PLANEJADOR" | "TECNICO" | "SOLICITANTE"
) {
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

async function openWithRole(page: Page, role: "SUPERVISOR" | "PLANEJADOR" | "TECNICO" | "SOLICITANTE") {
  await installRoleSession(page, role);
  await page.goto("./#/solicitacoes");
  await expect(page.getByRole("heading", { name: /Solicita/ }).first()).toBeVisible();
  await expect(page.getByText(/Carregando solicita/)).toHaveCount(0);
}

async function openDetails(page: Page, number: string): Promise<Locator> {
  await page.getByRole("button", { name: `Ver detalhes de ${number}`, exact: true }).click();
  return page.getByRole("dialog");
}

async function fillValidRequest(dialog: Locator, suffix: string, withAsset = true) {
  await dialog.getByRole("textbox", { name: /O que aconteceu/ }).fill(`Falha operacional ${suffix}`);
  await dialog.getByRole("textbox", { name: /Descreva o problema/ }).fill(`Descri\u00e7\u00e3o detalhada da falha operacional ${suffix}.`);
  if (withAsset) {
    await dialog.getByRole("combobox", { name: /Ativo relacionado/ }).selectOption("qa-auto-ativo-mot-001");
  } else {
    await dialog.getByRole("combobox", { name: /^Setor/ }).selectOption({ label: "Produ\u00e7\u00e3o" });
    await dialog.getByRole("textbox", { name: /Localiza/ }).fill("Linha de produ\u00e7\u00e3o QA");
  }
}

test.describe("GestMan365 - Solicitacoes", () => {
  test("protege o modulo sem autenticacao", async ({ page }) => {
    await page.goto("./#/solicitacoes");
    await expect(page).toHaveURL(/#\/login$/);
    await expect(page.getByRole("button", { name: "Entrar", exact: true })).toBeVisible();
  });

  test("exibe estrutura, estados deterministas e valores validos", async ({ page }) => {
    await openRequests(page);

    await expect(page.getByRole("region", { name: /Filtros de solicita/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Lista de solicita/ })).toBeVisible();
    for (const number of ["QA-AUTO-SOL-001", "QA-AUTO-SOL-002", "QA-AUTO-SOL-003", "QA-AUTO-SOL-004"]) {
      await expect(page.getByText(number, { exact: true })).toBeVisible();
    }
    await expect(page.getByText(/4 de 4 solicita/)).toBeVisible();
    await expect(page.locator("body")).not.toContainText(INVALID_RENDER_TOKENS);
  });

  test("mostra estado vazio para busca sem resultado", async ({ page }) => {
    await openRequests(page);
    await page.getByPlaceholder(/Buscar por n.mero, t.tulo ou descri/).fill("SOLICITACAO-INEXISTENTE");

    await expect(page.getByText(/Nenhuma solicita.*encontrada/)).toBeVisible();
    await expect(page.getByText(/0 de 4 solicita/)).toBeVisible();
  });

  test("busca por numero e por titulo", async ({ page }) => {
    await openRequests(page);
    const search = page.getByPlaceholder(/Buscar por n.mero, t.tulo ou descri/);
    await search.fill("QA-AUTO-SOL-002");
    await expect(page.getByText("QA-AUTO-SOL-002", { exact: true })).toBeVisible();
    await expect(page.getByText("QA-AUTO-SOL-001", { exact: true })).toHaveCount(0);

    await search.fill("compressor");
    await expect(page.getByText("QA-AUTO-SOL-003", { exact: true })).toBeVisible();
    await expect(page.getByText("QA-AUTO-SOL-002", { exact: true })).toHaveCount(0);
  });

  test("filtra por status, prioridade e solicitante", async ({ page }) => {
    await openRequests(page);
    const filters = page.getByRole("region", { name: /Filtros de solicita/ });

    await filters.getByRole("combobox", { name: "Status", exact: true }).selectOption("EM_ANALISE");
    await expect(page.getByText("QA-AUTO-SOL-002", { exact: true })).toBeVisible();
    await expect(page.getByText(/1 de 4 solicita/)).toBeVisible();

    await filters.getByRole("button", { name: "Limpar filtros", exact: true }).click();
    await filters.getByRole("combobox", { name: /Prioridade/ }).selectOption("CRITICA");
    await expect(page.getByText("QA-AUTO-SOL-003", { exact: true })).toBeVisible();

    await filters.getByRole("button", { name: "Limpar filtros", exact: true }).click();
    await filters.getByRole("combobox", { name: "Solicitante", exact: true }).selectOption({ label: "Operador de Produ\u00e7\u00e3o QA" });
    await expect(page.getByText("QA-AUTO-SOL-002", { exact: true })).toBeVisible();
  });

  test("cria solicitacao vinculada a ativo com numero unico", async ({ page }) => {
    await openRequests(page);
    await page.getByRole("button", { name: /Nova solicita/ }).click();
    const dialog = page.getByRole("dialog", { name: /Nova solicita/ });
    await fillValidRequest(dialog, "com ativo");
    await dialog.getByRole("combobox", { name: /Prioridade/ }).selectOption("ALTA");
    await dialog.getByRole("button", { name: /Enviar solicita/ }).click();

    await expect(page.getByRole("status")).toContainText("QA-AUTO-SOL-005");
    await expect(page.getByText("QA-AUTO-SOL-005", { exact: true })).toBeVisible();
    const details = await openDetails(page, "QA-AUTO-SOL-005");
    await expect(details.getByText(/QA-AUTO-ATIVO-MOT-001/)).toBeVisible();
  });

  test("cria solicitacao sem ativo quando o setor e informado", async ({ page }) => {
    await openRequests(page);
    await page.getByRole("button", { name: /Nova solicita/ }).click();
    const dialog = page.getByRole("dialog", { name: /Nova solicita/ });
    await fillValidRequest(dialog, "sem ativo", false);
    await dialog.getByRole("button", { name: /Enviar solicita/ }).click();

    await expect(page.getByRole("status")).toContainText("QA-AUTO-SOL-005");
    const details = await openDetails(page, "QA-AUTO-SOL-005");
    await expect(details.getByText(/Ativo n.o identificado/)).toBeVisible();
    await expect(details.getByText("Produ\u00e7\u00e3o", { exact: true })).toBeVisible();
  });

  test("valida titulo e descricao obrigatorios sem fechar o formulario", async ({ page }) => {
    await openRequests(page);
    await page.getByRole("button", { name: /Nova solicita/ }).click();
    const dialog = page.getByRole("dialog", { name: /Nova solicita/ });
    const title = dialog.getByRole("textbox", { name: /O que aconteceu/ });
    const description = dialog.getByRole("textbox", { name: /Descreva o problema/ });

    await dialog.getByRole("button", { name: /Enviar solicita/ }).click();
    expect(await title.evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(true);
    expect(await description.evaluate((input: HTMLTextAreaElement) => input.validity.valueMissing)).toBe(true);
    await expect(dialog).toBeVisible();
  });

  test("exige setor quando o ativo nao e conhecido e preserva os dados", async ({ page }) => {
    await openRequests(page);
    await page.getByRole("button", { name: /Nova solicita/ }).click();
    const dialog = page.getByRole("dialog", { name: /Nova solicita/ });
    await dialog.getByRole("textbox", { name: /O que aconteceu/ }).fill("Falha sem equipamento");
    await dialog.getByRole("textbox", { name: /Descreva o problema/ }).fill("Falha detalhada sem equipamento identificado.");
    const sector = dialog.getByRole("combobox", { name: /^Setor/ });
    await dialog.getByRole("button", { name: /Enviar solicita/ }).click();

    expect(await sector.evaluate((input: HTMLSelectElement) => input.validity.valueMissing)).toBe(true);
    await expect(dialog.getByRole("textbox", { name: /O que aconteceu/ })).toHaveValue("Falha sem equipamento");
  });

  test("gera numeros sequenciais sem duplicar registros", async ({ page }) => {
    await openRequests(page);
    for (const suffix of ["sequencial A", "sequencial B"]) {
      await page.getByRole("button", { name: /Nova solicita/ }).click();
      const dialog = page.getByRole("dialog", { name: /Nova solicita/ });
      await fillValidRequest(dialog, suffix);
      await dialog.getByRole("button", { name: /Enviar solicita/ }).click();
    }
    await expect(page.getByText("QA-AUTO-SOL-005", { exact: true })).toBeVisible();
    await expect(page.getByText("QA-AUTO-SOL-006", { exact: true })).toBeVisible();
    await expect(page.getByText(/6 de 6 solicita/)).toBeVisible();
  });

  test("persiste dados apenas na sessao apos recarregar", async ({ page }) => {
    await openRequests(page);
    await page.getByRole("button", { name: /Nova solicita/ }).click();
    const dialog = page.getByRole("dialog", { name: /Nova solicita/ });
    await fillValidRequest(dialog, "persistente na sessao");
    await dialog.getByRole("button", { name: /Enviar solicita/ }).click();
    await page.reload();

    await expect(page.getByText("QA-AUTO-SOL-005", { exact: true })).toBeVisible();
    await expect(page.getByText("Falha operacional persistente na sessao", { exact: true })).toBeVisible();
  });

  test("mostra detalhes operacionais e vinculo com ativo", async ({ page }) => {
    await openRequests(page);
    const details = await openDetails(page, "QA-AUTO-SOL-002");

    await expect(details.getByText(/Vazamento na bomba/)).toBeVisible();
    await expect(details.getByText(/QA-AUTO-ATIVO-BOM-001/)).toBeVisible();
    await expect(details.getByText(/Operador de Produ/)).toBeVisible();
    await expect(details.getByText(/Em an.lise/)).toBeVisible();
  });

  test("edita somente solicitacao aberta e mantem o numero", async ({ page }) => {
    await openRequests(page);
    const details = await openDetails(page, "QA-AUTO-SOL-001");
    await details.getByRole("button", { name: /Editar solicita/ }).click();
    const form = page.getByRole("dialog", { name: /Editar solicita/ });
    await form.getByRole("textbox", { name: /O que aconteceu/ }).fill("Ru\u00eddo revisado pela equipe QA");
    await form.getByRole("combobox", { name: /Prioridade/ }).selectOption("CRITICA");
    await form.getByRole("button", { name: /Salvar altera/ }).click();

    await expect(page.getByRole("status")).toContainText(/atualizada com sucesso/);
    await expect(page.getByText("QA-AUTO-SOL-001", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText("Ru\u00eddo revisado pela equipe QA", { exact: true })).toBeVisible();

    const analysisDetails = await openDetails(page, "QA-AUTO-SOL-002");
    await expect(analysisDetails.getByRole("button", { name: /Editar solicita/ })).toHaveCount(0);
  });

  test("move aberta para analise e aprova seguindo a maquina de estados", async ({ page }) => {
    await openRequests(page);
    const details = await openDetails(page, "QA-AUTO-SOL-001");
    await details.getByRole("button", { name: /Mover para an.lise/ }).click();
    await expect(details.getByText(/Em an.lise/)).toBeVisible();
    await expect(details.getByRole("button", { name: "Aprovar", exact: true })).toBeVisible();

    await details.getByRole("button", { name: "Aprovar", exact: true }).click();
    await expect(details.getByText("Aprovada", { exact: true })).toBeVisible();
    await expect(details.getByRole("button", { name: /Preparar convers/ })).toBeVisible();
  });

  test("rejeita solicitacao em analise somente com motivo", async ({ page }) => {
    await openRequests(page);
    const details = await openDetails(page, "QA-AUTO-SOL-002");
    await details.getByRole("button", { name: "Rejeitar", exact: true }).click();
    await details.getByRole("button", { name: /Confirmar rejei/ }).click();
    await expect(details.getByRole("alert")).toContainText(/Informe o motivo/);

    await details.getByRole("textbox", { name: /Motivo da rejei/ }).fill("Solicita\u00e7\u00e3o duplicada da ocorr\u00eancia anterior.");
    await details.getByRole("button", { name: /Confirmar rejei/ }).click();
    await expect(details.getByText("Rejeitada", { exact: true })).toBeVisible();
    await expect(details.getByText("Solicita\u00e7\u00e3o duplicada da ocorr\u00eancia anterior.", { exact: true })).toBeVisible();
    await expect(details.getByRole("button", { name: "Aprovar", exact: true })).toHaveCount(0);
  });

  test("cancela solicitacao aberta sem exclusao fisica", async ({ page }) => {
    await openRequests(page);
    const details = await openDetails(page, "QA-AUTO-SOL-004");
    page.once("dialog", dialog => dialog.accept());
    await details.getByRole("button", { name: /Cancelar solicita/ }).click();

    await expect(details.getByText("Cancelada", { exact: true })).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: "QA-AUTO-SOL-004" })).toBeVisible();
    await expect(details.getByRole("button", { name: /Mover para an.lise|Editar solicita|Cancelar solicita/ })).toHaveCount(0);
  });

  test("prepara conversao aprovada uma unica vez sem criar O.S. artificial", async ({ page }) => {
    await openRequests(page);
    const details = await openDetails(page, "QA-AUTO-SOL-003");
    await details.getByRole("button", { name: /Preparar convers/ }).click();

    await expect(details.getByRole("button", { name: /Convers.o preparada/ })).toBeDisabled();
    await expect(details.getByText("Aprovada", { exact: true })).toBeVisible();
    await expect(details.getByText(/aguardando integra.*Ordens de Servi/)).toBeVisible();
    const stored = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key) ?? "[]"), REQUEST_STORAGE_KEY);
    const approved = stored.find((item: { number: string }) => item.number === "QA-AUTO-SOL-003");
    expect(approved.workOrderId).toBeUndefined();
    expect(approved.status).toBe("APROVADA");
  });

  test("perfil Solicitante ve somente os proprios registros e pode abrir chamado", async ({ page }) => {
    await openWithRole(page, "SOLICITANTE");
    await expect(page.getByText(/2 de 2 solicita/)).toBeVisible();
    await expect(page.getByText("QA-AUTO-SOL-001", { exact: true })).toBeVisible();
    await expect(page.getByText("QA-AUTO-SOL-004", { exact: true })).toBeVisible();
    await expect(page.getByText("QA-AUTO-SOL-002", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Nova solicita/ })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Solicitante", exact: true })).toHaveCount(0);
    const details = await openDetails(page, "QA-AUTO-SOL-001");
    await expect(details.getByRole("button", { name: /Mover para an.lise|Editar solicita|Cancelar solicita/ })).toHaveCount(0);
  });

  test("perfil Tecnico consulta e cria sem revisar, editar ou excluir", async ({ page }) => {
    await openWithRole(page, "TECNICO");
    await expect(page.getByRole("button", { name: /Nova solicita/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Limpar dados QA/ })).toHaveCount(0);
    const details = await openDetails(page, "QA-AUTO-SOL-001");
    await expect(details.getByRole("button", { name: /Mover para an.lise|Editar solicita|Cancelar solicita/ })).toHaveCount(0);
  });

  test("perfil Supervisor revisa e edita sem liberar limpeza QA", async ({ page }) => {
    await openWithRole(page, "SUPERVISOR");
    await expect(page.getByRole("button", { name: /Nova solicita/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Limpar dados QA/ })).toHaveCount(0);
    const details = await openDetails(page, "QA-AUTO-SOL-001");
    await expect(details.getByRole("button", { name: /Editar solicita/ })).toBeVisible();
    await expect(details.getByRole("button", { name: /Mover para an.lise/ })).toBeVisible();
    await expect(details.getByRole("button", { name: /Cancelar solicita/ })).toHaveCount(0);
  });

  test("perfil Planejador permanece somente leitura conforme matriz atual", async ({ page }) => {
    await openWithRole(page, "PLANEJADOR");
    await expect(page.getByRole("button", { name: /Nova solicita|Limpar dados QA/ })).toHaveCount(0);
    const details = await openDetails(page, "QA-AUTO-SOL-001");
    await expect(details.getByRole("button", { name: /Mover para an.lise|Editar solicita|Cancelar solicita/ })).toHaveCount(0);
  });

  test("limpeza QA remove somente registros com prefixo controlado", async ({ page }) => {
    await openRequests(page);
    await page.evaluate(key => {
      const current = JSON.parse(sessionStorage.getItem(key) ?? "[]");
      current.push({
        ...current[0],
        id: "registro-nao-qa",
        number: "SOL-LEGADO-001",
        title: "Registro operacional preservado"
      });
      sessionStorage.setItem(key, JSON.stringify(current));
    }, REQUEST_STORAGE_KEY);
    await page.reload();
    await expect(page.getByText("SOL-LEGADO-001", { exact: true })).toBeVisible();
    page.once("dialog", dialog => dialog.accept());
    await page.getByRole("button", { name: /Limpar dados QA/ }).click();

    await expect(page.getByText("SOL-LEGADO-001", { exact: true })).toBeVisible();
    await expect(page.getByText("QA-AUTO-SOL-001", { exact: true })).toHaveCount(0);
    await expect(page.getByText(/1 de 1 solicita/)).toBeVisible();
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

    await openRequests(page);
    await expect(page.getByRole("heading", { name: /Lista de solicita/ })).toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
    expect(failedRequests).toEqual([]);
  });

  test("abre o cadastro por teclado e posiciona o foco", async ({ page }) => {
    await openRequests(page);
    const createButton = page.getByRole("button", { name: /Nova solicita/ });
    await createButton.focus();
    await page.keyboard.press("Enter");

    await expect(page.getByRole("dialog", { name: /Nova solicita/ })).toBeVisible();
    await expect(page.getByRole("textbox", { name: /O que aconteceu/ })).toBeFocused();
  });

  for (const viewport of [
    { name: "desktop", width: 1920, height: 1080 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "celular", width: 390, height: 844 }
  ]) {
    test(`mantem consulta e abertura acessiveis em ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openRequests(page);
      await expect(page.getByPlaceholder(/Buscar por n.mero, t.tulo ou descri/)).toBeVisible();
      await expect(page.getByRole("button", { name: /Nova solicita/ })).toBeVisible();
      await expect(page.getByRole("button", { name: "Ver detalhes de QA-AUTO-SOL-001" })).toBeVisible();
      await expect(page.locator("body")).not.toContainText(INVALID_RENDER_TOKENS);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });
  }
});
