import test from "node:test";
import assert from "node:assert/strict";
import "../assets/preventive-year.js";
const {weeks,build,date}=globalThis.GMPreventiveYear;
const nextDate=(plan,key)=>{const d=date(key);d.setUTCDate(d.getUTCDate()+(plan.intervalDays||7));return d.toISOString().slice(0,10);};
const base=()=>({year:2026,today:"2026-06-15",tenantId:"qa",assets:[{id:"a",companyId:"qa"}],
  plans:[{id:"p",assetId:"a",name:"Inspeção",nextExecution:"2026-06-01",intervalDays:7}],orders:[],nextDate});
test("semanas cobrem ano inteiro incluindo fronteiras e ano bissexto",()=>{
  for(const year of [2020,2024,2026,2027,2028]){
    const rows=weeks(year);
    assert.ok(rows[0].start<=year+"-01-01");
    assert.ok(rows.at(-1).end>=year+"-12-31");
    for(let i=1;i<rows.length;i++) assert.equal(+date(rows[i].start)-+date(rows[i-1].start),7*86400000);
  }
  assert.equal(weeks(2021)[0].number,53);
  assert.equal(weeks(2021)[0].isoYear,2020);
});
test("vencido vermelho, hoje e futuro azul sem inventar histórico",()=>{
  const result=build(base());
  assert.equal(result.events[0].date,"2026-06-01");
  assert.equal(result.events[0].state,"late");
  assert.equal(result.events.find(e=>e.date==="2026-06-15").state,"future");
  assert.ok(result.events.at(-1).date.startsWith("2026"));
});
test("conclusão ocupa semana prevista sem duplicar projeção",()=>{
  const input=base();
  input.orders=[{id:"os",assetId:"a",preventivePlanId:"p",preventivePlanExecutionDate:"2026-06-01",scheduledAt:"2026-07-01",status:"Concluída",finishedAt:"2026-06-20"}];
  const rows=build(input).events.filter(e=>e.date==="2026-06-01");
  assert.equal(rows.length,1);assert.equal(rows[0].state,"done");
});
test("cancelada ou em execução não vira concluída",()=>{
  for(const status of ["Cancelada","Em execução","Pausada"]){
    const input=base();input.orders=[{assetId:"a",preventivePlanId:"p",scheduledAt:"2026-06-01T08:00",status}];
    assert.equal(build(input).events[0].state,"late");
  }
});
test("pausado não projeta mas mantém ordens registradas",()=>{
  const input=base();input.plans[0].status="Pausado";
  input.orders=[{assetId:"a",preventivePlanId:"p",scheduledAt:"2026-05-01",status:"Concluída"}];
  const result=build(input);assert.equal(result.events.length,1);assert.equal(result.paused,1);
});
test("não mistura tenant nem máquinas de outro plano",()=>{
  const input=base();input.orders=[{assetId:"a",companyId:"outro",preventivePlanId:"p",scheduledAt:"2026-06-01",status:"Concluída"},{assetId:"outra",preventivePlanId:"p",scheduledAt:"2026-06-01",status:"Concluída"}];
  assert.equal(build(input).events[0].state,"late");
});
test("datas ausentes não criam conclusão e entrada permanece intacta",()=>{
  const input=base();input.plans[0].nextExecution="";
  const snapshot=JSON.stringify(input),result=build(input);
  assert.equal(result.events.length,0);assert.equal(result.missingDates,1);assert.equal(JSON.stringify(input),snapshot);
  assert.equal(date("2026-02-30"),null);
});
