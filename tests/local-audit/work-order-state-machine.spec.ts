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
      state.orders = [{ id:"qa-order-1", number:"OS-QA-001", assetId:"qa-asset-1", status:"Aberta", executor:"", createdAt:1760000000000, history:[] }];
      state.assets = [{ id:"qa-asset-1", code:"ATV-QA", name:"Equipamento QA" }];
      gmRemoteStateVersion = 4;
      gmRemoteLastSavedState = normalizeState(JSON.parse(JSON.stringify(state)));
      gmStateDirty = false;
      window.__qaOrderRpcCalls = [];
      dispatchWhatsAppOrderEvents = () => {};
      gmRpc = async (name, body = {}) => {
        window.__qaOrderRpcCalls.push({ name, body });
        if (name !== "gm_transition_work_order") return [];
        const current = state.orders.find(order => order.id === body.p_order_id);
        const now = Date.now();
        const order = {
          ...current,
          ...(body.p_patch || {}),
          status:body.p_to_status,
          updatedAt:now,
          history:[...(current.history || []), { id:body.p_request_id, date:now, type:"Status", text:current.status + " → " + body.p_to_status, immutable:true }]
        };
        return [{ version:body.p_expected_version + 1, updated_at:new Date(now).toISOString(), order_id:order.id, from_status:current.status, to_status:order.status, event_id:body.p_request_id, order_data:order }];
      };
    `);
  });
});

test("iniciar, pausar e retomar usam somente o RPC transacional", async ({ page }) => {
  await page.evaluate(() => window.eval(`startOrder("qa-order-1", "Técnico QA")`));
  await expect.poll(() => page.evaluate(() => window.eval(`state.orders[0].status`))).toBe("Em execução");
  await page.evaluate(() => window.eval(`mobileOrderActionLocks.clear()`));
  await page.evaluate(() => window.eval(`changeOrderOperationalStatus("qa-order-1", "Pausada", "Aguardando liberação")`));
  await expect.poll(() => page.evaluate(() => window.eval(`state.orders[0].status`))).toBe("Pausada");
  await page.evaluate(() => window.eval(`mobileOrderActionLocks.clear()`));
  await page.evaluate(() => window.eval(`changeOrderOperationalStatus("qa-order-1", "Em execução")`));
  await expect.poll(() => page.evaluate(() => window.eval(`state.orders[0].status`))).toBe("Em execução");

  const result = await page.evaluate(() => ({
    calls:(window as typeof window & { __qaOrderRpcCalls:Array<{ name:string; body:Record<string, unknown> }> }).__qaOrderRpcCalls,
    version:window.eval("gmRemoteStateVersion"),
    history:window.eval("state.orders[0].history"),
  }));
  expect(result.calls).toHaveLength(3);
  expect(result.calls.every(call => call.name === "gm_transition_work_order")).toBe(true);
  expect(result.calls[1].body.p_reason).toBe("Aguardando liberação");
  expect(result.calls[0].body.p_request_id).not.toBe(result.calls[1].body.p_request_id);
  expect(result.version).toBe(7);
  expect(result.history).toHaveLength(3);
});

test("campos de status ficam somente para leitura e cancelamento exige motivo", async ({ page }) => {
  const markup = await page.evaluate(() => window.eval(`detailTabContent("Detalhes", state.orders[0])`));
  expect(markup).toContain('id="tabDetailStatus" disabled');

  await page.evaluate(() => window.eval(`cancelOrder("qa-order-1")`));
  await expect(page.locator("#orderTransitionReasonForm")).toBeVisible();
  await page.locator("#orderTransitionReason").fill("Cadastro aberto por engano");
  await page.locator("#orderTransitionReasonForm button[type=submit]").click();
  await expect.poll(() => page.evaluate(() => window.eval(`state.orders[0].status`))).toBe("Cancelada");
  const lastCall = await page.evaluate(() => {
    const calls = (window as typeof window & { __qaOrderRpcCalls:Array<{ name:string; body:Record<string, unknown> }> }).__qaOrderRpcCalls;
    return calls.at(-1);
  });
  expect(lastCall?.body.p_to_status).toBe("Cancelada");
  expect(lastCall?.body.p_reason).toBe("Cadastro aberto por engano");
});
