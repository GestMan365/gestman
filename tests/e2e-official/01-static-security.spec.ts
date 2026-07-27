import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { env } from "./support/staging-api.mjs";

test("index e fallback 404 mantêm o contrato seguro e equivalente", async ({ request }) => {
  const index = await request.get("/");
  const fallback = await request.get("/cadastrar-empresa");
  expect(index.status()).toBe(200);
  expect(fallback.status()).toBe(404);
  const [indexHtml, fallbackHtml] = await Promise.all([index.text(), fallback.text()]);

  for (const html of [indexHtml, fallbackHtml]) {
    expect(html).toContain(env.url);
    expect(html).toContain(env.publishableKey);
    expect(html).not.toContain(env.serviceRoleKey);
    expect(html).toContain('gmAuthenticatedFunction("bootstrap-company"');
    expect(html).not.toMatch(/\/rest\/v1\/rpc\/bootstrap_company/i);
  }

  const contract = (html: string) => ({
    edgeCalls: html.match(/gmAuthenticatedFunction\("bootstrap-company"/g)?.length || 0,
    directRpcCalls: html.match(/\/rest\/v1\/rpc\/bootstrap_company/gi)?.length || 0,
    loginForm: html.includes('id="authLoginForm"'),
    requestForm: html.includes('id="companyRequestForm"'),
  });
  expect(contract(indexHtml)).toEqual(contract(fallbackHtml));
  const publicRequestContract = (html: string) => html.match(
    /async function submitCompanyRequest\(event\) \{[\s\S]*?\n    \}\r?\n\r?\n    function initCompanyRequestPage/,
  )?.[0] || "";
  const indexRequest = publicRequestContract(indexHtml);
  const fallbackRequest = publicRequestContract(fallbackHtml);
  expect(indexRequest).not.toBe("");
  expect(fallbackRequest).toBe(indexRequest);
  expect(indexRequest).toContain('gmPublicFunction("submit-company-request", data)');
  expect(indexRequest).not.toContain('gmPublicRpc("gm_submit_company_request"');
});

test("nenhum segredo de staging é versionado no frontend ou nos testes", async () => {
  const root = env.root;
  const checked = [
    "index.html",
    "404.html",
    "package.json",
    "playwright.official.config.ts",
    "scripts/e2e-official-env.mjs",
    "scripts/prepare-official-staging-site.mjs",
    "scripts/serve-official-staging.mjs",
  ];
  const source = checked.map((file) => fs.readFileSync(path.join(root, file), "utf8")).join("\n");
  expect(source).not.toContain(env.serviceRoleKey);
  expect(source).not.toContain(env.url);
  expect(source).not.toContain(env.qaPassword);
});

test("DOM inicial não possui IDs repetidos nem labels órfãos", async ({ page }) => {
  await page.goto("/");
  const audit = await page.evaluate(() => {
    const ids = [...document.querySelectorAll<HTMLElement>("[id]")].map((element) => element.id);
    const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))].sort();
    const orphanLabels = [...document.querySelectorAll<HTMLLabelElement>("label[for]")]
      .map((label) => label.htmlFor)
      .filter((id) => id && !document.getElementById(id));
    return { duplicates, orphanLabels };
  });
  expect(audit.orphanLabels).toEqual([]);
  test.info().annotations.push({
    type: "divida-tecnica",
    description: `IDs repetidos no DOM inicial: ${audit.duplicates.join(", ") || "nenhum"}.`,
  });
  test.fail(audit.duplicates.length > 0, "Defeito conhecido: o monólito contém IDs duplicados no DOM inicial.");
  expect(audit.duplicates).toEqual([]);
});

test("solicitação pública ainda não possui rate limit server-side", async () => {
  const source = fs.readFileSync(
    path.join(env.root, "supabase", "functions", "submit-company-request", "index.ts"),
    "utf8",
  );
  test.info().annotations.push({
    type: "bug-confirmado",
    description: "A Edge Function pública valida duplicidade, mas não consome rate limit.",
  });
  test.fail(true, "Defeito conhecido: endpoint público sem controle de taxa server-side.");
  expect(source).toMatch(/gm_consume_public_rate_limit|rate.?limit/i);
});
