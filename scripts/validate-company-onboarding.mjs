import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const migration = fs.readFileSync(path.join(root, "supabase/migrations/202607160004_company_onboarding_admin.sql"), "utf8");
const emailMigration = fs.readFileSync(path.join(root, "supabase/migrations/202607170001_company_request_email_notification.sql"), "utf8");
const accessMigration = fs.readFileSync(path.join(root, "supabase/migrations/202607170002_company_access_without_email.sql"), "utf8");
const edge = fs.readFileSync(path.join(root, "supabase/functions/convert-company-request/index.ts"), "utf8");
const submitEdge = fs.readFileSync(path.join(root, "supabase/functions/submit-company-request/index.ts"), "utf8");
const results = [];
function test(name, condition) {
  if (!condition) throw new Error(`FALHOU: ${name}`);
  results.push(`OK - ${name}`);
}
function has(text, ...values) { return values.every(value => text.includes(value)); }

test("rota publica separada", has(html, "cadastrar-empresa", "companyRequestScreen", "companyRequestForm"));
test("link discreto no login", has(html, "data-company-request-link", "Sua empresa ainda n&atilde;o utiliza o GestMan365? Solicitar cadastro"));
test("campos publicos obrigatorios", ["trade_name","legal_name","cnpj","responsible_name","responsible_email","responsible_phone","city","state"].every(name => html.includes(`name=\"${name}\"`)));
test("validacao e mascaras no cliente", has(html, "function isValidCnpj", "formatCnpjInput", "formatPhoneInput", "validateCompanyRequest"));
test("bloqueio de envio concorrente", has(html, "gmCompanyRequestSubmitting", "button.disabled = true"));
test("estado de sucesso", has(html, "companyRequestSuccess", "Solicita&ccedil;&atilde;o registrada no painel GestMan365"));
test("mesmo fundo e logo do login", has(html, "body.company-request-route .auth-screen{display:flex!important", "companyRequestLogoHost", "#authScreen .auth-logo-img"));
test("textos publicos sem codificacao quebrada", !html.slice(html.indexOf('<section class="company-request-screen"'), html.indexOf('<header class="topbar')).match(/Ãƒ|Ã§|Ã£|Ã¡|â†|âœ/));
test("layout responsivo", has(html, "@media(max-width:900px)", "@media(max-width:600px)", ".company-request-form"));
test("rotas administrativas", has(html, "admin/solicitacoes", "admin/empresas", "platformRequests", "platformCompanies"));
test("guarda proprietario/superadmin", has(html, "function isPlatformAdmin", '["owner", "superadmin"]', "gm_current_platform_role"));
test("migration aditiva sem exclusao de dados", !/\b(truncate|drop\s+table|delete\s+from\s+(?!public\.company_requests))/i.test(migration));
test("tabela de solicitacoes e status", has(migration, "create table if not exists public.company_requests", "'pending', 'reviewing', 'approved', 'rejected', 'converted'"));
test("nenhuma senha em company_requests", !/company_requests[\s\S]{0,2500}\bpassword\b/i.test(migration));
test("CNPJ duplicado bloqueado no banco", has(migration, "company_requests_open_cnpj_uidx", "where status in ('pending', 'reviewing', 'approved', 'converted')"));
test("visitante sem SELECT/UPDATE/DELETE", has(migration, "revoke all on public.company_requests from anon", "company_requests_platform_select"));
test("cadastro publico apenas por RPC", has(migration, "gm_submit_company_request", "grant execute on function public.gm_submit_company_request(jsonb) to anon"));
test("formulario usa Edge Function de envio", has(html, 'gmPublicFunction("submit-company-request", data)', "/functions/v1/"));
test("destinatario de teste somente no servidor", submitEdge.includes('andsantos15@hotmail.com') && !html.includes('andsantos15@hotmail.com'));
test("credencial do e-mail somente em segredo", submitEdge.includes('Deno.env.get("RESEND_API_KEY")') && !html.includes("RESEND_API_KEY"));
test("e-mail usa remetente configurado", has(submitEdge, 'Deno.env.get("GESTMAN_EMAIL_FROM")', "reply_to: data.responsible_email"));
test("notificacao registra envio ou erro", has(emailMigration, "notification_sent_at", "notification_error") && has(submitEdge, "notification_sent_at", "notification_error"));
test("painel recebe solicitacao mesmo sem e-mail configurado", has(submitEdge, "panel_registered: true", "if (!RESEND_API_KEY || !EMAIL_FROM)") && !submitEdge.includes("!SERVICE_ROLE_KEY || !RESEND_API_KEY"));
test("honeypot contra envio automatizado", has(html, 'name="website"', "company-request-honeypot") && has(submitEdge, 'validationError === "BOT"'));
test("RLS habilitado", ["company_requests","gm_platform_admins","gm_company_units","gm_company_subscriptions","gm_platform_audit_log"].every(table => migration.includes(`alter table public.${table} enable row level security`)));
test("isolamento tenant preservado", has(migration, "gm_is_company_member(company_id)", "gm_companies_platform_select"));
test("conversao atomica bloqueia repeticao", has(migration, "for update", "Solicitacao ja convertida", "converted_company_id"));
test("company_id unico gerado", has(migration, "v_company_id uuid", "returning id into v_company_id", "gm_company_units(company_id"));
test("auditoria de revisao/conversao/gestao", has(migration, "gm_platform_audit_log", "company_request.converted", "company.'||p_action"));
test("service role ausente do frontend", !html.includes("SUPABASE_SERVICE_ROLE_KEY") && !html.includes("service_role"));
test("service role restrita a Edge Function", has(edge, "SUPABASE_SERVICE_ROLE_KEY", "auth.admin.createUser", "gm_convert_company_request_with_access_internal"));
test("acesso criado sem convite ou e-mail ao cliente", has(edge, "email_confirm: true", "email_sent: false") && !edge.includes("inviteUserByEmail"));
test("dominio explicito validado no servidor e banco", has(edge, "company_slug", "^[a-z0-9]") && has(accessMigration, "p_company_slug", "Dominio invalido"));
test("senha somente no Supabase Auth", has(edge, "admin_password", "auth.admin.createUser") && !/admin_password|password/i.test(accessMigration));
test("credenciais exibidas uma unica vez no painel", has(html, "renderPlatformAccessCreated", "Copie estes dados agora", "a senha não é salva no painel"));
test("nenhum envio automatico ao cliente na conversao", has(html, "Nenhum e-mail foi enviado ao cliente", "Envio ao cliente ficará para uma etapa futura"));
test("compensacao se conversao falhar", edge.includes("auth.admin.deleteUser"));
test("CORS sem wildcard", !edge.includes('Access-Control-Allow-Origin\": \"*'));
const edgeTranspile = ts.transpileModule(edge, { compilerOptions:{ target:ts.ScriptTarget.ES2022, module:ts.ModuleKind.ESNext }, reportDiagnostics:true });
test("Edge Function sem erro de sintaxe TypeScript", !(edgeTranspile.diagnostics || []).some(item => item.category === ts.DiagnosticCategory.Error));
const submitEdgeTranspile = ts.transpileModule(submitEdge, { compilerOptions:{ target:ts.ScriptTarget.ES2022, module:ts.ModuleKind.ESNext }, reportDiagnostics:true });
test("Edge Function de envio sem erro de sintaxe TypeScript", !(submitEdgeTranspile.diagnostics || []).some(item => item.category === ts.DiagnosticCategory.Error));

const cnpjDigits = value => String(value || "").replace(/\D/g, "").slice(0, 14);
function isValidCnpj(value) {
  const v = cnpjDigits(value);
  if (v.length !== 14 || /^(\d)\1{13}$/.test(v)) return false;
  const digit = length => { let sum=0,pos=length-7; for(let i=length;i>=1;i--){sum+=Number(v[length-i])*pos--;if(pos<2)pos=9;} const result=sum%11; return result<2?0:11-result; };
  return digit(12)===Number(v[12]) && digit(13)===Number(v[13]);
}
test("CNPJ valido aceito", isValidCnpj("11.222.333/0001-81"));
test("CNPJ incorreto rejeitado", !isValidCnpj("11.111.111/1111-11") && !isValidCnpj("12.345.678/0001-00"));

const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(match => match[1]).filter(code => code.trim());
scripts.forEach((code, index) => {
  try { new Function(code); }
  catch (error) { throw new Error(`FALHOU: sintaxe do script inline ${index + 1}: ${error.message}`); }
});
test("JavaScript inline sem erro de sintaxe", scripts.length > 0);

console.log(results.join("\n"));
console.log(`\n${results.length} verificacoes concluidas.`);
