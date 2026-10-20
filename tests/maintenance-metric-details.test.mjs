import test from 'node:test';
import assert from 'node:assert/strict';
import '../assets/maintenance-metric-details.js';
const {model}=globalThis.GMMaintenanceMetricDetails;

test('contribuição exibe quantidade e abre exatamente a O.S. referenciada',()=>{
  const order={id:'o1',number:'O.S.-001'};
  const evidence=model({key:'mttr',name:'MTTR',metric:{value:2,quality:{state:'valid'},recordIds:['o1'],calculation:{numerator:2,denominator:1,contributions:[{kind:'orders',recordIds:['o1'],label:'O.S.-001',amount:2,unit:'h de reparo',effect:'Inclui 2 h.'}]}}},{orders:[order]});
  let handler,opened;
  const button={dataset:{calculationRecord:'0:0'},addEventListener:(event,callback)=>{handler=callback;}};
  const target={innerHTML:'',querySelectorAll:selector=>selector==='[data-calculation-record]'?[button]:[],querySelector:()=>null};
  globalThis.GMMaintenanceMetricDetails.render(target,evidence,{openRecord:item=>{opened=item;}});
  assert.ok(target.innerHTML.includes('2 h de reparo'));
  assert.ok(target.innerHTML.includes('Inclui 2 h.'));
  handler();
  assert.equal(opened.record,order);
  assert.equal(opened.kind,'orders');
});

test('MTTR lista somente as referências oficiais, não outras O.S. do equipamento',()=>{
  const evidence=model({key:'mttr',metric:{recordIds:['o1'],recordCount:1}}, {orders:[{id:'o1',assetId:'a'},{id:'o2',assetId:'a'}]});
  assert.deepEqual(evidence.orderIds,['o1']);
  assert.equal(evidence.direct.length,1);
});
test('MTBF separa leituras de horímetro das O.S. de falha',()=>{
  const evidence=model({key:'mtbf',metric:{recordIds:['o1','m1'],recordCount:2}}, {orders:[{id:'o1'}],measurements:[{id:'m1',value:50}]});
  assert.deepEqual(evidence.direct.map(item=>item.kind),['orders','measurements']);
  assert.deepEqual(evidence.orderIds,['o1']);
});
test('disponibilidade lista paradas e somente vínculos explícitos de O.S.',()=>{
  const evidence=model({key:'availability',metric:{recordIds:['d1'],recordCount:1}}, {downtimes:[{id:'d1',assetId:'a',orderId:'o1'},{id:'d2',orderId:'o2'}],orders:[{id:'o1',assetId:'a'},{id:'o2',assetId:'a'}]});
  assert.deepEqual(evidence.direct.map(item=>item.kind),['downtimes']);
  assert.deepEqual(evidence.orderIds,['o1']);
  assert.equal(evidence.linked.length,1);
});
test('ausência de acesso e referências limitadas não geram registros substitutos',()=>{
  const evidence=model({key:'mttr',metric:{recordIds:['hidden'],recordCount:501}}, {orders:[]});
  assert.equal(evidence.unavailable,1);
  assert.equal(evidence.truncated,true);
  assert.deepEqual(evidence.orderIds,[]);
});
test('base insuficiente vazia permanece vazia',()=>{
  const evidence=model({key:'availability',metric:{value:null,recordIds:[],recordCount:0}});
  assert.equal(evidence.direct.length,0);
  assert.equal(evidence.unavailable,0);
  assert.equal(evidence.truncated,false);
});

test('detalhamento escapa descrições e preserva base insuficiente como Sem dados',()=>{
  const target={innerHTML:'',querySelectorAll:()=>[],querySelector:()=>null};
  const evidence=model({key:'mttr',name:'MTTR',unit:'h',metric:{value:10,quality:{state:'insufficient'},formula:'<script>alert(1)</script>',recordIds:['o1']}},{orders:[{id:'o1',description:'<img onerror=alert(1)>'}]});
  globalThis.GMMaintenanceMetricDetails.render(target,evidence);
  assert.ok(target.innerHTML.includes('Sem dados'));
  assert.ok(!target.innerHTML.includes('<script>'));
  assert.ok(!target.innerHTML.includes('<img'));
});
