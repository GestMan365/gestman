import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { chromium } from "@playwright/test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(resolve(root, "index.html"), "utf8");
const fallback = readFileSync(resolve(root, "404.html"), "utf8");
const start = source.indexOf("    function orderResponsibleAvatarHtml(order = {}) {");
const end = source.indexOf("    let osCurrentPage", start);
assert.ok(start > 0 && end > start, "O renderizador do avatar deve existir.");
assert.equal(source.slice(start, end), fallback.slice(fallback.indexOf("    function orderResponsibleAvatarHtml(order = {}) {"), fallback.indexOf("    let osCurrentPage", fallback.indexOf("    function orderResponsibleAvatarHtml(order = {}) {"))), "index e fallback devem usar o mesmo avatar.");

function renderAvatar(order, currentUser, companyUsers = []) {
  const context = {
    currentAccount: { company: { id: "empresa-1" }, user: currentUser },
    authStore: { users: companyUsers },
    orderInitials: name => name.split(/\s+/).slice(0, 2).map(word => word[0]).join("").toUpperCase(),
    escapeHtml: value => String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;"),
    statusKey: value => String(value).toLocaleLowerCase("pt-BR").trim(),
    tenantUserDisplayName: user => user.name
  };
  const avatar = runInNewContext(`${source.slice(start, end)}; orderResponsibleAvatarHtml`, context);
  return avatar(order);
}

test("usa a foto do responsável, com iniciais como reserva", () => {
  const anderson = { id: "u1", name: "Anderson Vieira", photo: "data:image/png;base64,foto" };
  const joao = { id: "u2", companyId: "empresa-1", name: "João Lima", photo: "https://example.com/joao.png" };
  assert.match(renderAvatar({ executor: "Anderson Vieira", responsibleId: "u1" }, anderson), /<img src="data:image\/png;base64,foto"/);
  assert.match(renderAvatar({ executor: "João Lima" }, anderson, [joao]), /<img src="https:\/\/example.com\/joao.png"/);
  assert.doesNotMatch(renderAvatar({ executor: "Maria Souza" }, anderson, [joao]), /<img/);
  assert.match(renderAvatar({ executor: "Maria Souza" }, anderson, [joao]), />MS<\/span>/);
});

test("não confunde pessoas de outra empresa nem nomes duplicados", () => {
  const current = { id: "u1", name: "Admin", photo: "" };
  const otherCompany = { id: "u2", companyId: "empresa-2", name: "Anderson Vieira", photo: "https://example.com/outra.png" };
  assert.doesNotMatch(renderAvatar({ executor: "Anderson Vieira" }, current, [otherCompany]), /<img/);
  const duplicates = [
    { id: "u3", companyId: "empresa-1", name: "Anderson Vieira", photo: "https://example.com/um.png" },
    { id: "u4", companyId: "empresa-1", name: "Anderson Vieira", photo: "https://example.com/dois.png" }
  ];
  assert.doesNotMatch(renderAvatar({ executor: "Anderson Vieira" }, current, duplicates), /<img/);
});

test("foto permanece dentro do círculo mesmo com CSS anterior em cache", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const user = { id: "u1", name: "Anderson Vieira", photo: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='500' height='500'%3E%3Crect width='500' height='500' fill='blue'/%3E%3C/svg%3E" };
    await page.setContent(`<table><tbody><tr><td class="os-person-cell">${renderAvatar({ executor: user.name }, user)}</td><td>Próxima coluna</td></tr></tbody></table>`);
    const dimensions = await page.locator(".os-person-avatar img").evaluate(image => {
      const photo = image.getBoundingClientRect();
      const circle = image.parentElement.getBoundingClientRect();
      return { photoWidth: photo.width, photoHeight: photo.height, circleWidth: circle.width, circleHeight: circle.height };
    });
    assert.deepEqual(dimensions, { photoWidth:26, photoHeight:26, circleWidth:26, circleHeight:26 });
  } finally {
    await browser.close();
  }
});

test("foto fica centralizada sobre o nome na coluna responsável", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const user = { id: "u1", name: "Anderson Vieira", photo: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='500' height='500'%3E%3Crect width='500' height='500' fill='blue'/%3E%3C/svg%3E" };
    const template = source.match(/<td class="os-person-cell">(.+)<\/td>/)?.[0];
    assert.ok(template, "A coluna deve ter um contêiner para avatar e nome.");
    const cell = template
      .replace("${orderResponsibleAvatarHtml(order)}", renderAvatar({ executor:user.name }, user))
      .replace('${escapeHtml(order.executor || "Sem responsável")}', user.name);
    await page.setContent(`<style>.os-person-avatar{margin-right:6px}.os-person-cell{width:160px}</style><table><tbody><tr>${cell}</tr></tbody></table>`);
    const centers = await page.locator(".os-person-cell").evaluate(cell => {
      const avatar = cell.querySelector(".os-person-avatar").getBoundingClientRect();
      const name = cell.querySelector("strong").getBoundingClientRect();
      return { avatar:avatar.left + avatar.width / 2, name:name.left + name.width / 2 };
    });
    assert.ok(Math.abs(centers.avatar - centers.name) < 1, `Avatar e nome desalinhados: ${JSON.stringify(centers)}`);
  } finally {
    await browser.close();
  }
});
