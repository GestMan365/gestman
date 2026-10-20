import test from "node:test";
import assert from "node:assert/strict";

import { calculateMaintenanceMetrics } from "../supabase/functions/_shared/maintenance-metrics.ts";

const NOW = "2026-08-10T18:00:00.000Z";
const PERIOD = {
  period: "custom",
  start: "2026-08-10",
  end: "2026-08-10",
};

function baseState(overrides = {}) {
  return {
    assets: [],
    orders: [],
    downtimes: [],
    operationalCalendars: [],
    productiveCalendars: [],
    measurementPoints: [],
    measurements: [],
    pendingActions: [],
    spareParts: [],
    regions: [],
    locations: [],
    sectorsLocations: [],
    installationStructures: [],
    operationalAreas: [],
    ...overrides,
  };
}

function activeAsset(id = "asset-1") {
  return {
    id,
    code: id.toUpperCase(),
    name: `Ativo ${id}`,
    status: "Operando",
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

function mondayCalendar(overrides = {}) {
  return {
    id: "calendar-1",
    name: "Turno de segunda-feira",
    status: "Ativo",
    default: true,
    weekdays: [1],
    startTime: "08:00",
    endTime: "16:00",
    ...overrides,
  };
}

test("contribuições explicam reparos e atribuem cada hora de parada uma única vez", () => {
  const asset = activeAsset();
  const result = calculateMaintenanceMetrics(baseState({
    assets: [asset],
    operationalCalendars: [mondayCalendar()],
    orders: [{ id: "o1", assetId: asset.id, maintenanceType: "Corretiva", status: "Concluída", actualHours: 2, finishedAt: "2026-08-10T15:00:00.000Z" }],
    downtimes: [
      { id: "d1", assetId: asset.id, status: "Encerrada", startAt: "2026-08-10T10:00:00.000Z", endAt: "2026-08-10T12:00:00.000Z" },
      { id: "d2", assetId: asset.id, status: "Encerrada", startAt: "2026-08-10T11:00:00.000Z", endAt: "2026-08-10T13:00:00.000Z" },
    ],
  }), { ...PERIOD, seriesBuckets: 1 }, NOW);
  assert.equal(result.metrics.mttr.calculation.numerator, 2);
  assert.equal(result.metrics.mttr.calculation.denominator, 1);
  assert.equal(result.metrics.mttr.calculation.contributions[0].amount, 2);
  assert.deepEqual(result.metrics.availability.calculation.contributions.map(item => item.amount), [2, 1]);
  assert.equal(result.metrics.availability.calculation.numerator, 5);
  assert.equal(result.metrics.availability.calculation.denominator, 8);
  assert.equal(result.metrics.availability.value, 62.5);
  assert.equal(result.metrics.mtbf.value, 5);
  assert.deepEqual(result.metrics.mtbf.recordIds, ["o1", "d1", "d2"]);
  assert.deepEqual(result.series.availability[0].calculation.contributions.map(item => item.amount), [2, 1]);
});

test("preserva ausência de evidência como null, sem fabricar zero", () => {
  const result = calculateMaintenanceMetrics(baseState(), PERIOD, NOW);

  assert.equal(result.version, 1);
  assert.equal(result.metrics.mttr.value, null);
  assert.equal(result.metrics.mtbf.value, null);
  assert.equal(result.metrics.availability.value, null);
  assert.equal(result.metrics.openOrders.value, 0);
  assert.equal(result.metrics.mttr.quality.state, "insufficient");
  assert.equal(result.metrics.availability.quality.state, "insufficient");
});

test("reparo de um segundo mantém duração e contribuição positivas sem arredondar para zero", () => {
  const result = calculateMaintenanceMetrics(baseState({
    orders: [{ id: "short", maintenanceType: "Corretiva", status: "Concluída", startedAt: "2026-08-10T10:00:00Z", finishedAt: "2026-08-10T10:00:01Z" }],
  }), PERIOD, NOW);
  const metric = result.metrics.mttr;
  assert.equal(metric.value, 1 / 3600);
  assert.equal(metric.calculation.contributions[0].amount, 1 / 3600);
  assert.match(metric.calculation.contributions[0].effect, /Inclui 1 s no total/);
  assert.match(metric.calculation.explanation, /1 s por reparo/);
});

test("parada histórica contribui antes do cadastro; ausências de calendário e de jornada continuam explícitas", () => {
  const asset = { ...activeAsset(), createdAt: "2026-10-10T14:52:05Z" };
  const other = activeAsset("other");
  const result = calculateMaintenanceMetrics(baseState({
    assets: [asset, other],
    operationalCalendars: [mondayCalendar({ default: false, assetId: asset.id, weekdays: [1, 2, 3, 4, 5], startTime: "11:00", endTime: "20:00", breakMinutes: 60 })],
    downtimes: [
      { id: "historical", assetId: asset.id, startAt: "2026-10-09T13:00:00Z", endAt: "2026-10-09T15:00:00Z" },
      { id: "missing", assetId: other.id, startAt: "2026-10-19T13:00:00Z", endAt: "2026-10-19T15:00:00Z" },
      { id: "weekend", assetId: asset.id, startAt: "2026-10-11T13:00:00Z", endAt: "2026-10-11T15:00:00Z" },
    ],
  }), { period: "custom", start: "2026-10-01", end: "2026-10-20" }, "2026-10-20T21:00:00Z");
  const rows = result.metrics.availability.calculation.contributions;
  assert.deepEqual(rows.map(item => item.amount), [2, 0, 0]);
  assert.match(rows[0].effect, /3,13 ponto/);
  assert.match(rows[1].effect, /Sem calendário operacional válido/);
  assert.match(rows[2].effect, /fora dos dias ou horários/);
  assert.equal(result.metrics.availability.calculation.denominator, 64);
  assert.equal(result.metrics.availability.value, 96.875);
  assert.equal(result.metrics.availability.quality.state, "partial");
  assert.equal(result.metrics.mtbf.calculation.contributions.find(item => item.recordIds.includes("historical")).amount, 2);
  assert.equal(rows[1].reasonCode, "missing_calendar");
  assert.equal(rows[1].assetId, other.id);
});

test("intervalo inteiro anterior ao cadastro ainda inclui o ativo com parada histórica válida", () => {
  const asset = {...activeAsset(),createdAt:"2026-08-12T00:00:00Z"};
  const result = calculateMaintenanceMetrics(baseState({assets:[asset],operationalCalendars:[mondayCalendar()],downtimes:[
    {id:"historical",assetId:asset.id,startAt:"2026-08-10T10:00:00Z",endAt:"2026-08-10T12:00:00Z"},
  ],orders:[{id:"repair",assetId:asset.id,maintenanceType:"Corretiva",status:"Concluída",actualHours:1,finishedAt:"2026-08-10T13:00:00Z"}]}),PERIOD,NOW);
  assert.equal(result.metrics.availability.value,75);
  assert.equal(result.metrics.mtbf.value,6);
  assert.equal(result.metrics.mttr.value,1);
});

test("calcula MTTR somente com corretivas concluídas e duração válida", () => {
  const asset = activeAsset();
  const state = baseState({
    assets: [asset],
    orders: [
      {
        id: "order-1",
        assetId: asset.id,
        maintenanceType: "Corretiva",
        status: "Concluída",
        startedAt: "2026-08-10T08:00:00.000Z",
        finishedAt: "2026-08-10T12:00:00.000Z",
      },
      {
        id: "order-2",
        assetId: asset.id,
        maintenanceType: "Corretiva",
        status: "Finalizada",
        actualHours: 2,
        finishedAt: "2026-08-10T15:00:00.000Z",
      },
      {
        id: "order-preventive",
        assetId: asset.id,
        maintenanceType: "Preventiva",
        status: "Concluída",
        actualHours: 20,
        finishedAt: "2026-08-10T14:00:00.000Z",
      },
    ],
  });

  const result = calculateMaintenanceMetrics(state, PERIOD, NOW);

  assert.equal(result.metrics.mttr.value, 3);
  assert.equal(result.metrics.mttr.recordCount, 2);
  assert.deepEqual(result.metrics.mttr.recordIds.sort(), ["order-1", "order-2"]);
  assert.equal(result.metrics.mttr.quality.state, "valid");
});

test("calcula disponibilidade pelo calendário e consolida paradas por ativo", () => {
  const first = activeAsset("asset-1");
  const second = activeAsset("asset-2");
  const state = baseState({
    assets: [first, second],
    operationalCalendars: [mondayCalendar()],
    downtimes: [
      { id: "stop-1", assetId: first.id, status: "Encerrada", startAt: "2026-08-10T10:00:00.000Z", endAt: "2026-08-10T12:00:00.000Z" },
      { id: "stop-2", assetId: first.id, status: "Encerrada", startAt: "2026-08-10T11:00:00.000Z", endAt: "2026-08-10T13:00:00.000Z" },
      { id: "stop-3", assetId: second.id, status: "Encerrada", startAt: "2026-08-10T10:00:00.000Z", endAt: "2026-08-10T12:00:00.000Z" },
    ],
  });

  const result = calculateMaintenanceMetrics(state, PERIOD, NOW);

  assert.equal(result.metrics.stopHours.value, 5);
  assert.equal(result.metrics.availability.value, 68.75);
  assert.equal(result.metrics.availability.quality.state, "valid");
  assert.match(result.metrics.availability.detail, /5\.0h de parada em 16\.0h programadas/i);
});

test("não calcula disponibilidade sem calendário operacional vinculável", () => {
  const result = calculateMaintenanceMetrics(
    baseState({ assets: [activeAsset()] }),
    PERIOD,
    NOW,
  );

  assert.equal(result.metrics.availability.value, null);
  assert.equal(result.metrics.availability.quality.state, "insufficient");
  assert.equal(result.quality.assetsWithoutOperationalCalendar, 1);
});

test("usa variação positiva de horímetro para MTBF", () => {
  const asset = activeAsset();
  const state = baseState({
    assets: [asset],
    orders: [{
      id: "failure-1",
      assetId: asset.id,
      maintenanceType: "Corretiva",
      status: "Concluída",
      actualHours: 1,
      finishedAt: "2026-08-10T14:00:00.000Z",
    }],
    measurementPoints: [{ id: "meter-1", assetId: asset.id, measurementType: "Horímetro", unit: "h" }],
    measurements: [
      { id: "reading-1", pointId: "meter-1", value: 100, readAt: "2026-08-09T18:00:00.000Z" },
      { id: "reading-2", pointId: "meter-1", value: 108, readAt: "2026-08-10T17:00:00.000Z" },
    ],
  });

  const result = calculateMaintenanceMetrics(state, PERIOD, NOW);

  assert.equal(result.metrics.mtbf.value, 8);
  assert.equal(result.metrics.mtbf.quality.state, "valid");
  assert.match(result.metrics.mtbf.quality.reason, /horímetros válidos/i);
});

test("não classifica O.S. urgente sem prazo como atrasada e sinaliza qualidade", () => {
  const asset = activeAsset();
  const state = baseState({
    assets: [asset],
    orders: [{
      id: "urgent-no-deadline",
      assetId: asset.id,
      status: "Aberta",
      priority: "Urgente",
      createdAt: "2026-08-10T09:00:00.000Z",
    }],
  });

  const result = calculateMaintenanceMetrics(state, PERIOD, NOW);

  assert.equal(result.metrics.lateOrders.value, 0);
  assert.equal(result.metrics.lateOrders.quality.state, "partial");
  assert.equal(result.quality.urgentOrdersWithoutDeadline, 1);
});

test("aplica filtro de ativo e gera série sem preencher lacunas artificialmente", () => {
  const first = activeAsset("asset-1");
  const second = activeAsset("asset-2");
  const state = baseState({
    assets: [first, second],
    orders: [
      { id: "first-order", assetId: first.id, maintenanceType: "Corretiva", status: "Concluída", actualHours: 2, finishedAt: "2026-08-10T10:00:00.000Z" },
      { id: "second-order", assetId: second.id, maintenanceType: "Corretiva", status: "Concluída", actualHours: 9, finishedAt: "2026-08-10T11:00:00.000Z" },
      { id: "orphan-order", maintenanceType: "Corretiva", status: "Concluída", actualHours: 20, finishedAt: "2026-08-10T12:00:00.000Z" },
    ],
  });

  const result = calculateMaintenanceMetrics(
    state,
    { ...PERIOD, asset: first.id, seriesBuckets: 2 },
    NOW,
  );

  assert.equal(result.metrics.mttr.value, 2);
  assert.deepEqual(result.metrics.mttr.recordIds, ["first-order"]);
  assert.equal(result.series.mttr.length, 2);
  assert.ok(result.series.mttr.some((item) => item.value === null));
  assert.ok(result.series.mttr.some((item) => item.value === 2));
});
