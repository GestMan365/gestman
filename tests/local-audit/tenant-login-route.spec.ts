import { expect, test } from "@playwright/test";

const companyLogo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+AvzRkwAAAABJRU5ErkJggg==";

test("endereço da empresa identifica o cliente e remove o campo de domínio", async ({ page }) => {
  let requestedSlug = "";
  await page.route("**/functions/v1/company-brand", async route => {
    const request = route.request();
    requestedSlug = String(request.postDataJSON()?.slug || "");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        found: true,
        company: { slug: "beautylab", name: "Beauty Lab", logo_url: companyLogo },
      }),
    });
  });

  await page.goto("./beautylab/");

  await expect(page.locator("body")).toHaveClass(/auth-link-company/);
  await expect(page.locator(".auth-domain-field")).toBeHidden();
  await expect(page.locator("#authCompanyLogin")).toHaveValue("beautylab");
  await expect(page.locator("#authCompanyLogo")).toBeVisible();
  await expect(page.locator("#authCompanyName")).toHaveText("Beauty Lab");
  await expect(page.locator("#authTitle")).toHaveText("Bem-vindo");
  await expect(page.locator("#authSubtitle")).toContainText("Entre com seus dados");
  await expect(page.getByRole("textbox", { name: "Usuário", exact: true })).toBeVisible();
  await expect(page.locator("#authPassword")).toBeVisible();
  await expect.poll(() => requestedSlug).toBe("beautylab");
  await expect(page.locator("base")).toHaveAttribute("href", "/nadirteste/");
});

test("login geral continua disponível para administração e acesso alternativo", async ({ page }) => {
  await page.goto("./");

  await expect(page.locator("body")).not.toHaveClass(/auth-link-company/);
  await expect(page.getByLabel("Domínio")).toBeVisible();
  await expect(page.locator("#authCompanyBrand")).toBeHidden();
  await expect(page.locator("#authTitle")).toHaveText("Acesse sua conta");
});

test("cadastro da empresa entrega o link exclusivo do domínio oficial", async ({ page }) => {
  await page.goto("./");
  await page.evaluate(() => {
    (window as any).renderPlatformAccessCreated({
      access: { domain: "beautylab", username: "administrador" },
    }, "SenhaInicial#365");
  });

  const link = page.locator("#platformCreatedAccessUrl");
  await expect(link).toHaveText("https://app.gestman.com.br/beautylab/");
  await expect(link).toHaveAttribute("href", "https://app.gestman.com.br/beautylab/");
  await expect(page.locator("#platformCreatedUsername")).toHaveText("administrador");
  await expect(page.locator("#platformCreatedPassword")).toHaveText("SenhaInicial#365");
});
