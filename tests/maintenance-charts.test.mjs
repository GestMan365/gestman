import test from 'node:test';
import assert from 'node:assert/strict';
import '../assets/maintenance-charts.js';
import { calculateMaintenanceMetrics } from '../supabase/functions/_shared/maintenance-metrics.ts';
const { model } = globalThis.GMMaintenanceCharts;
const point = (value, quality = 'valid') => ({ value, quality, start: '2026-09-01T00:00:00Z', end: '2026-09-10T23:59:59Z', recordCount: 2 });

test('preserva lacunas, zero real e dados parciais sem conectar períodos ausentes', () => {
  const card = model({ series: { mttr: [point(4), point(null), point(0), point(2, 'partial')] } })[0];
  assert.deepEqual(card.points.map(p => p.value), [4, null, 0, 2]);
  assert.deepEqual(card.segments.map(s => s.length), [1, 2]);
  assert.equal(card.points[3].quality, 'partial');
  assert.equal(card.points[0].range, '01/09/2026 – 10/09/2026');
});

test('rejeita valores não finitos, negativos e disponibilidade acima de 100%', () => {
  const cards = model({ series: { mttr: [point(''), point(NaN), point(Infinity), point(-1), point(4, 'insufficient')], availability: [point(101), point(0), point(100)] } });
  assert.equal(cards[0].valid, 0);
  assert.deepEqual(cards[2].points.map(p => p.value), [null, 0, 100]);
  assert.equal(cards[2].ceiling, 100);
});

test('total vem do contrato, não da média dos intervalos; escalas independentes', () => {
  const cards = model({ metrics: { mttr: { value: 2.8, quality: { state: 'valid' } } }, series: { mttr: [point(1), point(9)], mtbf: [point(600), point(900)] } });
  assert.equal(cards[0].value, 2.8);
  assert.equal(cards[0].ceiling, 9);
  assert.equal(cards[1].ceiling, 900);
  assert.equal(cards[1].value, null);
});

test('base vazia não gera pontos nem indicador fictício', () => {
  for (const card of model(calculateMaintenanceMetrics({}, { seriesBuckets: 6 }, '2026-09-23T12:00:00Z'))) {
    assert.equal(card.value, null);
    assert.equal(card.valid, 0);
    assert.equal(card.segments.length, 0);
    assert.equal(card.referenceY, null);
  }
});

test('referência usa agregado oficial com um ponto e não preenche lacunas', () => {
  const card = model({ metrics: { mttr: { value: 6.52, quality: { state: 'valid' } } }, series: { mttr: [point(null), point(null), point(6.52)] } })[0];
  assert.equal(card.value, 6.52);
  assert.equal(card.valid, 1);
  assert.deepEqual(card.points.map(p => p.value), [null, null, 6.52]);
  assert.equal(card.referenceY, card.points[2].y);
});

test('escala inclui referência fora da série e distingue zero de base insuficiente', () => {
  const cards = model({ metrics: { mttr: { value: 20, quality: { state: 'partial' } }, mtbf: { value: 0, quality: { state: 'valid' } }, availability: { value: 95, quality: { state: 'insufficient' } } }, series: { mttr: [point(1)] } });
  assert.equal(cards[0].ceiling, 20);
  assert.equal(cards[0].referenceY, 32);
  assert.equal(cards[1].referenceY, 174);
  assert.equal(cards[2].referenceY, null);
});

test('renderizador preserva MTTR calculado pelo contrato com registros operacionais', () => {
  const contract = calculateMaintenanceMetrics({ assets: [{ id: 'a', status: 'Operando' }], orders: [
    { id: 'o1', assetId: 'a', type: 'Corretiva', status: 'Concluída', actualHours: 2, finishedAt: '2026-09-10T15:00:00Z' },
    { id: 'o2', assetId: 'a', type: 'Corretiva', status: 'Concluída', actualHours: 4, finishedAt: '2026-09-11T15:00:00Z' },
    { id: 'o3', assetId: 'a', type: 'Preventiva', status: 'Concluída', actualHours: 100, finishedAt: '2026-09-11T15:00:00Z' },
  ] }, { start: '2026-09-01', end: '2026-09-23', seriesBuckets: 6 }, '2026-09-23T18:00:00Z');
  assert.equal(contract.metrics.mttr.value, 3);
  const card = model(contract)[0];
  assert.equal(card.value, 3);
  assert.equal(card.metric.recordCount, 2);
  assert.deepEqual(card.points.map(p => p.value), contract.series.mttr.map(p => p.value));
});
