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
      window.__qaNow = 1760000000000;
      dispatchWhatsAppOrderEvents = () => {};
      gmRpc = async (name, body = {}) => {
        window.__qaOrderRpcCalls.push({ name, body });
        if (name !== "gm_transition_work_order") return [];
        const current = state.orders.find(order => order.id === body.p_order_id);
        const now = window.__qaNow += 60000;
        const fromStatus = current.status;
        const toStatus = body.p_to_status;
        const action = toStatus === "Pausada" ? "PAUSED"
          : fromStatus === "Pausada" && toStatus === "Em execução" ? "RESUMED"
          : toStatus === "Em execução" ? "STARTED"
          : toStatus === "Concluída" ? "COMPLETED"
          : toStatus === "Cancelada" ? "CANCELLED" : "OPENED";
        const order = {
          ...current,
          ...(body.p_patch || {}),
          status:toStatus,
          updatedAt:now,
          startedAt:toStatus === "Em execução" ? (current.startedAt || now) : current.startedAt,
          pausedAt:toStatus === "Pausada" ? now : (action === "RESUMED" ? null : current.pausedAt),
          pauseReason:toStatus === "Pausada" ? body.p_reason : (action === "RESUMED" ? "" : current.pauseReason),
          pauseHours:action === "RESUMED" ? Number(current.pauseHours || 0) + Math.max(0, now - Number(current.pausedAt || now)) / 36e5 : Number(current.pauseHours || 0),
          history:[...(current.history || []), {
            id:body.p_request_id,
            eventId:body.p_request_id,
            date:now,
            at:now,
            type:"Status",
            action,
            text:fromStatus + " → " + toStatus + (body.p_reason ? " · " + body.p_reason : ""),
            owner:"Administrador QA",
            immutable:true
          }]
        };
        return [{ version:body.p_expected_version + 1, updated_at:new Date(now).toISOString(), order_id:order.id, from_status:fromStatus, to_status:order.status, event_id:body.p_request_id, order_data:order }];
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

  const audit = await page.evaluate(() => window.eval(`orderAuditEvents(state.orders[0])`));
  expect(audit.map((event: { type:string }) => event.type)).toEqual([
    "CRIACAO", "EXECUCAO_INICIADA", "OS_PAUSADA", "OS_RETOMADA"
  ]);
  expect(audit[2]).toMatchObject({
    type:"OS_PAUSADA",
    previousStatus:"Em execução",
    newStatus:"Pausada",
    reason:"Aguardando liberação",
    user:"Administrador QA",
  });
  expect(audit[3].pausePeriodId).toBe(audit[2].pausePeriodId);
  expect(audit.map((event: { date:number }) => event.date)).toEqual(
    [...audit].map((event: { date:number }) => event.date).sort((a:number, b:number) => a - b)
  );

  const historyMarkup = await page.evaluate(() => window.eval(`selectedOrderDetailTab="history"; orderDetailTabContent(state.orders[0])`));
  expect(historyMarkup).toContain('data-event-type="OS_PAUSADA"');
  expect(historyMarkup).toContain('data-event-type="OS_RETOMADA"');
  expect(historyMarkup).toContain("Aguardando liberação");
  expect(historyMarkup).toContain("Administrador QA");
  expect(historyMarkup).not.toMatch(/editar|excluir|remover/i);
});

test("pausa exige motivo e múltiplas pausas mantêm períodos independentes", async ({ page }) => {
  await page.evaluate(() => window.eval(`startOrder("qa-order-1", "Técnico QA")`));
  await page.evaluate(() => window.eval(`mobileOrderActionLocks.clear(); changeOrderOperationalStatus("qa-order-1", "Pausada")`));
  await expect(page.locator("#orderTransitionReasonForm")).toBeVisible();
  expect(await page.evaluate(() => (window as typeof window & { __qaOrderRpcCalls:unknown[] }).__qaOrderRpcCalls.length)).toBe(1);
  await page.locator("#orderTransitionReason").fill("Primeira pausa");
  await page.locator("#orderTransitionReasonForm button[type=submit]").click();
  await expect.poll(() => page.evaluate(() => window.eval(`state.orders[0].status`))).toBe("Pausada");

  await page.evaluate(() => window.eval(`mobileOrderActionLocks.clear(); changeOrderOperationalStatus("qa-order-1", "Em execução")`));
  await expect.poll(() => page.evaluate(() => window.eval(`state.orders[0].status`))).toBe("Em execução");
  await page.evaluate(() => window.eval(`mobileOrderActionLocks.clear(); changeOrderOperationalStatus("qa-order-1", "Pausada", "Segunda pausa")`));
  await expect.poll(() => page.evaluate(() => window.eval(`state.orders[0].status`))).toBe("Pausada");
  await page.evaluate(() => window.eval(`mobileOrderActionLocks.clear(); changeOrderOperationalStatus("qa-order-1", "Em execução")`));
  await expect.poll(() => page.evaluate(() => window.eval(`state.orders[0].status`))).toBe("Em execução");

  const pauses = await page.evaluate(() => window.eval(`orderAuditEvents(state.orders[0]).filter(item => item.type === "OS_PAUSADA" || item.type === "OS_RETOMADA")`));
  expect(pauses.map((event: { type:string }) => event.type)).toEqual(["OS_PAUSADA", "OS_RETOMADA", "OS_PAUSADA", "OS_RETOMADA"]);
  expect(pauses[0].pausePeriodId).toBe(pauses[1].pausePeriodId);
  expect(pauses[2].pausePeriodId).toBe(pauses[3].pausePeriodId);
  expect(pauses[0].pausePeriodId).not.toBe(pauses[2].pausePeriodId);
});

test("tempo efetivo desconta pausas e histórico não mistura registros de outra O.S.", async ({ page }) => {
  const result = await page.evaluate(() => window.eval(`
    state.maintenanceJournal = [
      { id:"own-note", orderId:"qa-order-1", description:"Registro permitido", createdAt:1760000100000 },
      { id:"foreign-note", orderId:"other-tenant-order", description:"EVENTO SIGILOSO", createdAt:1760000200000 }
    ];
    ({
      effective:gmEffectiveOrderHours({ startedAt:1000000, pauseHours:0.5 }, 1000000 + 2 * 36e5),
      openPause:gmEffectiveOrderHours({ startedAt:1000000, pauseHours:0.25, pausedAt:1000000 + 1.5 * 36e5 }, 1000000 + 2 * 36e5),
      events:orderAuditEvents(state.orders[0])
    })
  `));
  expect(result.effective).toBe(1.5);
  expect(result.openPause).toBe(1.25);
  expect(result.events.some((event: { text?:string }) => event.text === "Registro permitido")).toBe(true);
  expect(result.events.some((event: { text?:string }) => event.text === "EVENTO SIGILOSO")).toBe(false);
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
