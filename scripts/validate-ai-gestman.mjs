import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const edge = read("supabase/functions/ai-gestman/index.ts");
const index = read("index.html");
const fallback = read("404.html");

for (const [name, html] of [["index.html", index], ["404.html", fallback]]) {
  assert.match(html, /gmAuthenticatedFunction\("ai-gestman", \{ question:cleanQuestion \}\)/, `${name}: chamada autenticada ausente`);
  assert.match(html, /id="aiSubmitBtn"/, `${name}: proteção contra envio duplo ausente`);
  assert.match(html, /Sem consulta à internet/, `${name}: escopo visual da IA ausente`);
  assert.doesNotMatch(html, /OPENAI_API_KEY|api\.openai\.com\/v1\/responses/, `${name}: integração OpenAI não pode estar no navegador`);
}

const frontendContract = (html) => html.match(
  /let aiQueryPending = false;[\s\S]*?function statusKey\(status = ""\)/,
)?.[0] ?? "";
assert.ok(frontendContract(index), "contrato da IA ausente no index.html");
assert.equal(frontendContract(index), frontendContract(fallback), "index.html e 404.html diferem no contrato da IA");

assert.match(edge, /Deno\.env\.get\("OPENAI_API_KEY"\)/, "chave OpenAI não está em segredo server-side");
assert.match(edge, /userClient\.auth\.getUser\(token\)/, "token Supabase não é validado");
assert.match(edge, /userClient\.rpc\("gm_current_context"\)/, "contexto multiempresa não é validado");
assert.match(edge, /canUseAssistant\(context\)/, "permissão do módulo IA não é validada");
assert.match(edge, /userClient\.rpc\("gm_load_tenant_state"\)/, "dados não são carregados com o JWT/RLS do usuário");
assert.match(edge, /service\.rpc\("gm_consume_public_rate_limit"/, "rate limit server-side ausente");
assert.match(edge, /store: false/, "retenção opcional da resposta não foi desabilitada");
assert.match(edge, /safety_identifier:/, "identificador de segurança não foi enviado");
assert.match(edge, /question_hash:/, "auditoria por hash da pergunta ausente");
assert.doesNotMatch(edge, /metadata:\s*\{[^}]*question\s*:/s, "texto integral da pergunta não deve ser salvo na auditoria");
assert.doesNotMatch(edge, /web_search|file_search|computer_use|mcp/i, "ferramenta externa encontrada na Edge Function");
assert.doesNotMatch(edge, /OPENAI_API_KEY\s*=\s*["'][^"']+["']/, "segredo OpenAI literal encontrado");

console.log("OK: IA GestMan365 usa somente backend autenticado, dados tenant-scoped e nenhuma ferramenta externa.");
