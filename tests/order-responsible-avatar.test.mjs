import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { runInNewContext } from "node:vm";

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
