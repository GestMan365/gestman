import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const functionBody = name => {
  const syncStart = html.indexOf(`function ${name}(`);
  const asyncStart = html.indexOf(`async function ${name}(`);
  const start = asyncStart >= 0 && (syncStart < 0 || asyncStart < syncStart) ? asyncStart : syncStart;
  assert.notEqual(start, -1, `Função ${name} ausente do frontend oficial`);
  const boundaries = ["\n    function ", "\n    async function ", "\n    const "]
    .map(marker => html.indexOf(marker, start + 12))
    .filter(index => index >= 0);
  const next = boundaries.length ? Math.min(...boundaries) : -1;
  return html.slice(start, next < 0 ? html.length : next);
};

const fixedNow = new Date(2026, 7, 30, 0, 0, 2, 500).getTime();
class FixedDate extends Date {
  static now() { return fixedNow; }
}
const context = {
  Date:FixedDate,
  state:{ orders:[] },
  gmRemoteSaveTimer:null,
  gmRemoteSavePromise:Promise.resolve(),
  gmStateDirty:false,
  gmRemoteStateVersion:10,
  gmRemoteStateUpdatedAt:"",
  gmRemoteLastSavedState:null,
  gmSyncConflict:null,
  hasPendingLocalSync:false,
  hasSessionLocalChange:false,
  rpcCalls:[],
  uidSequence:0,
  clearTimeout:()=>{},
  byId:(rows,id)=>(Array.isArray(rows)?rows:[]).find(item=>item.id===id),
  normalizeState:value=>value,
  gmPersistState:async()=>true,
  gmInvalidateMaintenanceMetrics:()=>{},
  gmScheduleMaintenanceMetricsRender:()=>{},
  notifyOsPanelUpdate:()=>{},
  dispatchWhatsAppOrderEvents:()=>{},
  uid:prefix=>`${prefix}-${++context.uidSequence}`,
};
context.gmRpc = async (name, body) => {
  context.rpcCalls.push({name,body:JSON.parse(JSON.stringify(body))});
  const current = context.state.orders.find(order=>order.id===body.p_order_id);
  const eventTime = Number(body.p_patch.finishedAt);
  const event = {id:body.p_request_id,type:"Status",action:"COMPLETED",date:eventTime,immutable:true};
  const order = {...current,...body.p_patch,status:body.p_to_status,history:[...(current.history||[]),event]};
  return [{version:context.gmRemoteStateVersion+1,updated_at:new Date(eventTime).toISOString(),order_data:order}];
};
vm.createContext(context);
vm.runInContext([
  functionBody("statusKey"),
  functionBody("gmCanonicalOrderStatus"),
  functionBody("gmOrderTimeMs"),
  functionBody("gmLocalDateTimeMs"),
  functionBody("localDateTimeSecondsValue"),
  functionBody("gmNormalizeOrderCompletionTime"),
  functionBody("gmEffectiveOrderHours"),
  functionBody("gmPrepareWorkOrderTransitionPatch"),
  functionBody("gmTransitionWorkOrder"),
].join("\n"),context);

const local = (year,month,day,hour,minute,second,millisecond=0) => new Date(year,month-1,day,hour,minute,second,millisecond).getTime();
const plain = value => JSON.parse(JSON.stringify(value));
const order = startedAt => ({
  id:"os-2",number:"O.S-0002",companyId:"tenant-a",status:"Em execução",startedAt,
  executor:"Anderson Vieira",comment:"Serviço concluído",pauseHours:0,history:[],
});
const reset = startedAt => {
  context.state={orders:[order(startedAt)]};
  context.gmRemoteStateVersion=10;
  context.gmRemoteStateUpdatedAt="";
  context.gmRemoteLastSavedState=null;
  context.rpcCalls=[];
  context.uidSequence=0;
};

test("conclusão no mesmo minuto preserva segundos posteriores",()=>{
  const startedAt=local(2026,8,29,20,12,6,321);
  const now=local(2026,8,29,20,12,15,900);
  const finishedAt=context.gmNormalizeOrderCompletionTime(order(startedAt),"2026-08-29T20:12:10",now);
  assert.equal(finishedAt,local(2026,8,29,20,12,10));
  assert.ok(finishedAt>startedAt);
});

test("conclusão no mesmo segundo é normalizada para nunca preceder o início",()=>{
  const startedAt=local(2026,8,29,20,12,6,789);
  const now=local(2026,8,29,20,12,7,100);
  assert.equal(context.gmNormalizeOrderCompletionTime(order(startedAt),"2026-08-29T20:12:06",now),startedAt);
  assert.equal(context.gmNormalizeOrderCompletionTime(order(startedAt),startedAt,now),startedAt);
});

test("conclusão anterior e futura são bloqueadas",()=>{
  const startedAt=local(2026,8,29,20,12,6);
  const now=local(2026,8,29,20,12,10);
  assert.throws(()=>context.gmNormalizeOrderCompletionTime(order(startedAt),"2026-08-29T20:12:05",now),/GM_ORDER_INTERVAL_INVALID/);
  assert.throws(()=>context.gmNormalizeOrderCompletionTime(order(startedAt),"2026-08-29T20:12:11",now),/GM_ORDER_COMPLETION_FUTURE/);
  assert.throws(()=>context.gmNormalizeOrderCompletionTime(order(startedAt),now+1,now),/GM_ORDER_COMPLETION_FUTURE/);
});

test("transição perto da meia-noite mantém a ordem temporal",()=>{
  const startedAt=local(2026,8,29,23,59,59,900);
  const now=local(2026,8,30,0,0,2);
  const finishedAt=context.gmNormalizeOrderCompletionTime(order(startedAt),"2026-08-30T00:00:01",now);
  assert.equal(finishedAt,local(2026,8,30,0,0,1));
  assert.ok(finishedAt>startedAt);
});

test("conversão local, UTC e datas legadas sem segundos é consistente",()=>{
  assert.equal(context.gmLocalDateTimeMs("2026-08-29T20:12:06"),local(2026,8,29,20,12,6));
  assert.equal(context.gmLocalDateTimeMs("2026-08-29T20:12"),local(2026,8,29,20,12,0));
  assert.equal(context.gmLocalDateTimeMs("2026-08-29T23:12:06.250Z"),Date.parse("2026-08-29T23:12:06.250Z"));
  assert.equal(context.gmLocalDateTimeMs("2026-02-30T10:00:00",0),0);
  assert.match(context.localDateTimeSecondsValue(local(2026,8,29,20,12,6)),/^2026-08-29T20:12:06$/);
});

test("erro de horário é atômico e não chama o serviço remoto",async()=>{
  const startedAt=local(2026,8,29,20,12,6);
  reset(startedAt);
  const before=plain(context.state);
  await assert.rejects(
    ()=>context.gmTransitionWorkOrder("os-2","Concluída",{finishedAt:fixedNow+1000,comment:"Concluída",executor:"Anderson Vieira"}),
    /GM_ORDER_COMPLETION_FUTURE/
  );
  assert.equal(context.rpcCalls.length,0);
  assert.deepEqual(plain(context.state),before);
});

test("serviço conclui uma vez, calcula duração não negativa e bloqueia replay",async()=>{
  const startedAt=local(2026,8,29,23,59,59,900);
  reset(startedAt);
  const first=plain(await context.gmTransitionWorkOrder("os-2","Concluída",{
    finishedAt:"2026-08-30T00:00:01",comment:"Checklist e teste funcional concluídos",executor:"Anderson Vieira"
  }));
  const second=plain(await context.gmTransitionWorkOrder("os-2","Concluída",{
    finishedAt:"2026-08-30T00:00:01",comment:"Replay",executor:"Anderson Vieira"
  }));
  assert.equal(context.rpcCalls.length,1);
  assert.equal(first.status,"Concluída");
  assert.equal(second.status,"Concluída");
  assert.equal(first.history.filter(item=>item.action==="COMPLETED").length,1);
  assert.equal(first.history.some(item=>item.action==="CHECKLIST_CONCLUIDO"),false);
  assert.ok(first.finishedAt>=first.startedAt);
  assert.ok(first.mttr>=0);
});
