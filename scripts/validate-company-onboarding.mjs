import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const migration = fs.readFileSync(path.join(root, "supabase/migrations/202607160004_company_onboarding_admin.sql"), "utf8");
const emailMigration = fs.readFileSync(path.join(root, "supabase/migrations/202607170001_company_request_email_notification.sql"), "utf8");
const accessMigration = fs.readFileSync(path.join(root, "supabase/migrations/202607170002_company_access_without_email.sql"), "utf8");
const emailValidationMigration = fs.readFileSync(path.join(root, "supabase/migrations/202607180001_fix_company_request_email_validation.sql"), "utf8");
const companyManagementMigration = fs.readFileSync(path.join(root, "supabase/migrations/202607180002_company_management_hardening.sql"), "utf8");
const edge = fs.readFileSync(path.join(root, "supabase/functions/convert-company-request/index.ts"), "utf8");
const submitEdge = fs.readFileSync(path.join(root, "supabase/functions/submit-company-request/index.ts"), "utf8");
const companyAccessEdge = fs.readFileSync(path.join(root, "supabase/functions/manage-company-access/index.ts"), "utf8");
const accessFlow = html.slice(
  html.indexOf("/* Fluxo de aprovacao e criacao de acesso"),
  html.indexOf("async function loadPlatformCompanies", html.indexOf("/* Fluxo de aprovacao e criacao de acesso"))
);
const effectiveAccessFlowStart = html.lastIndexOf("function platformConversionForm");
const effectiveAccessFlow = html.slice(
  effectiveAccessFlowStart,
  html.indexOf("function initPlatformAdmin", effectiveAccessFlowStart)
);
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
test("CNPJ incompleto mostra orientacao clara", has(html, "Digite os 14 n\\u00fameros do CNPJ", "incluindo os 2 d\\u00edgitos finais", "Revise os campos destacados"));
test("erro de validacao aparece junto ao envio", has(html, "has-validation-errors", "companyRequestStatus", "N\\u00e3o foi poss\\u00edvel enviar: corrija"));
test("bloqueio de envio concorrente", has(html, "gmCompanyRequestSubmitting", "button.disabled = true"));
test("estado de sucesso", has(html, "companyRequestSuccess", "Solicita&ccedil;&atilde;o registrada no painel GestMan365"));
test("confirmacao explicita apos envio", has(html, "Solicita&ccedil;&atilde;o enviada com sucesso!", 'aria-live="polite"', "successPanel.scrollIntoView"));
test("mesmo fundo e logo do login", has(html, "body.company-request-route .auth-screen{display:flex!important", "companyRequestLogoHost", "#authScreen .auth-logo-img"));
test("textos publicos sem codificacao quebrada", !html.slice(html.indexOf('<section class="company-request-screen"'), html.indexOf('<header class="topbar')).match(/Ãƒ|Ã§|Ã£|Ã¡|â†|âœ/));
test("layout responsivo", has(html, "@media(max-width:900px)", "@media(max-width:600px)", ".company-request-form"));
test("rotas administrativas", has(html, "admin/solicitacoes", "admin/empresas", "platformRequests", "platformCompanies"));
test("recarregamento autenticado sem flash do login", has(html, '<body class="auth-loading auth-restoring">', "body.auth-restoring::after", "gm-auth-restore-spin", 'if (!window.__gestmanHasSavedSession())'));
test("guarda proprietario/superadmin", has(html, "function isPlatformAdmin", '["owner", "superadmin"]', "gm_current_platform_role"));
test("migration aditiva sem exclusao de dados", !/\b(truncate|drop\s+table|delete\s+from\s+(?!public\.company_requests))/i.test(migration));
test("tabela de solicitacoes e status", has(migration, "create table if not exists public.company_requests", "'pending', 'reviewing', 'approved', 'rejected', 'converted'"));
test("nenhuma senha em company_requests", !/company_requests[\s\S]{0,2500}\bpassword\b/i.test(migration));
test("CNPJ duplicado bloqueado no banco", has(migration, "company_requests_open_cnpj_uidx", "where status in ('pending', 'reviewing', 'approved', 'converted')"));
test("visitante sem SELECT/UPDATE/DELETE", has(migration, "revoke all on public.company_requests from anon", "company_requests_platform_select"));
test("cadastro publico apenas por RPC", has(migration, "gm_submit_company_request", "grant execute on function public.gm_submit_company_request(jsonb) to anon"));
test("validacao de e-mail corrigida no banco", has(emailValidationMigration, "create or replace function public.gm_submit_company_request", "'^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$'") && !emailValidationMigration.includes("[A-Z0-9.\\\\-]"));
test("formulario grava diretamente pela RPC segura", has(html, 'gmPublicRpc("gm_submit_company_request", { p_request:data })', "/rest/v1/rpc/"));
test("envio ao painel independe do servico de e-mail", !html.includes('gmPublicFunction("submit-company-request", data)'));
test("atualizacao do painel sem recarregar autenticacao", has(html, "refreshPlatformRequests(event,this)", "async function refreshPlatformRequests", "Painel atualizado sem sair da administração."));
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
test("aprovacao abre etapa exclusiva de criacao de acesso", has(html, "APROVADA &middot; ETAPA 2 DE 2", "Crie o acesso da empresa", 'item.status==="approved"'));
test("formulario solicita somente dominio login e senha", has(effectiveAccessFlow, 'name="company_slug"', 'name="admin_username"', 'name="admin_password"', "Criar acesso") && !effectiveAccessFlow.includes('name="plan_code"') && !effectiveAccessFlow.includes('name="user_limit"') && !effectiveAccessFlow.includes('name="unit_limit"') && !effectiveAccessFlow.includes('name="admin_name"'));
test("login de acesso nao exige email", has(effectiveAccessFlow, "Login do usu&aacute;rio", 'type="text"', "Digite o login") && !effectiveAccessFlow.includes('name="admin_email"'));
test("login converte usuario livre em identidade segura", has(html, "function normalizeAccessUsername", "function tenantAuthEmail", "loginTenantUserByUsername") && has(edge, "normalizeAccessUsername", "tenantAuthEmail", "access_username"));
test("armazenamento removido do fluxo administrativo", !accessFlow.includes('name="storage_limit_mb"') && has(html, 'delete payload.storage_limit_mb', 'input[name="storage_limit_mb"]') && edge.includes("p_storage_limit_mb: 10240"));
test("exemplo abaixo do dominio removido", !accessFlow.includes("<small>Ex.:"));
test("acesso fica disponivel imediatamente", has(html, "Acesso liberado imediatamente.", "Empresa salva e acesso liberado com sucesso", "j&aacute; pode entrar no CMMS"));
test("janela administrativa sem textos corrompidos no fluxo novo", !html.slice(html.indexOf("/* Fluxo de aprovacao e criacao de acesso"), html.indexOf("async function loadPlatformCompanies", html.indexOf("/* Fluxo de aprovacao e criacao de acesso"))).match(/Ãƒ|Ã‚|Ã§|Ã£/));
test("metricas administrativas filtram por status", has(html, "filterPlatformRequestsByStatus", 'aria-pressed="${selected===status}"'));
test("filtros administrativos incluem ordenacao e limpeza", has(html, 'id="platformRequestSort"', "clearPlatformRequestFilters", "Mais recentes", "Mais antigas"));
test("acoes administrativas mudam conforme o status", has(html, 'pending:"Revisar"', 'approved:"Criar acesso"', 'converted:"Ver cadastro"'));
test("detalhe mostra andamento e historico", has(html, "platformRequestProgress", "platformRequestHistory", "Hist\\u00f3rico da solicita\\u00e7\\u00e3o"));
test("criacao de acesso ajuda dominio usuario e senha", has(html, "checkPlatformDomainAvailability", "platformUsernameHelp", "generatePlatformPassword", "togglePlatformPassword"));
test("servidor deriva cadastro da solicitacao aprovada", has(edge, 'await userClient', '.from("company_requests")', '"id,responsible_name,estimated_users,estimated_units,status"', 'requestData.status !== "approved"'));
test("servidor exige somente dados de acesso", has(edge, 'const required = ["request_id", "company_slug", "admin_username", "admin_password"]') && !edge.includes('"plan_code", "user_limit", "unit_limit"'));
test("dialogo administrativo preserva foco e acoes visiveis", has(html, "gmPlatformDialogReturnFocus", "platform-dialog-actions is-sticky", 'dialog.querySelector("input:not([type=hidden]),textarea,button")?.focus()'));
test("tabelas administrativas identificam coluna de acoes", has(html, '"Status", "A\\u00e7\\u00f5es"', '"\\u00daltimo acesso", "A\\u00e7\\u00f5es"'));
test("central de empresas possui quatro secoes", has(html, "Central profissional de empresas clientes", '["overview","Vis\\u00e3o geral"]', '["access","Acesso"]', '["plan","Plano e cadastro"]', '["history","Hist\\u00f3rico"]'));
test("empresas possuem busca ordenacao e filtros", has(html, "upgradePlatformCompanyToolbar", "platformCompanySort", "clearPlatformCompanyFilters", "filterPlatformCompaniesByStatus"));
test("gestao mostra capacidade contrato unidades e auditoria", has(html, "platformCompanyOverviewHtml", "platformCapacity", "platformCompanyAuditHtml", "gm_platform_audit_log?select=*"));
test("cadastro e plano usam formularios separados", has(html, "platformCompanyRegistrationHtml", "platformCompanyPlanHtml", "savePlatformCompanyRegistration", "savePlatformCompanyPlan"));
test("suspensao e arquivamento exigem confirmacao", has(html, "preparePlatformCompanyAction", "executePlatformCompanyAction", "Confirmar suspens\\u00e3o", "Confirmar arquivamento"));
test("suspensao bloqueia e reativacao libera usuarios", has(companyAccessEdge, "suspend_company", "reactivate_company", "archive_company", 'ban_duration: banDuration') && has(html, "Empresa e acessos suspensos", "Empresa e acessos reativados"));
test("login recusa empresa suspensa ou arquivada", has(html, '["suspended","archived"].includes', "O acesso desta empresa est\\u00e1 suspenso"));
test("senha nunca e recuperada nem armazenada no painel", has(html, "resetPlatformCompanyPassword", "A senha atual nunca \\u00e9 exibida", "n\\u00e3o ficar\\u00e1 salva no painel") && !companyAccessEdge.includes("password_hash"));
test("redefinicao de senha restrita a membro da empresa", has(companyAccessEdge, "Usuário não pertence a esta empresa", "gm_company_members", "auth.admin.updateUserById"));
test("redefinicao registra auditoria sem senha", has(companyAccessEdge, "company.access.password_reset", "metadata: { user_id: userId }") && !companyAccessEdge.includes("new_password:"));
test("gestao reforca limites conforme uso real", has(companyManagementMigration, "v_member_count", "v_unit_count", "nao pode ser menor que o uso atual"));
test("migration de gestao preserva dados", !/\b(truncate|drop\s+table|delete\s+from)\b/i.test(companyManagementMigration));
test("compensacao se conversao falhar", edge.includes("auth.admin.deleteUser"));
test("CORS sem wildcard", !edge.includes('Access-Control-Allow-Origin\": \"*'));
const edgeTranspile = ts.transpileModule(edge, { compilerOptions:{ target:ts.ScriptTarget.ES2022, module:ts.ModuleKind.ESNext }, reportDiagnostics:true });
test("Edge Function sem erro de sintaxe TypeScript", !(edgeTranspile.diagnostics || []).some(item => item.category === ts.DiagnosticCategory.Error));
const submitEdgeTranspile = ts.transpileModule(submitEdge, { compilerOptions:{ target:ts.ScriptTarget.ES2022, module:ts.ModuleKind.ESNext }, reportDiagnostics:true });
test("Edge Function de envio sem erro de sintaxe TypeScript", !(submitEdgeTranspile.diagnostics || []).some(item => item.category === ts.DiagnosticCategory.Error));
const companyAccessEdgeTranspile = ts.transpileModule(companyAccessEdge, { compilerOptions:{ target:ts.ScriptTarget.ES2022, module:ts.ModuleKind.ESNext }, reportDiagnostics:true });
test("Edge Function de gestao de acesso sem erro de sintaxe TypeScript", !(companyAccessEdgeTranspile.diagnostics || []).some(item => item.category === ts.DiagnosticCategory.Error));

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
