import { expect, test } from "@playwright/test";

const sessionKey = "gestman365.supabase.session.v1";
const fakeSession = {
  access_token:"qa-session-token",
  refresh_token:"qa-refresh-token",
  expires_in:3600,
  token_type:"bearer",
  user:{ id:"qa-session-user", email:"qa-session@example.com", user_metadata:{} }
};

test("continuar conectado inicia marcado e não salva a senha", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#rememberLogin")).toBeChecked();
  await expect(page.locator("#authPassword")).toHaveAttribute("autocomplete", "current-password");
});

test("continuar conectado mantém a sessão neste dispositivo até sair", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(payload => {
    localStorage.removeItem("gestman365.supabase.session.v1");
    sessionStorage.removeItem("gestman365.supabase.session.v1");
    const saved = window.eval(`gmWriteSession(${JSON.stringify(payload)}, { resetLifetime:true, persistent:true })`);
    const stored = JSON.parse(localStorage.getItem("gestman365.supabase.session.v1") || "null");
    return {
      saved,
      stored,
      tabCopy:sessionStorage.getItem("gestman365.supabase.session.v1"),
      detected:(window as typeof window & { __gestmanHasSavedSession?: () => boolean }).__gestmanHasSavedSession?.()
    };
  }, fakeSession);
  expect(result.saved.persistent).toBe(true);
  expect(result.stored.access_token).toBe(fakeSession.access_token);
  expect(result.stored.session_expires_at).toBe(0);
  expect(result.stored).not.toHaveProperty("password");
  expect(result.tabCopy).toBeNull();
  expect(result.detected).toBe(true);

  const browserState = await page.context().storageState();
  expect(browserState.origins.some(origin => origin.localStorage.some(item => item.name === sessionKey))).toBe(true);

  await page.evaluate(() => window.eval("gmClearSession()"));
  expect(await page.evaluate(() => localStorage.getItem("gestman365.supabase.session.v1"))).toBeNull();
  expect(await page.evaluate(() => sessionStorage.getItem("gestman365.supabase.session.v1"))).toBeNull();
});

test("opção desmarcada mantém sessão apenas na aba por até oito horas", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(payload => {
    const saved = window.eval(`gmWriteSession(${JSON.stringify(payload)}, { resetLifetime:true, persistent:false })`);
    return {
      saved,
      stored:JSON.parse(sessionStorage.getItem("gestman365.supabase.session.v1") || "null"),
      deviceCopy:localStorage.getItem("gestman365.supabase.session.v1")
    };
  }, fakeSession);
  expect(result.saved.persistent).toBe(false);
  expect(result.stored.session_expires_at - result.stored.session_started_at).toBe(8 * 60 * 60);
  expect(result.deviceCopy).toBeNull();
});

test("nova aba restaura a conta e Sair remove a sessão persistente", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(payload => window.eval(`gmWriteSession(${JSON.stringify(payload)}, { resetLifetime:true, persistent:true })`), fakeSession);
  await page.context().route("https://zkkyiqtzmimcoderjrrm.supabase.co/rest/v1/**", route =>
    route.fulfill({ status:200, contentType:"application/json", body:"[]" }));
  await page.context().route("https://zkkyiqtzmimcoderjrrm.supabase.co/rest/v1/rpc/gm_current_context", route =>
    route.fulfill({ status:200, contentType:"application/json", body:"null" }));
  await page.context().route("https://zkkyiqtzmimcoderjrrm.supabase.co/rest/v1/rpc/gm_current_platform_role", route =>
    route.fulfill({ status:200, contentType:"application/json", body:'"owner"' }));
  await page.context().route("https://zkkyiqtzmimcoderjrrm.supabase.co/auth/v1/logout", route =>
    route.fulfill({ status:204, body:"" }));

  const reopened = await page.context().newPage();
  await reopened.goto("/");
  await expect.poll(() => reopened.evaluate(() => window.eval("currentAccount?.company?.id || ''"))).toBe("gestman-platform");
  await reopened.evaluate(() => window.eval("logoutTenantUser(true)"));
  await expect.poll(() => reopened.evaluate(() => localStorage.getItem("gestman365.supabase.session.v1"))).toBeNull();
  await expect(reopened.locator("body")).toHaveClass(/auth-required/);
  await reopened.close();
});

test("falha temporária de rede não apaga a sessão lembrada", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(payload => window.eval(`gmWriteSession(${JSON.stringify(payload)}, { resetLifetime:true, persistent:true })`), fakeSession);
  const context=page.context();
  const offline=async (route: import("@playwright/test").Route) => route.abort("internetdisconnected");
  await context.route("https://zkkyiqtzmimcoderjrrm.supabase.co/rest/v1/rpc/gm_current_context", offline);
  const reopened=await context.newPage();
  await reopened.goto("/");
  await expect.poll(() => reopened.evaluate(() => document.body.classList.contains("auth-required"))).toBe(true);
  expect(await reopened.evaluate(() => localStorage.getItem("gestman365.supabase.session.v1"))).not.toBeNull();
  await context.unroute("https://zkkyiqtzmimcoderjrrm.supabase.co/rest/v1/rpc/gm_current_context", offline);
  await context.route("https://zkkyiqtzmimcoderjrrm.supabase.co/rest/v1/**", route =>
    route.fulfill({ status:200, contentType:"application/json", body:"[]" }));
  await context.route("https://zkkyiqtzmimcoderjrrm.supabase.co/rest/v1/rpc/gm_current_context", route =>
    route.fulfill({ status:200, contentType:"application/json", body:"null" }));
  await context.route("https://zkkyiqtzmimcoderjrrm.supabase.co/rest/v1/rpc/gm_current_platform_role", route =>
    route.fulfill({ status:200, contentType:"application/json", body:'"owner"' }));
  await reopened.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect.poll(() => reopened.evaluate(() => window.eval("currentAccount?.company?.id || ''"))).toBe("gestman-platform");
  await reopened.close();
});

test("sessão temporária vencida é removida e orienta novo login", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    const now = Math.floor(Date.now() / 1000);
    sessionStorage.setItem("gestman365.supabase.session.v1", JSON.stringify({
      access_token:"qa-expired-token", refresh_token:"qa-expired-refresh",
      expires_at:now + 1800, session_started_at:now - 28801,
      session_expires_at:now - 1, persistent:false, token_type:"bearer"
    }));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem("gestman365.supabase.session.v1"))).toBeNull();
  await expect(page.locator("#authSubtitle")).toContainText("sessão expirou");
});
