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
      state.assets = [{ id:"qa-asset-1", code:"ATV-QA", name:"Equipamento QA", status:"Operando", statusHistory:[] }];
      state.orders = [{ id:"qa-order-1", number:"OS-QA-001", assetId:"qa-asset-1", status:"Em execução", history:[] }];
      state.downtimes = [];
      gmRemoteStateVersion = 8;
      gmRemoteLastSavedState = normalizeState(JSON.parse(JSON.stringify(state)));
      gmStateDirty = false;
      window.__qaDowntimeRpcCalls = [];
      gmRpc = async (name, body = {}) => {
        window.__qaDowntimeRpcCalls.push({ name, body });
        if (name !== "gm_transition_asset_downtime") return [];
        const now = Date.now();
        const action = body.p_action;
        const currentAsset = state.assets[0];
        if (action === "OPENED") {
          const downtime = {
            ...body.p_payload,
            id:body.p_downtime_id,
            status:"Ativa",
            previousAssetStatus:currentAsset.status,
            durationMs:null,
            history:[{ id:body.p_request_id, action:"OPENED", immutable:true }]
          };
          const asset = { ...currentAsset, status:"Parado", activeDowntimeId:downtime.id };
          return [{ version:body.p_expected_version + 1, updated_at:new Date(now).toISOString(), downtime_id:downtime.id, action, event_id:body.p_request_id, downtime_data:downtime, asset_data:asset }];
        }
        const current = state.downtimes[0];
        const endAt = new Date(body.p_payload.endAt).getTime();
        const startAt = new Date(current.startAt).getTime();
        const durationMs = endAt - startAt;
        const downtime = { ...current, ...body.p_payload, status:action === "CLOSED" ? "Encerrada" : "Cancelada", durationMs, durationHours:durationMs / 3600000, history:[...current.history, { id:body.p_request_id, action, immutable:true }] };
        const asset = { ...currentAsset, status:current.previousAssetStatus || "Operando" };
        delete asset.activeDowntimeId;
        return [{ version:body.p_expected_version + 1, updated_at:new Date(now).toISOString(), downtime_id:downtime.id, action, event_id:body.p_request_id, downtime_data:downtime, asset_data:asset }];
      };
    `);
  });
});

test("abertura e encerramento sincronizam ativo, parada e vínculo da O.S.", async ({ page }) => {
  await page.evaluate(() => window.eval(`gmTransitionAssetDowntime("OPENED", "qa-downtime-1", { assetId:"qa-asset-1", orderId:"qa-order-1", reason:"Falha mecânica", startAt:"2026-08-24T10:00:00.000Z" })`));
  await expect.poll(() => page.evaluate(() => window.eval(`state.assets[0].status`))).toBe("Parado");
  expect(await page.evaluate(() => window.eval(`state.assets[0].activeDowntimeId`))).toBe("qa-downtime-1");
  expect(await page.evaluate(() => window.eval(`state.downtimes[0].orderId`))).toBe("qa-order-1");
  expect(await page.evaluate(() => window.eval(`state.orders[0].status`))).toBe("Em execução");

  await page.evaluate(() => window.eval(`gmTransitionAssetDowntime("CLOSED", "qa-downtime-1", { endAt:"2026-08-24T11:00:00.000Z", cause:"Rolamento substituído" })`));
  await expect.poll(() => page.evaluate(() => window.eval(`state.assets[0].status`))).toBe("Operando");

  const result = await page.evaluate(() => ({
    calls:(window as typeof window & { __qaDowntimeRpcCalls:Array<{ name:string; body:Record<string, unknown> }> }).__qaDowntimeRpcCalls,
    version:window.eval("gmRemoteStateVersion"),
    downtime:window.eval("state.downtimes[0]"),
    asset:window.eval("state.assets[0]"),
    order:window.eval("state.orders[0]"),
  }));
  expect(result.calls).toHaveLength(2);
  expect(result.calls.every(call => call.name === "gm_transition_asset_downtime")).toBe(true);
  expect(result.calls[0].body.p_request_id).not.toBe(result.calls[1].body.p_request_id);
  expect(result.version).toBe(10);
  expect(result.downtime.status).toBe("Encerrada");
  expect(result.downtime.durationMs).toBe(3_600_000);
  expect(result.downtime.orderId).toBe("qa-order-1");
  expect(result.downtime.history).toHaveLength(2);
  expect(result.asset.activeDowntimeId).toBeUndefined();
  expect(result.order.status).toBe("Em execução");
});
