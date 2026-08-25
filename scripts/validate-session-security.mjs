import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const files = ["index.html", "404.html"];
const sources = files.map(file => [file, readFileSync(file, "utf8")]);

for (const [file, source] of sources) {
  assert.match(source, /id="authPassword"[^>]+autocomplete="current-password"/, `${file}: login deve usar autocomplete current-password`);
  assert.match(source, /id="rememberLogin"\s+type="checkbox"(?![^>]*\schecked(?:\s|>|=))/, `${file}: continuar conectado deve iniciar desmarcado`);
  assert.match(source, /const SESSION_DURATION_MS = 8 \* 60 \* 60 \* 1000;/, `${file}: sessão deve ter duração absoluta de oito horas`);
  assert.match(source, /session_started_at:\s*sessionStartedAt/, `${file}: início absoluto da sessão não foi persistido`);
  assert.match(source, /session_expires_at:\s*resetLifetime/, `${file}: expiração absoluta da sessão não foi persistida`);
  assert.match(source, /sessionStorage\.setItem\(GM_SUPABASE_SESSION_KEY, JSON\.stringify\(next\)\)/, `${file}: token deve permanecer somente na sessão da aba`);
  assert.doesNotMatch(source, /localStorage\.setItem\(GM_SUPABASE_SESSION_KEY/, `${file}: token não pode ser persistido no localStorage`);
  assert.match(source, /expiresAt:Date\.now\(\) \+ SESSION_DURATION_MS/, `${file}: contexto do tenant deve respeitar a duração da sessão`);
  assert.ok((source.match(/gmWriteSession\(session, \{ resetLifetime:true \}\)/g) || []).length >= 2, `${file}: logins devem reiniciar a janela absoluta`);
  assert.match(source, /authStore\.session = null;\s*saveAuthStore\(authStore\);\s*gmClearSession\(\);/, `${file}: expiração deve remover a sessão remota`);
}

assert.equal(sources[0][1], sources[1][1], "index.html e 404.html devem permanecer idênticos");
console.log("Session security validation passed for index.html and 404.html.");
