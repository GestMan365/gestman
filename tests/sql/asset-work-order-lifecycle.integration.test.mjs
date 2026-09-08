import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {execFileSync,spawn} from 'node:child_process';

const container=process.env.GESTMAN_SQL_CONTAINER;
assert(container,'Set GESTMAN_SQL_CONTAINER to a disposable Supabase container');
const inspected=JSON.parse(execFileSync('docker',['inspect',container],{encoding:'utf8'}))[0];
assert.equal(inspected.Config.Labels['com.supabase.cli.project'],'gm-phase04-security');
const args=['exec','-i',container,'psql','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-Atq'];
const q=value=>"'"+String(value).replaceAll("'","''")+"'";
function sql(source){return execFileSync('docker',args,{input:source,encoding:'utf8',timeout:30000,stdio:['pipe','pipe','pipe']}).trim()}
function denied(source,marker){try{sql(source);return false}catch(error){return String(error.stderr||'').includes(marker)}}
const claims=userId=>q(JSON.stringify({sub:userId,role:'authenticated',aud:'authenticated'}));
const asUser=(userId,source)=>`SET LOCAL ROLE authenticated;SELECT set_config('request.jwt.claims',${claims(userId)},true);${source}`;
function fixture(state,{member=true}={}){
 const user=crypto.randomUUID(),company=crypto.randomUUID();
 const seed=`INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES (${q(user)},${q('phase04.'+crypto.randomUUID()+'@example.invalid')},'{}');
 INSERT INTO public.gm_companies(id,name,slug,created_by) VALUES (${q(company)},'Synthetic lifecycle',${q('phase04-'+crypto.randomUUID())},${q(user)});
 ${member?`INSERT INTO public.gm_company_members(company_id,user_id,role,active,access_username,access_profile,permission_levels,executor) VALUES (${q(company)},${q(user)},'administrator',true,${q('phase04-'+crypto.randomUUID())},'admin','{}',false);`:''}
 INSERT INTO public.gm_tenant_state(company_id,state,version) VALUES (${q(company)},${q(JSON.stringify(state))}::jsonb,0);`;
 const cleanup=`DELETE FROM public.gm_audit_log WHERE company_id=${q(company)};DELETE FROM public.gm_work_order_events WHERE company_id=${q(company)};DELETE FROM public.gm_tenant_state WHERE company_id=${q(company)};DELETE FROM public.gm_company_members WHERE company_id=${q(company)};DELETE FROM public.gm_companies WHERE id=${q(company)};DELETE FROM auth.users WHERE id=${q(user)};`;
 return{user,company,seed,cleanup};
}
const state=(orders,asset={id:'a1',status:'Operando'},downtimes=[])=>({orders,assets:[asset],downtimes});
const order=(id='o1',status='Em execução',extra={})=>({id,number:id,assetId:'a1',status,executor:'Synthetic technician',startedAt:1000,updatedAt:2000,history:[],...extra});
function reconcile(value,orderId='o1'){
 const actor=crypto.randomUUID();
 return JSON.parse(sql(`SELECT public.gm_reconcile_asset_work_order_lifecycle(${q(JSON.stringify(value))}::jsonb,${q(orderId)},${q(actor)}::uuid)::text;`));
}
const assetOf=value=>value.assets.find(item=>item.id==='a1');
const events=value=>assetOf(value).statusHistory||[];
const transition=(fixtureValue,expected,orderId,toStatus,patch,reason,requestId)=>asUser(fixtureValue.user,`SELECT count(*) FROM public.gm_transition_work_order(${expected},${q(orderId)},${q(toStatus)},${q(JSON.stringify(patch))}::jsonb,${reason===null?'NULL':q(reason)},${q(requestId)}::uuid);`);

test('1. atributos SECURITY INVOKER/DEFINER e search_path são seguros',()=>{
 const result=sql("SELECT string_agg(proname||':'||prosecdef||':'||coalesce(array_to_string(proconfig,','),''),';' ORDER BY proname) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND proname IN ('gm_work_order_is_asset_active','gm_reconcile_asset_work_order_lifecycle','gm_mark_manual_asset_status_changes','gm_enforce_work_order_state_transition');");
 assert.match(result,/gm_reconcile_asset_work_order_lifecycle:false:search_path=""/);assert.match(result,/gm_enforce_work_order_state_transition:true:search_path=""/);
});
test('2. auxiliares não são RPC públicas e authenticated acessa só a transição',()=>{
 assert.equal(sql("SELECT NOT has_function_privilege('anon','public.gm_reconcile_asset_work_order_lifecycle(jsonb,text,uuid)','EXECUTE') AND NOT has_function_privilege('authenticated','public.gm_reconcile_asset_work_order_lifecycle(jsonb,text,uuid)','EXECUTE') AND NOT has_function_privilege('anon','public.gm_transition_work_order(bigint,text,text,jsonb,text,uuid)','EXECUTE') AND has_function_privilege('authenticated','public.gm_transition_work_order(bigint,text,text,jsonb,text,uuid)','EXECUTE');"),'t');
});
test('3. anon não inicia transição',()=>assert(denied("BEGIN;SET LOCAL ROLE anon;SELECT * FROM public.gm_transition_work_order(0,'o1','Em execução','{}',NULL,gen_random_uuid());ROLLBACK;",'permission denied')));
test('4. authenticated sem JWT é rejeitado',()=>assert(denied("BEGIN;SET LOCAL ROLE authenticated;SELECT * FROM public.gm_transition_work_order(0,'o1','Em execução','{}',NULL,gen_random_uuid());ROLLBACK;",'GM_AUTH_REQUIRED')));
test('5. usuário sem vínculo de tenant é rejeitado',()=>{
 const f=fixture(state([order('o1','Aberta')]),{member:false});assert(denied(`BEGIN;${f.seed}${asUser(f.user,"SELECT * FROM public.gm_transition_work_order(0,'o1','Em execução','{}',NULL,gen_random_uuid());")}ROLLBACK;`,'GM_COMPANY_NOT_FOUND'));
});
test('6. O.S. inexistente é rejeitada no tenant correto',()=>{
 const f=fixture(state([order('o1','Aberta')]));assert(denied(`BEGIN;${f.seed}${asUser(f.user,"SELECT * FROM public.gm_transition_work_order(0,'foreign','Em execução','{}',NULL,gen_random_uuid());")}ROLLBACK;`,'GM_ORDER_NOT_FOUND'));
});
test('7. RLS de eventos isola dois tenants',()=>{
 const a=fixture(state([])),b=fixture(state([]));
 const seedEvent=f=>`INSERT INTO public.gm_work_order_events(company_id,request_id,order_id,from_status,to_status,action,state_version,actor_user_id) VALUES (${q(f.company)},gen_random_uuid(),'o1','Aberta','Em execução','STARTED',1,${q(f.user)});`;
 const output=sql(`BEGIN;${a.seed}${b.seed}${seedEvent(a)}${seedEvent(b)}${asUser(a.user,'SELECT count(*) FROM public.gm_work_order_events;')}RESET ROLE;${asUser(b.user,'SELECT count(*) FROM public.gm_work_order_events;')}ROLLBACK;`).split(/\r?\n/).filter(line=>line==='1');
 assert.equal(output.length,2);
});
test('8. primeira O.S. ativa coloca ativo em manutenção uma vez',()=>{const value=reconcile(state([order()]));assert.equal(assetOf(value).status,'Em manutenção');assert.equal(events(value).length,1)});
test('9. segunda O.S. ativa mantém um único controle e evento',()=>{let value=reconcile(state([order()]));value.orders.push(order('o2','Em execução',{startedAt:1500,updatedAt:2500}));value=reconcile(value,'o2');assert.equal(assetOf(value).status,'Em manutenção');assert.equal(events(value).length,1)});
test('10. pausa sem motivo é rejeitada e não persiste parcialmente',()=>{
 const f=fixture(state([order()]));const request=crypto.randomUUID();assert(denied(`BEGIN;${f.seed}${transition(f,0,'o1','Pausada',{},null,request)}ROLLBACK;`,'GM_ORDER_TRANSITION_REASON_REQUIRED'));
});
test('11. pausa e retomada mantêm o ativo em manutenção',()=>{let value=reconcile(state([order()]));value.orders[0].status='Pausada';value=reconcile(value);value.orders[0].status='Em execução';value=reconcile(value);assert.equal(assetOf(value).status,'Em manutenção');assert.equal(events(value).length,1)});
test('12. concluir uma de duas O.S. ativas não restaura o ativo',()=>{let value=reconcile(state([order(),order('o2','Em execução',{startedAt:1500})]));value.orders[0].status='Concluída';value.orders[0].updatedAt=3000;value=reconcile(value);assert.equal(assetOf(value).status,'Em manutenção')});
test('13. última conclusão restaura status e replay não duplica evento',()=>{let value=reconcile(state([order()]));value.orders[0].status='Concluída';value.orders[0].updatedAt=3000;value=reconcile(value);const count=events(value).length;value=reconcile(value);assert.equal(assetOf(value).status,'Operando');assert.equal(events(value).length,count)});
test('14. status manual do ativo não é sobrescrito',()=>{const value=reconcile(state([order()],{id:'a1',status:'Parado',statusOrigin:'manual',statusSetManually:true}));assert.equal(assetOf(value).status,'Parado');assert.equal(events(value).length,0)});
test('15. ativo de tenant incompatível é rejeitado atomicamente',()=>{
 const invalid=state([order('o1','Aberta',{companyId:'__OWN_COMPANY__'})],{id:'a1',companyId:crypto.randomUUID(),status:'Operando'});const f=fixture(invalid);const seed=f.seed.replaceAll('__OWN_COMPANY__',f.company);assert(denied(`BEGIN;${seed}${transition(f,0,'o1','Em execução',{executor:'Synthetic technician'},null,crypto.randomUUID())}ROLLBACK;`,'GM_ORDER_ASSET_TENANT_MISMATCH'));
});
test('16. O.S. com companyId incompatível é rejeitada atomicamente',()=>{
 const f=fixture(state([order('o1','Aberta',{companyId:crypto.randomUUID()})]));assert(denied(`BEGIN;${f.seed}${transition(f,0,'o1','Em execução',{executor:'Synthetic technician'},null,crypto.randomUUID())}ROLLBACK;`,'GM_ORDER_TENANT_MISMATCH'));
});
test('17. falha tardia reverte estado, evento e auditoria',()=>{
 const f=fixture(state([order('o1','Aberta')]));const request=crypto.randomUUID();
 const source=`BEGIN;${f.seed}CREATE FUNCTION pg_temp.fail_phase04() RETURNS trigger LANGUAGE plpgsql AS $t$ BEGIN RAISE EXCEPTION 'SAFE_LATE_FAILURE'; END $t$;CREATE TRIGGER zz_phase04_fail AFTER UPDATE ON public.gm_tenant_state FOR EACH STATEMENT EXECUTE FUNCTION pg_temp.fail_phase04();DO $d$ BEGIN BEGIN PERFORM * FROM public.gm_transition_work_order(0,'o1','Em execução','{"executor":"Synthetic technician"}',NULL,${q(request)}::uuid);RAISE EXCEPTION 'EXPECTED_FAILURE';EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'SAFE_LATE_FAILURE' THEN RAISE;END IF;END;END $d$;RESET ROLE;SELECT version=0 AND (state#>>'{orders,0,status}')='Aberta' FROM public.gm_tenant_state WHERE company_id=${q(f.company)};SELECT count(*)=0 FROM public.gm_work_order_events WHERE company_id=${q(f.company)};ROLLBACK;`;
 const prepared=source.replace('DO $d$',asUser(f.user,'DO $d$'));assert.deepEqual(sql(prepared).split(/\r?\n/).slice(-2),['t','t']);
});
test('18. parada ativa preserva Parado e o status anterior',()=>{let value=reconcile(state([order()],{id:'a1',status:'Parado'},[{id:'d1',assetId:'a1',status:'Ativa',startAt:500,previousAssetStatus:'Operando'}]));value.orders[0].status='Concluída';value.orders[0].updatedAt=3000;value=reconcile(value);assert.equal(assetOf(value).status,'Parado');assert.equal(value.downtimes[0].previousAssetStatus,'Operando')});

async function concurrent(sourceA,sourceB){
 const run=source=>new Promise(resolve=>{const child=spawn('docker',args,{stdio:['pipe','pipe','pipe']});let stderr='';child.stderr.on('data',x=>stderr+=x);child.on('close',code=>resolve({code,stderr}));child.stdin.end(source)});
 return Promise.all([run(sourceA),run(sourceB)]);
}
test('19. duas requisições idênticas concorrentes geram um evento',async()=>{
 const f=fixture(state([order('o1','Aberta')]));const request=crypto.randomUUID();sql(f.seed);
 try{const source=`BEGIN;${transition(f,0,'o1','Em execução',{executor:'Synthetic technician'},null,request)}COMMIT;`;const result=await concurrent(source,source);assert.deepEqual(result.map(item=>item.code),[0,0]);assert.equal(sql(`SELECT version FROM public.gm_tenant_state WHERE company_id=${q(f.company)};SELECT count(*) FROM public.gm_work_order_events WHERE company_id=${q(f.company)};`),'1\n1')}finally{sql(f.cleanup)}
});
test('20. requisições distintas concorrentes aceitam uma e rejeitam a obsoleta',async()=>{
 const f=fixture(state([order('o1','Aberta')]));sql(f.seed);
 try{const a=`BEGIN;${transition(f,0,'o1','Em execução',{executor:'Synthetic technician'},null,crypto.randomUUID())}COMMIT;`,b=`BEGIN;${transition(f,0,'o1','Em execução',{executor:'Synthetic technician'},null,crypto.randomUUID())}COMMIT;`;const result=await concurrent(a,b);assert.equal(result.filter(item=>item.code===0).length,1);assert.equal(result.filter(item=>item.stderr.includes('GM_STATE_CONFLICT')).length,1);assert.equal(sql(`SELECT version FROM public.gm_tenant_state WHERE company_id=${q(f.company)};SELECT count(*) FROM public.gm_work_order_events WHERE company_id=${q(f.company)};`),'1\n1')}finally{sql(f.cleanup)}
});
