import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const start = html.lastIndexOf("async function loadSupabaseState(");
const end = html.indexOf("\n    async function syncSupabaseNow", start);
const source = html.slice(start, end);
function fixture() {
  const context = {
    currentAccount: { company: { id: "qa-company" } },
    SUPABASE_READY: true, isLoadingRemote: false, gmStateDirty: false,
    gmRemoteStateVersion: 1, gmRemoteStateUpdatedAt: "old", state: { marker: "original" },
    blocked: false, calls: 0, renders: 0,
    gmLiveHealth: { checkedAt: 0, failed: false }, gmRenderLiveHealth: () => {},
    gmBackgroundRefreshBlocked: () => context.blocked,
    gmRpc: async () => { context.calls++; return { version: 2, updated_at: "new", state: { marker: "remote" } }; },
    gmNormalizeRemoteState: value => value, normalizeState: value => value,
    gmLoadOperationalUsers: async () => {}, gmInvalidateMaintenanceMetrics: () => {},
    captureSyncBaseline: () => {}, gmRenderPreservingViewport: callback => callback(),
    render: () => { context.renders++; }, showToast: () => {}, stage21TechnicalLog: () => {},
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return context;
}

test("sincronização aplica nova versão sem escrever no servidor", async () => {
  const c = fixture();
  assert.equal(await c.loadSupabaseState(false), true);
  assert.equal(c.state.marker, "remote");
  assert.equal(c.renders, 1);
  assert.equal(c.isLoadingRemote, false);
});
test("versão inalterada não redesenha a interface", async () => {
  const c = fixture();
  c.gmRpc = async () => ({ version: 1, updated_at: "old", state: {} });
  assert.equal(await c.loadSupabaseState(false), true);
  assert.equal(c.renders, 0);
});
test("formulário aberto adia atualização automática", async () => {
  const c = fixture(); c.blocked = true;
  assert.equal(await c.loadSupabaseState(false), false);
  assert.equal(c.calls, 0);
});
for (const change of ["edit", "save", "account", "form"]) {
  test("resposta atrasada descartada: " + change, async () => {
    const c = fixture();
    let release;
    c.gmRpc = () => new Promise(resolve => { release = resolve; });
    const pending = c.loadSupabaseState(false);
    if (change === "edit") c.gmStateDirty = true;
    if (change === "save") c.gmRemoteStateVersion++;
    if (change === "account") c.currentAccount = { company: { id: "other" } };
    if (change === "form") c.blocked = true;
    release({ version: 2, updated_at: "new", state: { marker: "remote" } });
    assert.equal(await pending, false);
    assert.equal(c.state.marker, "original");
    assert.equal(c.renders, 0);
  });
}
test("edição durante carregamento dos executantes também é preservada", async () => {
  const c = fixture();
  c.gmLoadOperationalUsers = async () => { c.gmStateDirty = true; };
  assert.equal(await c.loadSupabaseState(false), false);
  assert.equal(c.state.marker, "original");
});
test("falha de conexão preserva dados e libera próxima tentativa", async () => {
  const c = fixture(); c.gmRpc = async () => { throw Error("offline"); };
  assert.equal(await c.loadSupabaseState(false), false);
  assert.equal(c.state.marker, "original");
  assert.equal(c.isLoadingRemote, false);
});
test("carga explícita continua disponível durante inicialização", async () => {
  const c = fixture(); c.blocked = true;
  assert.equal(await c.loadSupabaseState(false, true), true);
  assert.equal(c.state.marker, "remote");
});
