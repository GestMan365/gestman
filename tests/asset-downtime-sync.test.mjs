import assert from "node:assert/strict";
import test from "node:test";

const active = downtime => downtime.status === "Ativa";

function openDowntime(state, downtime) {
  const asset = state.assets.find(item => item.id === downtime.assetId);
  if (!asset) throw new Error("GM_DOWNTIME_ASSET_NOT_FOUND");
  if (state.downtimes.some(item => item.assetId === asset.id && active(item))) {
    throw new Error("GM_ASSET_ACTIVE_DOWNTIME_EXISTS");
  }
  const opened = {
    ...downtime,
    status:"Ativa",
    previousAssetStatus:asset.status || "Operando",
    durationMs:null,
    history:[{ action:"OPENED", immutable:true }],
  };
  return {
    ...state,
    assets:state.assets.map(item => item.id === asset.id
      ? { ...item, status:"Parado", activeDowntimeId:opened.id }
      : item),
    downtimes:[opened, ...state.downtimes],
  };
}

function finishDowntime(state, id, action, endAt, reason) {
  const downtime = state.downtimes.find(item => item.id === id);
  if (!downtime || !active(downtime)) throw new Error("GM_DOWNTIME_NOT_ACTIVE");
  if (!reason?.trim()) throw new Error(action === "CLOSED"
    ? "GM_DOWNTIME_CLOSE_REASON_REQUIRED"
    : "GM_DOWNTIME_CANCEL_REASON_REQUIRED");
  const durationMs = endAt - downtime.startAt;
  if (durationMs < 0) throw new Error("GM_DOWNTIME_INTERVAL_INVALID");
  const status = action === "CLOSED" ? "Encerrada" : "Cancelada";
  return {
    ...state,
    assets:state.assets.map(item => item.id === downtime.assetId
      ? { ...item, status:downtime.previousAssetStatus || "Operando", activeDowntimeId:undefined }
      : item),
    downtimes:state.downtimes.map(item => item.id === id ? {
      ...item,
      status,
      endAt,
      durationMs,
      durationHours:durationMs / 3_600_000,
      history:[...item.history, { action, reason, immutable:true }],
    } : item),
  };
}

const initialState = () => ({
  assets:[{ id:"asset-1", status:"Operando" }],
  orders:[{ id:"order-1", assetId:"asset-1", status:"Em execução" }],
  downtimes:[],
});

test("abrir parada sincroniza o equipamento e preserva a O.S.", () => {
  const state = openDowntime(initialState(), {
    id:"downtime-1", assetId:"asset-1", orderId:"order-1", startAt:1_000, reason:"Falha",
  });
  assert.equal(state.assets[0].status, "Parado");
  assert.equal(state.assets[0].activeDowntimeId, "downtime-1");
  assert.equal(state.downtimes[0].previousAssetStatus, "Operando");
  assert.equal(state.downtimes[0].orderId, "order-1");
  assert.equal(state.orders[0].status, "Em execução");
});

test("uma máquina não aceita duas paradas ativas", () => {
  const state = openDowntime(initialState(), {
    id:"downtime-1", assetId:"asset-1", startAt:1_000, reason:"Falha",
  });
  assert.throws(() => openDowntime(state, {
    id:"downtime-2", assetId:"asset-1", startAt:2_000, reason:"Nova falha",
  }), /GM_ASSET_ACTIVE_DOWNTIME_EXISTS/);
});

test("encerrar calcula duração e restaura o estado anterior", () => {
  const opened = openDowntime(initialState(), {
    id:"downtime-1", assetId:"asset-1", orderId:"order-1", startAt:1_000, reason:"Falha",
  });
  const closed = finishDowntime(opened, "downtime-1", "CLOSED", 3_601_000, "Rolamento substituído");
  assert.equal(closed.assets[0].status, "Operando");
  assert.equal(closed.assets[0].activeDowntimeId, undefined);
  assert.equal(closed.downtimes[0].status, "Encerrada");
  assert.equal(closed.downtimes[0].durationMs, 3_600_000);
  assert.equal(closed.downtimes[0].durationHours, 1);
  assert.equal(closed.downtimes[0].orderId, "order-1");
});

test("cancelar exige justificativa e mantém histórico terminal", () => {
  const opened = openDowntime(initialState(), {
    id:"downtime-1", assetId:"asset-1", startAt:1_000, reason:"Alarme falso",
  });
  assert.throws(() => finishDowntime(opened, "downtime-1", "CANCELLED", 2_000, ""),
    /GM_DOWNTIME_CANCEL_REASON_REQUIRED/);
  const cancelled = finishDowntime(opened, "downtime-1", "CANCELLED", 2_000, "Registro duplicado");
  assert.equal(cancelled.downtimes[0].status, "Cancelada");
  assert.equal(cancelled.downtimes[0].history.at(-1).immutable, true);
  assert.throws(() => finishDowntime(cancelled, "downtime-1", "CLOSED", 3_000, "Tentativa"),
    /GM_DOWNTIME_NOT_ACTIVE/);
});
