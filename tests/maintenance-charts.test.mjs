import test from 'node:test';
import assert from 'node:assert/strict';
import '../assets/maintenance-charts.js';
import { calculateMaintenanceMetrics } from '../supabase/functions/_shared/maintenance-metrics.ts';
const { model } = globalThis.GMMaintenanceCharts;
const {compare,validateTargets} = globalThis.GMMaintenanceCharts;
const {resolveTargets,targetPolicyChange} = globalThis.GMMaintenanceCharts;
const {ranking} = globalThis.GMMaintenanceCharts;
const {rankingOrder} = globalThis.GMMaintenanceCharts;
const {createRankingPreferences} = globalThis.GMMaintenanceCharts;
const {createTrendFilterPreferences,resolveTrendFilters,normalizeTrendFilters} = globalThis.GMMaintenanceCharts;

test('filtros persistem por empresa e usuário sem compartilhar seleção entre contas',()=>{
  const values=new Map();const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
  const first=createTrendFilterPreferences(()=>storage);
  first.save('company-A/user-1',{plant:'P',asset:'A',months:24});
  first.save('company-A/user-2',{plant:'Q',asset:'B',months:12});
  const reopened=createTrendFilterPreferences(()=>storage);
  assert.deepEqual(reopened.read('company-A/user-1'),{plant:'P',asset:'A',months:24});
  assert.deepEqual(reopened.read('company-A/user-2'),{plant:'Q',asset:'B',months:12});
  assert.deepEqual(reopened.read('company-B/user-1'),{plant:'',asset:'',months:6});
  assert.deepEqual(reopened.read(''),{plant:'',asset:'',months:6});
  reopened.save('company-A/user-1',{plant:'',asset:'',months:6});
  assert.deepEqual(createTrendFilterPreferences(()=>storage).read('company-A/user-1'),{plant:'',asset:'',months:6});
  assert.deepEqual(normalizeTrendFilters({plant:33,asset:{id:'x'},months:99}),{plant:'',asset:'',months:6});
});

test('restauração rejeita plantas e equipamentos removidos, sem permissão ou incompatíveis',()=>{
  const assets=[{id:'A',plant:'P'},{id:'B',plant:'Q'}];
  assert.deepEqual(resolveTrendFilters({plant:'P',asset:'A',months:12},assets),{plant:'P',asset:'A',months:12});
  assert.equal(resolveTrendFilters({plant:'P',asset:'B'},assets).asset,'');
  assert.deepEqual(resolveTrendFilters({plant:'hidden',asset:'A',months:24},assets),{plant:'',asset:'',months:24});
  assert.equal(resolveTrendFilters({asset:'hidden'},assets).asset,'');
  assert.equal(resolveTrendFilters({asset:'A'},assets).asset,'A');
  assert.deepEqual(resolveTrendFilters({plant:'P',asset:'A',months:24},[]),{plant:'',asset:'',months:24});
});

test('filtros toleram armazenamento inválido ou bloqueado, mantendo seleção em memória',()=>{
  const preferences=createTrendFilterPreferences(()=>({getItem:()=>'{bad',setItem:()=>{throw Error('quota');}}));
  assert.deepEqual(preferences.read('scope'),{plant:'',asset:'',months:6});
  preferences.save('scope',{plant:'P',asset:'A',months:'12'});
  assert.deepEqual(preferences.read('scope'),{plant:'P',asset:'A',months:12});
  const blocked=createTrendFilterPreferences(()=>{throw Error('SecurityError');});
  assert.doesNotThrow(()=>blocked.read('scope'));
  blocked.save('scope',{months:24});assert.equal(blocked.read('scope').months,24);
});

test('preferências independentes dos rankings sobrevivem a nova sessão sem armazenar dados operacionais',()=>{
  const values=new Map();
  const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
  const first=createRankingPreferences(()=>storage);
  assert.deepEqual(first.read(),{});
  first.set('mttr','percentage');first.set('mtbf','absolute');first.set('availability','percentage');
  const reopened=createRankingPreferences(()=>storage);
  assert.deepEqual(reopened.read(),{mttr:'percentage',mtbf:'absolute',availability:'percentage'});
  reopened.set('mttr','absolute');
  assert.deepEqual(createRankingPreferences(()=>storage).read(),{mttr:'absolute',mtbf:'absolute',availability:'percentage'});
  reopened.set('unknown','percentage');reopened.set('mtbf','invalid');
  assert.equal(values.size,3);
  assert.ok([...values.values()].every(value=>['absolute','percentage'].includes(value)));
  const copy=reopened.read();copy.mtbf='percentage';assert.equal(reopened.read().mtbf,'absolute');
});

test('preferências inválidas ou armazenamento indisponível não bloqueiam os gráficos',()=>{
  const invalid=createRankingPreferences(()=>({getItem:()=>'{broken',setItem:()=>{throw new Error('quota');}}));
  assert.deepEqual(invalid.read(),{});
  invalid.set('mttr','percentage');assert.equal(invalid.read().mttr,'percentage');
  const blocked=createRankingPreferences(()=>{throw new Error('SecurityError');});
  assert.deepEqual(blocked.read(),{});
  assert.doesNotThrow(()=>blocked.set('availability','percentage'));
  assert.equal(blocked.read().availability,'percentage');
  const unavailable=createRankingPreferences(()=>undefined);
  unavailable.set('mtbf','absolute');assert.equal(unavailable.read().mtbf,'absolute');
});

test('alternância do ranking reordena pelo percentual da própria meta sem modificar dados oficiais',()=>{
  const row=(assetId,gap,goal)=>({assetId,label:assetId,gap,goal});
  const data={rows:[row('A',6,10),row('B',3,1),row('C',2,0)],within:2};
  const snapshot=JSON.stringify(data);
  assert.deepEqual(rankingOrder(data).rows.map(r=>r.assetId),['A','B','C']);
  const percent=rankingOrder(data,'percentage');
  assert.deepEqual(percent.rows.map(r=>r.assetId),['B','A']);
  assert.deepEqual(percent.rows.map(r=>r.percentage),[300,60]);
  assert.equal(percent.excluded,1);assert.equal(percent.totalOutside,3);assert.equal(percent.within,2);
  assert.equal(JSON.stringify(data),snapshot);
  assert.equal(rankingOrder({rows:[row('x',1,Number.MIN_VALUE)]},'percentage').rows.length,0);
  assert.equal(rankingOrder({rows:[]},'percentage').excluded,0);
  assert.equal(rankingOrder(data,'unexpected').mode,'absolute');
});

test('percentual preserva direção de MTTR, MTBF e disponibilidade e desempate estável',()=>{
  const assets=[{id:'A'},{id:'B'}];
  const metric=value=>({value,quality:{state:'valid'}});
  const contract={period:{end:'2026-06-30'},assetBreakdown:{items:[
    {assetId:'A',metrics:{mttr:metric(4),mtbf:metric(50),availability:metric(80)}},
    {assetId:'B',metrics:{mttr:metric(20),mtbf:metric(150),availability:metric(94)}}
  ]}};
  const policy={metricTargets:{mttr:10,mtbf:200,availability:95},metricTargetOverrides:[{scope:'asset',id:'A',targets:{mttr:1,mtbf:100,availability:90}}]};
  const result=ranking(contract,policy,assets);
  for(const key of ['mttr','mtbf','availability']) {
    const rows=rankingOrder(result[key],'percentage').rows;
    assert.equal(rows[0].assetId,'A');
    assert.ok(rows.every(r=>Number.isFinite(r.percentage)&&r.percentage>0));
  }
  assert.equal(rankingOrder(result.mttr).rows[0].assetId,'B');
  const tied={rows:[{assetId:'b',label:'B',gap:2,goal:1},{assetId:'a',label:'A',gap:4,goal:2}]};
  assert.deepEqual(rankingOrder(tied,'percentage').rows.map(r=>r.assetId),['a','b']);
});
test('ranking ordena desvio absoluto na direção de cada indicador e não inventa metas/dados',()=>{
  const assets=[{id:'a',label:'Motor A',plant:'P'},{id:'b',label:'Motor B',plant:'P'},{id:'c',label:'Motor C',plant:'P'}];
  const metric=(value,quality='valid')=>({value,quality:{state:quality}});
  const item=(assetId,mttr,mtbf,availability)=>({assetId,metrics:{mttr:metric(mttr),mtbf:metric(mtbf),availability:metric(availability)}});
  const contract={period:{end:'2026-06-30'},assetBreakdown:{items:[item('a',2,50,90),item('b',10,0,94),item('c',null,null,null),item('hidden',9999,0,0)]}};
  const policy={metricTargets:{mttr:4,mtbf:100,availability:95},metricTargetOverrides:[{scope:'asset',id:'a',targets:{mttr:0}}]};
  const result=ranking(contract,policy,assets);
  assert.deepEqual(result.mttr.rows.map(row=>row.assetId),['b','a']);
  assert.deepEqual(result.mtbf.rows.map(row=>row.gap),[100,50]);
  assert.deepEqual(result.availability.rows.map(row=>row.assetId),['a','b']);
  assert.equal(result.mttr.rows[1].source.scope,'asset');
  assert.equal(result.mttr.considered,3);assert.equal(result.mttr.missingData,1);
  assert.equal(ranking(contract,{},assets).mttr.rows.length,0);assert.equal(ranking(contract,{},assets).mttr.missingGoals,3);
  assert.equal(ranking(null,policy,assets).mttr.available,false);
});
test('ranking considera vigência no fim do período, empates determinísticos e qualidade parcial',()=>{
  const assets=[{id:'b',label:'B',plant:'P'},{id:'a',label:'A',plant:'P'}];
  const contract={period:{end:'2026-06-30'},assetBreakdown:{truncated:true,items:assets.map(asset=>({assetId:asset.id,metrics:{mttr:{value:8,quality:{state:'partial'}}}}))}};
  const policy={metricTargets:{mttr:4},metricTargetVersions:[{scope:'company',id:'',validFrom:'2026-07-01',targets:{mttr:1}}]};
  assert.equal(ranking(contract,policy,assets).mttr.rows.length,0);
  contract.period.end='2026-07-01';
  const data=ranking(contract,policy,assets).mttr;
  assert.deepEqual(data.rows.map(row=>row.assetId),['a','b']);assert.equal(data.rows[0].gap,7);assert.equal(data.rows[0].quality,'partial');assert.equal(data.truncated,true);
});
const {targetVersionChange,targetVersionAt,targetDate,targetTimeline} = globalThis.GMMaintenanceCharts;
const versionMeta=(versionId,at='2026-06-30T15:00:00Z')=>({versionId,at,actor:{id:'admin',name:'Administrador QA'}});
const targetAllowed={plant:['P'],asset:['A']};
test('vigência futura preserva cadastro anterior, aplica limites inclusivos e expira para herança',()=>{
  const original={metricTargets:{mttr:10,mtbf:100,availability:90},metricTargetOverrides:[{scope:'plant',id:'P',targets:{mttr:8}}]};
  const before=JSON.stringify(original);
  const policy={...original,...targetVersionChange(original,{scope:'plant',id:'P'},{mttr:4,validFrom:'2026-08-01',validTo:'2026-08-31',reason:'Turno novo'},targetAllowed,versionMeta('v1'))};
  const value=date=>resolveTargets(policy,{plant:'P',date}).targets.mttr;
  assert.equal(value('2026-07-31'),8);assert.equal(value('2026-08-01'),4);assert.equal(value('2026-08-31'),4);assert.equal(value('2026-09-01'),10);
  assert.equal(JSON.stringify(original),before);
  assert.equal(policy.metricTargetVersions[0].legacy,true);
  assert.equal(policy.metricTargetVersions[1].actor.name,'Administrador QA');
  assert.equal(policy.metricTargetVersions[1].reason,'Turno novo');
});
test('revisão no mesmo dia conserva valores, autor e motivo anteriores após serialização',()=>{
  let policy={metricTargets:{mttr:8}};
  policy={...policy,...targetVersionChange(policy,{scope:'company'},{mttr:4,validFrom:'2026-06-30',reason:'Primeira revisão'},targetAllowed,versionMeta('one'))};
  policy={...policy,...targetVersionChange(policy,{scope:'company'},{mttr:2,validFrom:'2026-06-30',reason:'Correção aprovada'},targetAllowed,versionMeta('two','2026-06-30T16:00:00Z'))};
  policy=JSON.parse(JSON.stringify(policy));
  assert.equal(resolveTargets(policy,{date:'2026-06-29'}).targets.mttr,8);
  assert.equal(resolveTargets(policy,{date:'2026-06-30'}).targets.mttr,2);
  const old=policy.metricTargetVersions.find(v=>v.versionId==='one');
  assert.equal(old.targets.mttr,4);assert.equal(old.reason,'Primeira revisão');assert.equal(old.supersededBy,'two');
});
test('versões específicas encerradas ou vazias herdam por indicador sem ressuscitar legado',()=>{
  let policy={metricTargets:{mttr:10,mtbf:100},metricTargetOverrides:[{scope:'asset',id:'A',targets:{mttr:8}}]};
  policy={...policy,...targetVersionChange(policy,{scope:'asset',id:'A'},{mttr:0,validFrom:'2026-07-01',validTo:'2026-07-02'},targetAllowed,versionMeta('a'))};
  assert.equal(resolveTargets(policy,{asset:'A',date:'2026-06-30'}).targets.mttr,8);
  assert.equal(resolveTargets(policy,{asset:'A',date:'2026-07-01'}).targets.mttr,0);
  assert.equal(resolveTargets(policy,{asset:'A',date:'2026-07-03'}).targets.mttr,10);
  policy={...policy,...targetVersionChange(policy,{scope:'asset',id:'A'},{validFrom:'2026-07-03'},targetAllowed,versionMeta('b'))};
  assert.equal(resolveTargets(policy,{asset:'A',date:'2026-07-03'}).targets.mttr,10);
});
test('bloqueia datas impossíveis, intervalo invertido, sobreposição futura e retroatividade sem motivo',()=>{
  const make=input=>targetVersionChange({}, {scope:'plant',id:'P'},input,targetAllowed,versionMeta('v'));
  for(const input of [{validFrom:'2026-02-30'},{validFrom:'2026-08-01',validTo:'2026-07-31'},{validFrom:'2026-06-29'}]) assert.throws(()=>make(input));
  assert.doesNotThrow(()=>make({validFrom:'2026-06-29',reason:'Correção histórica'}));
  let policy=make({validFrom:'2026-08-01',mttr:2});
  assert.throws(()=>targetVersionChange(policy,{scope:'plant',id:'P'},{validFrom:'2026-07-01',mttr:3},targetAllowed,versionMeta('other')));
  assert.doesNotThrow(()=>targetVersionChange(policy,{scope:'plant',id:'P'},{validFrom:'2026-07-01',validTo:'2026-07-31',mttr:3},targetAllowed,versionMeta('other')));
  assert.throws(()=>targetVersionChange(policy,{scope:'plant',id:'P'},{validFrom:'2026-08-01'},targetAllowed,versionMeta('v')));
});
test('datas de vigência usam Brasília e linha histórica consulta cada fim de intervalo',()=>{
  assert.equal(targetDate('2026-07-01T01:00:00Z'),'2026-06-30');
  let policy={metricTargets:{mttr:8}};
  policy={...policy,...targetVersionChange(policy,{scope:'company'},{mttr:4,validFrom:'2026-07-01'},targetAllowed,versionMeta('new'))};
  const series={mttr:[{end:'2026-06-30'},{end:'2026-07-01'}]};
  assert.deepEqual(targetTimeline(policy,{},series).mttr.map(p=>p.value),[8,4]);
  const card=model({metrics:{mttr:{value:1}},series:{mttr:[point(1),point(2)]}},{mttr:4},targetTimeline(policy,{},series))[0];
  assert.deepEqual(card.goals,[8,4]);assert.equal(card.ceiling,8);
});
test('metas por indicador priorizam equipamento, planta e empresa, sem média de metas',()=>{
  const policy={metricTargets:{mttr:4,mtbf:100,availability:90},metricTargetOverrides:[
    {scope:'plant',id:'P1',targets:{mttr:2,mtbf:200}},
    {scope:'asset',id:'A1',targets:{mttr:0,availability:99}},
    {scope:'asset',id:'A2',targets:{mtbf:500}},
  ]};
  const resolved=resolveTargets(policy,{plant:'P1',asset:'A1',assetLabel:'Motor A'});
  assert.deepEqual(resolved.targets,{mttr:0,mtbf:200,availability:99});
  assert.deepEqual(Object.values(resolved.sources).map(item=>item.scope),['asset','plant','asset']);
  assert.equal(resolved.sources.mttr.label,'Motor A');
  assert.deepEqual(resolveTargets(policy,{plant:'P1'}).targets,{mttr:2,mtbf:200,availability:90});
  assert.deepEqual(resolveTargets(policy).targets,policy.metricTargets);
  assert.deepEqual(resolveTargets(policy,{plant:'P2',asset:'A3'}).targets,policy.metricTargets);
  assert.deepEqual(resolveTargets({}).targets,{mttr:null,mtbf:null,availability:null});
});
test('gravar e limpar meta específica preserva os outros destinos e valida o perfil',()=>{
  const policy={slaHours:{alta:2},metricTargets:{mttr:4},metricTargetOverrides:[{scope:'plant',id:'P',targets:{mttr:2}},{scope:'asset',id:'B',targets:{mttr:3}}]};
  const allowed={plant:['P'],asset:['A','B']};
  const patch=targetPolicyChange(policy,{scope:'asset',id:'A'},{mttr:1},allowed);
  assert.equal(patch.metricTargetOverrides.length,3);
  assert.equal(policy.metricTargetOverrides.length,2);
  const removed=targetPolicyChange({...policy,...patch},{scope:'asset',id:'A'},{mttr:''},allowed);
  assert.deepEqual(removed.metricTargetOverrides,policy.metricTargetOverrides);
  assert.equal(resolveTargets({...policy,...removed},{asset:'A',plant:'P'}).targets.mttr,2);
  assert.throws(()=>targetPolicyChange(policy,{scope:'asset',id:'unknown'},{mttr:2},allowed));
  assert.throws(()=>targetPolicyChange(policy,{scope:'invalid',id:'P'},{mttr:2},allowed));
  assert.throws(()=>targetPolicyChange(policy,{scope:'plant',id:'P'},{availability:101},allowed));
  assert.deepEqual(targetPolicyChange(policy,{scope:'company'},{mttr:5},allowed),{metricTargets:{mttr:5,mtbf:null,availability:null}});
});
test('metas opcionais validam limites e incluem meta na escala sem alterar valor oficial',()=>{
  assert.deepEqual(validateTargets({mttr:'2,5',mtbf:'',availability:'100'}),{mttr:2.5,mtbf:null,availability:100});
  for(const input of [{mttr:-1},{availability:101},{mtbf:'abc'},{mttr:Infinity}]) assert.throws(()=>validateTargets(input));
  const card=model({metrics:{mttr:{value:2,quality:{state:'valid'}}}},{mttr:50})[0];
  assert.equal(card.value,2);assert.equal(card.ceiling,50);assert.equal(card.goal,50);
});
test('comparação usa agregados oficiais e direção correta, sem dividir por zero',()=>{
  const contract=(key,value,state='valid')=>({metrics:{[key]:{value,quality:{state}}}});
  for(const [key,current,prior,better] of [['mttr',2,4,true],['mtbf',4,2,true],['availability',90,95,false],['mtbf',1,0,true]]) {
    const result=compare(model(contract(key,current)).find(card=>card.key===key),contract(key,prior));
    assert.equal(result.better,better);assert.equal(result.delta,current-prior);
  }
  assert.equal(compare(model(contract('mttr',2))[0],null),null);
  assert.equal(compare(model(contract('mttr',2,'partial'))[0],contract('mttr',4)).partial,true);
});
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
