import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("./");
  await page.evaluate(() => {
    document.body.classList.remove("auth-required", "auth-loading", "auth-restoring");
    window.eval(`
      currentAccount = {
        user:{ id:"qa-admin", name:"Administrador QA", role:"admin", accessProfile:"admin", active:true },
        company:{ id:"qa-company", name:"Empresa QA", remoteSync:true }
      };
      state.resources = [];
      state.teams = [];
      state.orders = [];
      gmRemoteStateVersion = 7;
      gmOperationalUsers = [
        { userId:"qa-user-1", resourceId:"", name:"Técnico QA", username:"tecnico.qa", email:"tecnico@example.com", jobTitle:"Técnico mecânico", accessProfile:"technician", executor:true, active:true },
        { userId:"qa-user-2", resourceId:"", name:"Técnico QA", username:"tecnico.qa.2", email:"outro@example.com", jobTitle:"Técnico elétrico", accessProfile:"technician", executor:true, active:true }
      ];
      gmOperationalUsersReady = true;
      window.__qaResourceRpcCalls = [];
      gmRpc = async (name, body = {}) => {
        window.__qaResourceRpcCalls.push({ name, body });
        if (name === "gm_save_resource_user_link") return [{ version:8, updated_at:"2026-08-24T12:00:00Z" }];
        if (name === "gm_list_operational_users") return gmOperationalUsers.map(user => ({
          user_id:user.userId, resource_id:user.resourceId, display_name:user.name,
          access_username:user.username, contact_email:user.email, job_title:user.jobTitle,
          access_profile:user.accessProfile, executor:user.executor, active:user.active
        }));
        return [];
      };
    `);
  });
});

test("cadastro de recurso salva estado e vínculo no mesmo RPC", async ({ page }) => {
  await page.evaluate(() => window.eval("stage19OpenResourceForm()"));
  await page.locator("#stage19ResourceType").selectOption("Usuário interno");
  await page.locator("#stage19ResourceUser").selectOption("qa-user-1");
  await page.locator("#stage19ResourceSpecialty").fill("Mecânica");
  await page.locator("#stage19ResourceForm button[type=submit]").click();

  await expect.poll(() => page.evaluate(() => window.eval("state.resources.length"))).toBe(1);
  const result = await page.evaluate(() => ({
    resource:window.eval("state.resources[0]"),
    calls:(window as typeof window & { __qaResourceRpcCalls:Array<{ name:string; body:Record<string, unknown> }> }).__qaResourceRpcCalls,
    version:window.eval("gmRemoteStateVersion"),
  }));
  const save = result.calls.find(call => call.name === "gm_save_resource_user_link");
  expect(result.resource.userId).toBe("qa-user-1");
  expect(result.resource.name).toBe("Técnico QA");
  expect(save?.body.p_user_id).toBe("qa-user-1");
  expect(save?.body.p_resource_id).toBe(result.resource.id);
  expect((save?.body.p_state as { resources:Array<{ userId:string }> }).resources[0].userId).toBe("qa-user-1");
  expect(result.version).toBe(8);
});

test("O.S. usa IDs exatos, evita duplicidade e bloqueia acesso inativo", async ({ page }) => {
  const result = await page.evaluate(() => window.eval(`
    state.resources = [{ id:"qa-resource-1", code:"REC-QA", name:"Técnico QA", userId:"qa-user-1", status:"Disponível", specialty:"Mecânica" }];
    gmOperationalUsers = gmOperationalUsers.map(user => user.userId === "qa-user-1" ? { ...user, resourceId:"qa-resource-1" } : user);
    ({ active:orderRawExecutorCandidates(false), all:orderRawExecutorCandidates(true) });
  `));
  expect(result.active.map((candidate:{ id:string }) => candidate.id)).toEqual(["qa-resource-1", "user:qa-user-2"]);
  expect(result.all.filter((candidate:{ userId:string }) => candidate.userId === "qa-user-1")).toHaveLength(1);

  const inactive = await page.evaluate(() => window.eval(`
    gmOperationalUsers = gmOperationalUsers.map(user => user.userId === "qa-user-1" ? { ...user, active:false } : user);
    ({ active:orderRawExecutorCandidates(false), all:orderRawExecutorCandidates(true) });
  `));
  expect(inactive.active.some((candidate:{ id:string }) => candidate.id === "qa-resource-1")).toBe(false);
  expect(inactive.all.find((candidate:{ id:string }) => candidate.id === "qa-resource-1")?.selectable).toBe(false);
});
