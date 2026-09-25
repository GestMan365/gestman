import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const copy = value => JSON.parse(JSON.stringify(value));
function declaration(name) {
  const matches = [...html.matchAll(new RegExp(`^    (?:async )?function ${name}\\(`, 'gm'))];
  const start = matches.at(-1)?.index;
  assert.notEqual(start, undefined, name);
  const remaining = html.slice(start);
  const end = remaining.slice(1).search(/\n    (?:async )?function /);
  return end < 0 ? remaining : remaining.slice(0, end + 1);
}
function harness() {
  const ctx = {
    currentAccount: { company: { id: 'qa-a' }, user: { id: 'qa-user' } },
    state: { orders: [{ id: 'os-a' }], assets: [] },
    gmRemoteLastSavedState: { orders: [], assets: [] },
    gmRemoteSavePromise: Promise.resolve(), gmRemoteSaveTimer: null,
    gmRemoteStateVersion: 4, gmRemoteStateUpdatedAt: '', gmStateDirty: true,
    gmSyncConflict: null, hasPendingLocalSync: true, hasSessionLocalChange: true,
    normalizeState: copy, gmNormalizeRemoteState: copy, clearTimeout,
    gmInvalidateMaintenanceMetrics() {}, gmScheduleMaintenanceMetricsRender() {},
    notifyOsPanelUpdate() {}, dispatchWhatsAppOrderEvents() {}, stage21TechnicalLog() {},
    gmShowSyncConflictModal() {}, showToast() {}, gmDowntimeTransitionErrorMessage: String,
    gmRpc: async () => [{ version: 5, updated_at: '2026-09-25T10:00:00Z' }],
  };
  vm.createContext(ctx);
  vm.runInContext(['gmChangedTopLevelKeys', 'gmHandleStateConflict', 'gmPersistState', 'gmPersistStateNow'].map(declaration).join('\n'), ctx);
  return ctx;
}
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

test('serializa salvamentos e mantém edições feitas durante a resposta anterior', async () => {
  const c = harness(), first = deferred(), second = deferred(), entered = deferred();
  const calls = [];
  c.gmRpc = async (_name, body) => { calls.push(copy(body)); if (calls.length === 1) { entered.resolve(); return first.promise; } return second.promise; };
  const a = c.gmPersistState();
  await entered.promise;
  c.state.orders.push({ id: 'os-b' });
  const b = c.gmPersistState();
  assert.equal(calls.length, 1);
  first.resolve([{ version: 5 }]);
  assert.equal(await a, true);
  assert.equal(c.gmStateDirty, true);
  assert.equal(c.gmRemoteLastSavedState.orders.length, 1);
  second.resolve([{ version: 6 }]);
  assert.equal(await b, true);
  assert.deepEqual(calls.map(item => item.p_expected_version), [4, 5]);
  assert.equal(calls[1].p_state.orders.length, 2);
  assert.equal(c.gmStateDirty, false);
});

test('resposta vazia não confirma gravação e uma nova tentativa continua possível', async () => {
  const c = harness();
  c.gmRpc = async () => [];
  assert.equal(await c.gmPersistState(), false);
  assert.equal(c.gmStateDirty, true);
  assert.equal(c.gmRemoteStateVersion, 4);
  c.gmRpc = async () => [{ version: 5 }];
  assert.equal(await c.gmPersistState(), true);
});

test('falha de rede preserva novas edições e não quebra a fila', async () => {
  const c = harness(), gate = deferred(), entered = deferred();
  c.gmRpc = async () => { entered.resolve(); return gate.promise; };
  const save = c.gmPersistState();
  await entered.promise;
  c.state.orders.push({ id: 'os-b' });
  gate.reject(new Error('network lost'));
  assert.equal(await save, false);
  assert.equal(c.state.orders.length, 2);
  assert.equal(c.gmStateDirty, true);
  c.gmRpc = async () => [{ version: 5 }];
  assert.equal(await c.gmPersistState(), true);
});

test('resposta de outra conta não altera estado nem versão da sessão atual', async () => {
  const c = harness(), gate = deferred(), entered = deferred();
  c.gmRpc = async () => { entered.resolve(); return gate.promise; };
  const old = c.gmPersistState();
  await entered.promise;
  c.currentAccount = { company: { id: 'qa-b' } };
  c.state = { orders: [{ id: 'tenant-b-order' }] };
  c.gmRemoteStateVersion = 20;
  const next = c.gmPersistState();
  gate.resolve([{ version: 5 }]);
  assert.equal(await old, false);
  c.gmRpc = async () => [{ version: 21 }];
  await next;
  assert.equal(c.state.orders[0].id, 'tenant-b-order');
  assert.notEqual(c.gmRemoteStateVersion, 5);
});

test('sem sessão não existe falso sucesso de persistência', async () => {
  const c = harness(); c.currentAccount = null;
  assert.equal(await c.gmPersistState(), false);
});

test('resposta perdida é reconhecida pela releitura idêntica sem repetir a escrita', async () => {
  const c = harness(); let saves = 0;
  c.gmRpc = async name => {
    if (name === 'gm_load_tenant_state') return [{ version: 5, state: copy(c.state) }];
    saves++; throw new Error('GM_STATE_CONFLICT');
  };
  assert.equal(await c.gmPersistState(), true);
  assert.equal(saves, 1);
  assert.equal(c.gmRemoteStateVersion, 5);
  assert.equal(c.gmStateDirty, false);
  assert.equal(c.gmSyncConflict, null);
});

test('conflito em coleções distintas combina também edições recentes sem travar a fila', async () => {
  const c = harness(); let calls = 0;
  c.gmRpc = async (name, body) => {
    if (name === 'gm_load_tenant_state') {
      c.state.orders.push({ id: 'os-b' });
      return [{ version: 5, state: { orders: [], assets: [{ id: 'remote-asset' }] } }];
    }
    if (++calls === 1) throw new Error('GM_STATE_CONFLICT');
    assert.equal(body.p_expected_version, 5);
    assert.equal(body.p_state.orders.length, 2);
    assert.equal(body.p_state.assets.length, 1);
    return [{ version: 6 }];
  };
  assert.equal(await c.gmPersistState(), true);
  assert.equal(c.gmStateDirty, false);
});

test('conflito na mesma coleção preserva alterações e exige resolução explícita', async () => {
  const c = harness();
  c.gmRpc = async name => {
    if (name === 'gm_load_tenant_state') return [{ version: 5, state: { orders: [{ id: 'remote-order' }], assets: [] } }];
    throw new Error('GM_STATE_CONFLICT');
  };
  assert.equal(await c.gmPersistState(), false);
  assert.equal(c.state.orders[0].id, 'os-a');
  assert.deepEqual(Array.from(c.gmSyncConflict.overlapKeys), ['orders']);
});
