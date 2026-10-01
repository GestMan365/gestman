import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../assets/work-order-desktop-alerts.js", import.meta.url), "utf8");

function environment() {
  const values = new Map();
  const notifications = [];
  class NotificationMock {
    static permission = "granted";
    static async requestPermission() { return this.permission; }
    constructor(title, options) { this.title = title; this.options = options; notifications.push(this); }
    close() {}
  }
  class AudioContextMock {
    state = "running";
    currentTime = 0;
    destination = {};
    async resume() {}
    createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
    createOscillator() { return { frequency: { setValueAtTime() {} }, connect() {}, start() {}, stop() {}, type: "" }; }
  }
  const window = {
    Notification: NotificationMock,
    AudioContext: AudioContextMock,
    localStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) },
    setTimeout: callback => callback(),
    focus() {},
    stage20EmitNotification() {},
    document: null
  };
  vm.runInNewContext(source, { window });
  return { api: window.gmWorkOrderDesktopAlerts, notifications };
}

const account = { company: { id: "empresa-qa" }, user: { id: "usuario-qa" } };

test("não alerta ordens antigas no primeiro carregamento", () => {
  const { api, notifications } = environment();
  api.observe([], [{ id: "os-antiga", status: "Aberta", number: "OS-001" }], account);
  assert.equal(notifications.length, 0);
});

test("alerta uma única vez cada nova O.S. aberta", async () => {
  const { api, notifications } = environment();
  await api.configure(account);
  const initial = [{ id: "os-antiga", status: "Aberta", number: "OS-001" }];
  const next = [...initial, { id: "os-nova", status: "Aberta", number: "OS-002", title: "Falha na bomba", priority: "Alta" }];
  api.observe([], initial, account);
  assert.deepEqual(Array.from(api.observe(initial, next, account)), ["os-nova"]);
  assert.equal(notifications.length, 1);
  assert.match(notifications[0].title, /OS-002/);
  assert.deepEqual(Array.from(api.observe(initial, next, account)), []);
  assert.equal(notifications.length, 1);
});

test("não alerta ordem nova que já nasceu encerrada", async () => {
  const { api, notifications } = environment();
  await api.configure(account);
  api.observe([], [], account);
  api.observe([], [{ id: "os-fechada", status: "Concluída", number: "OS-003" }], account);
  assert.equal(notifications.length, 0);
});
