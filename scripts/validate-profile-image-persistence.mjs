import fs from "node:fs";
import assert from "node:assert/strict";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const fallback = fs.readFileSync(new URL("../404.html", import.meta.url), "utf8");
const userFunction = fs.readFileSync(new URL("../supabase/functions/manage-company-user/index.ts", import.meta.url), "utf8");

const checks = [
  ["index e 404 permanecem sincronizados", () => assert.equal(html, fallback)],
  ["logo usa estado empresarial compartilhado", () => {
    assert.match(html, /state\?\.companyBrand\?\.companyLogo/);
    assert.match(html, /state\.companyBrand\s*=\s*\{/);
    assert.doesNotMatch(html, /state\.profile\s*=\s*\{[\s\S]{0,220}companyLogo:pendingCompanyLogoData/);
  }],
  ["logo antiga migra para o estado empresarial", () => {
    assert.match(html, /rawCompanyBrand\.companyLogo \|\| rawProfile\.companyLogo/);
    assert.match(html, /delete normalized\.profile\.companyLogo/);
  }],
  ["logout nao remove imagens remotas", () => {
    const logout = html.match(/async function logoutTenantUser\(confirmed = false\) \{[\s\S]*?\n    \}/)?.[0] || "";
    assert.match(logout, /gmClearSession\(\)/);
    assert.doesNotMatch(logout, /gm_profiles|gm_tenant_state|DELETE/);
  }],
  ["cada usuario salva a propria foto", () => {
    assert.match(html, /gm_profiles\?user_id=eq\.\$\{encodeURIComponent\(currentUserId\)\}/);
    assert.match(html, /id="removeProfilePhoto"/);
    assert.match(html, /\$\("removeProfilePhoto"\)\?\.addEventListener/);
  }],
  ["administracao nao envia avatar de outro perfil", () => {
    assert.doesNotMatch(html, /avatar_url:existing\?\.photo/);
    assert.doesNotMatch(userFunction, /cleanString\(input\.avatar_url/);
  }],
  ["backend preserva avatar e valida empresa do usuario", () => {
    assert.match(userFunction, /from\("gm_company_members"\)[\s\S]*?eq\("company_id", context\.company_id\)[\s\S]*?eq\("user_id", userId\)/);
    assert.match(userFunction, /from\("gm_profiles"\)[\s\S]*?select\("avatar_url"\)/);
    assert.match(userFunction, /p_avatar_url: preservedAvatarUrl/);
  }],
];

for (const [name, check] of checks) {
  check();
  console.log(`OK - ${name}`);
}

console.log(`\n${checks.length} verificacoes concluidas.`);
