import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const functionBody = name => {
  const start = html.indexOf(`function ${name}`);
  const next = start < 0 ? -1 : html.indexOf("\n    function ", start + 12);
  assert.notEqual(start, -1, `Função ${name} ausente do frontend oficial`);
  return html.slice(start, next < 0 ? html.length : next);
};
const auditContext = {
  state:{ maintenanceJournal:[], materialRequests:[], spareParts:[] },
  normalizeTextKey:value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(),
  orderTabArray:(order, key) => Array.isArray(order?.[key]) ? order[key] : [],
  spareName:id => `Peça ${id}`,
  stockName:id => `Estoque ${id}`,
  byId:(rows, id) => rows.find(item => item.id === id),
  formatQuantityForUnit:value => String(value),
  formatDateTime:value => String(value),
};
vm.createContext(auditContext);
vm.runInContext([
  functionBody("orderAuditTime"),
  functionBody("orderAuditStatusDetails"),
  functionBody("orderAuditEventType"),
  functionBody("orderAuditEventDescription"),
  functionBody("orderAuditEvents"),
  functionBody("gmOrderTimeMs"),
  functionBody("gmEffectiveOrderHours"),
].join("\n"), auditContext);
const auditEvents = order => JSON.parse(JSON.stringify(auditContext.orderAuditEvents(order)));

const transitions = new Map([
  ["Planejada", new Set(["Aberta", "Em execução", "Cancelada"])],
  ["Aberta", new Set(["Em execução", "Aguardando material", "Cancelada"])],
  ["Aguardando material", new Set(["Em execução", "Pausada", "Cancelada"])],
  ["Em execução", new Set(["Pausada", "Aguardando material", "Concluída", "Cancelada"])],
  ["Pausada", new Set(["Em execução", "Aguardando material", "Cancelada"])],
]);

const allowed = (from, to) => transitions.get(from)?.has(to) === true;

test("fluxo operacional principal é permitido", () => {
  assert.equal(allowed("Aberta", "Em execução"), true);
  assert.equal(allowed("Em execução", "Pausada"), true);
  assert.equal(allowed("Pausada", "Em execução"), true);
  assert.equal(allowed("Em execução", "Concluída"), true);
});

test("estados encerrados são terminais", () => {
  assert.equal(allowed("Concluída", "Em execução"), false);
  assert.equal(allowed("Cancelada", "Aberta"), false);
});

test("não é possível concluir sem iniciar", () => {
  assert.equal(allowed("Aberta", "Concluída"), false);
  assert.equal(allowed("Planejada", "Concluída"), false);
  assert.equal(allowed("Pausada", "Concluída"), false);
});

test("espera de material e cancelamento preservam caminhos controlados", () => {
  assert.equal(allowed("Aberta", "Aguardando material"), true);
  assert.equal(allowed("Aguardando material", "Em execução"), true);
  assert.equal(allowed("Aguardando material", "Cancelada"), true);
});

test("auditoria oficial ordena e vincula pausa e retomada", () => {
  const order = {
    id:"os-1",
    requester:"Solicitante",
    createdAt:1000,
    startedAt:2000,
    history:[
      { id:"resume-1", date:4000, action:"RESUMED", type:"Status", text:"Pausada → Em execução", owner:"Técnico" },
      { id:"pause-1", date:3000, action:"PAUSED", type:"Status", text:"Em execução → Pausada · Aguardando liberação", owner:"Técnico" },
      { id:"start-1", date:2000, action:"STARTED", type:"Status", text:"Aberta → Em execução", owner:"Técnico" },
    ]
  };
  const events = auditEvents(order);
  assert.deepEqual(events.map(item => item.type), ["CRIACAO", "EXECUCAO_INICIADA", "OS_PAUSADA", "OS_RETOMADA"]);
  assert.deepEqual(events.map(item => item.date), [1000, 2000, 3000, 4000]);
  assert.equal(events[2].reason, "Aguardando liberação");
  assert.equal(events[2].previousStatus, "Em execução");
  assert.equal(events[2].newStatus, "Pausada");
  assert.equal(events[2].user, "Técnico");
  assert.equal(events[3].pausePeriodId, events[2].pausePeriodId);
  assert.equal(events[3].pauseStartedAt, 3000);
  assert.equal(events[3].pauseEndedAt, 4000);
});

test("múltiplas pausas geram referências independentes", () => {
  const order = { id:"os-2", history:[
    { id:"pause-a", date:1000, action:"PAUSED", text:"Em execução → Pausada · Motivo A" },
    { id:"resume-a", date:2000, action:"RESUMED", text:"Pausada → Em execução" },
    { id:"pause-b", date:3000, action:"PAUSED", text:"Em execução → Pausada · Motivo B" },
    { id:"resume-b", date:4000, action:"RESUMED", text:"Pausada → Em execução" },
  ] };
  const events = auditEvents(order);
  assert.equal(events[0].pausePeriodId, events[1].pausePeriodId);
  assert.equal(events[2].pausePeriodId, events[3].pausePeriodId);
  assert.notEqual(events[0].pausePeriodId, events[2].pausePeriodId);
});

test("tempo efetivo exclui pausas acumuladas e pausa aberta", () => {
  assert.equal(auditContext.gmEffectiveOrderHours({ startedAt:1000000, pauseHours:0.5 }, 1000000 + 2 * 36e5), 1.5);
  assert.equal(auditContext.gmEffectiveOrderHours({ startedAt:1000000, pauseHours:0.25, pausedAt:1000000 + 1.5 * 36e5 }, 1000000 + 2 * 36e5), 1.25);
});

test("histórico operacional isola apontamentos por ordem", () => {
  auditContext.state.maintenanceJournal = [
    { id:"own", orderId:"os-tenant-a", description:"Registro permitido", createdAt:2000 },
    { id:"foreign", orderId:"os-tenant-b", description:"EVENTO SIGILOSO", createdAt:3000 },
  ];
  const events = auditEvents({ id:"os-tenant-a", createdAt:1000, history:[] });
  assert.equal(events.some(item => item.text === "Registro permitido"), true);
  assert.equal(events.some(item => item.text === "EVENTO SIGILOSO"), false);
});
