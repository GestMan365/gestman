import { expect, test } from "@playwright/test";

test("login inicia sem persistência e identifica a senha atual", async ({ page }) => {
  await page.goto("/");

  const remember = page.locator("#rememberLogin");
  await expect(remember).not.toBeChecked();
  await expect(page.locator("#authPassword")).toHaveAttribute("autocomplete", "current-password");
});

test("sessão remota fica na aba e recebe expiração absoluta de oito horas", async ({ page }) => {
  await page.goto("/");

  const result = await page.evaluate(() => {
    const app = window as typeof window & {
      gmWriteSession: (payload: Record<string, unknown>, options?: Record<string, unknown>) => Record<string, unknown>;
    };
    sessionStorage.removeItem("gestman365.supabase.session.v1");
    localStorage.removeItem("gestman365.supabase.session.v1");
    app.gmWriteSession({
      access_token: "qa-session-token",
      refresh_token: "qa-refresh-token",
      expires_in: 3600,
      token_type: "bearer",
      user: { id: "qa-session-user", email: "qa-session@example.com", user_metadata: {} }
    }, { resetLifetime: true });
    const stored = JSON.parse(sessionStorage.getItem("gestman365.supabase.session.v1") || "null");
    return {
      duration: stored.session_expires_at - stored.session_started_at,
      localCopy: localStorage.getItem("gestman365.supabase.session.v1"),
      hasAccessToken: stored.access_token === "qa-session-token"
    };
  });

  expect(result.duration).toBe(8 * 60 * 60);
  expect(result.localCopy).toBeNull();
  expect(result.hasAccessToken).toBe(true);
});

test("sessão absoluta vencida é removida e orienta novo login", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    const now = Math.floor(Date.now() / 1000);
    sessionStorage.setItem("gestman365.supabase.session.v1", JSON.stringify({
      access_token: "qa-expired-token",
      refresh_token: "qa-expired-refresh",
      expires_at: now + 1800,
      session_started_at: now - 28801,
      session_expires_at: now - 1,
      token_type: "bearer"
    }));
  });

  await page.reload();

  await expect.poll(() => page.evaluate(() => sessionStorage.getItem("gestman365.supabase.session.v1"))).toBeNull();
  await expect(page.locator("#authSubtitle")).toContainText("sessão expirou");
});
