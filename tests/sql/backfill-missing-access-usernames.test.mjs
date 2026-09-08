import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync,spawn} from 'node:child_process';

// Deliberately outside tests/*.test.mjs: requires an explicitly named,
// disposable Docker project; never accepts a remote database URL.
const container=process.env.GESTMAN_SQL_CONTAINER;
assert(container,'Set GESTMAN_SQL_CONTAINER to a disposable Supabase container');
const inspected=JSON.parse(execFileSync('docker',['inspect',container],{encoding:'utf8'}))[0];
assert.equal(inspected.Config.Labels['com.supabase.cli.project'],'gm-phase04-security');
const migrationUrl=new URL('../../supabase/migrations/20260903232800_backfill_missing_access_usernames.sql',import.meta.url);
const migrationBytes=fs.readFileSync(migrationUrl);
assert.equal(crypto.createHash('sha256').update(migrationBytes).digest('hex'),'ebde124f2b3a2553c68623c5c659d50ecb3a53958bbbff8129cf9a766788d394');
const migration=migrationBytes.toString('utf8');
const body=migration.replace(/^begin;\s*/i,'').replace(/commit;\s*$/i,'');
assert(!/\b(begin|commit);\s*$/i.test(body.slice(-30)));
const quote=s=>"'"+String(s).replaceAll("'","''")+"'";
const assertSql=(predicate,code='ASSERTION_FAILED')=>`DO $assertion$ BEGIN IF NOT (${predicate}) THEN RAISE EXCEPTION '${code}'; END IF; END $assertion$;`;
const args=['exec','-i',container,'psql','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-v','VERBOSITY=sqlstate','-Atq'];
function sql(source){try{return execFileSync('docker',args,{input:source,encoding:'utf8',timeout:20000,stdio:['pipe','pipe','pipe']}).trim();}catch(e){throw Error('LOCAL_SQL_TEST_FAILED '+(String(e.stderr||'').match(/ERROR:\s+(\w{5})/)?.[1]||'UNKNOWN'));}}
function fixture({username=null,metadata='safe-user',email='safe.email@example.invalid',count=1,twoTenants=false}={}){
 const users=Array.from({length:count},()=>crypto.randomUUID()),companies=[crypto.randomUUID(),crypto.randomUUID()];
 let seed='';
 for(let i=0;i<count;i++){
  seed+=`INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES (${quote(users[i])},${email===null?'NULL':quote('member'+i+'.'+email)},${quote(JSON.stringify(metadata===null?{}:{access_username:metadata}))}::jsonb);`;
  if(i===0||twoTenants)seed+=`INSERT INTO public.gm_companies(id,name,slug,created_by) VALUES (${quote(companies[i===0?0:1])},'Synthetic company',${quote('test-'+crypto.randomUUID())},${quote(users[i])});`;
  seed+=`INSERT INTO public.gm_company_members(company_id,user_id,role,active,access_username,access_profile,permission_levels,executor) VALUES (${quote(companies[twoTenants?i:0])},${quote(users[i])},'technician',true,${username===null?'NULL':quote(username)},'technician','{}',false);`;
 }
 return {users,companies,seed,where:`user_id IN (${users.map(quote).join(',')})`};
}
const wrap=(seed,checks)=>'BEGIN;'+seed+checks+'ROLLBACK;';
function rejected(f,setup,expected){
 const testSql=`CREATE TEMP TABLE before_members AS SELECT to_jsonb(m) AS row FROM public.gm_company_members m;
 CREATE TEMP TABLE before_auth AS SELECT to_jsonb(u) AS row FROM auth.users u;
 DO $negative$ DECLARE msg text; BEGIN
   BEGIN EXECUTE $run_migration$${body}$run_migration$; RAISE EXCEPTION 'EXPECTED_FAILURE_MISSING';
   EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS msg=MESSAGE_TEXT;
     IF msg <> '${expected}' THEN RAISE EXCEPTION 'UNEXPECTED_SAFE_ERROR'; END IF;
     IF msg ~ '@|[0-9a-f]{8}-[0-9a-f]{4}-' THEN RAISE EXCEPTION 'PII_IN_ERROR'; END IF;
   END;
 END $negative$;
 ${assertSql(`NOT EXISTS ((SELECT row FROM before_members EXCEPT ALL SELECT to_jsonb(m) FROM public.gm_company_members m) UNION ALL (SELECT to_jsonb(m) FROM public.gm_company_members m EXCEPT ALL SELECT row FROM before_members))`,'MEMBERS_CHANGED_ON_ERROR')}
 ${assertSql(`NOT EXISTS ((SELECT row FROM before_auth EXCEPT ALL SELECT to_jsonb(u) FROM auth.users u) UNION ALL (SELECT to_jsonb(u) FROM auth.users u EXCEPT ALL SELECT row FROM before_auth))`,'AUTH_CHANGED_ON_ERROR')}`;
 sql(wrap(f.seed+setup,testSql));
}

test('NULL corrigido; tenant, papel e permissões preservados',()=>{
 const f=fixture();sql(wrap(f.seed,body+assertSql(`(SELECT access_username='safe-user' AND role='technician' AND access_profile='technician' AND NOT executor AND permission_levels='{}'::jsonb FROM public.gm_company_members WHERE ${f.where})`)));
});
test('vazio corrigido',()=>{const f=fixture({username:'   '});sql(wrap(f.seed,body+assertSql(`(SELECT access_username='safe-user' FROM public.gm_company_members WHERE ${f.where})`)));});
test('preenchido preservado mesmo com fonte inválida',()=>{const f=fixture({username:'kept-user',metadata:'INVALID@SOURCE'});sql(wrap(f.seed,body+assertSql(`(SELECT access_username='kept-user' FROM public.gm_company_members WHERE ${f.where})`)));});
test('prefixo histórico do email quando metadata não fornece candidato',()=>{const f=fixture({metadata:null});sql(wrap(f.seed,body+assertSql(`(SELECT access_username='member0' FROM public.gm_company_members WHERE ${f.where})`)));});
test('usuário associado inexistente rejeitado sem alteração parcial',()=>{const f=fixture();rejected(f,`ALTER TABLE public.gm_company_members DROP CONSTRAINT gm_company_members_user_id_fkey; UPDATE public.gm_company_members SET user_id=${quote(crypto.randomUUID())} WHERE ${f.where};`,'GM_USERNAME_BACKFILL_AUTH_USER_MISSING');});
test('fonte ausente rejeitada',()=>{const f=fixture({metadata:null,email:null});rejected(f,'','GM_USERNAME_BACKFILL_SOURCE_MISSING');});
test('formato inválido rejeitado sem fallback inventado',()=>{const f=fixture({metadata:'INVALID@SOURCE'});rejected(f,'','GM_USERNAME_BACKFILL_INVALID_USERNAME');});
test('colisão case-insensitive com preenchido rejeitada',()=>{const f=fixture({count:2});rejected(f,`UPDATE public.gm_company_members SET access_username='SAFE-USER' WHERE user_id=${quote(f.users[1])};`,'GM_USERNAME_BACKFILL_COLLISION');});
test('colisão entre dois candidatos rejeitada',()=>{const f=fixture({count:2});rejected(f,'','GM_USERNAME_BACKFILL_COLLISION');});
test('dois tenants podem usar o mesmo username',()=>{const f=fixture({count:2,twoTenants:true});sql(wrap(f.seed,body+assertSql(`(SELECT count(*)=2 AND count(DISTINCT company_id)=2 FROM public.gm_company_members WHERE ${f.where} AND access_username='safe-user')`)));});
test('empresa inexistente rejeitada',()=>{const f=fixture();rejected(f,`ALTER TABLE public.gm_company_members DROP CONSTRAINT gm_company_members_company_id_fkey; UPDATE public.gm_company_members SET company_id=${quote(crypto.randomUUID())} WHERE ${f.where};`,'GM_USERNAME_BACKFILL_INVALID_MEMBERSHIP');});
test('vínculo sem usuário rejeitado',()=>{const f=fixture();rejected(f,`ALTER TABLE public.gm_company_members DROP CONSTRAINT gm_company_members_pkey CASCADE; ALTER TABLE public.gm_company_members ALTER COLUMN user_id DROP NOT NULL; UPDATE public.gm_company_members SET user_id=NULL WHERE ${f.where};`,'GM_USERNAME_BACKFILL_INVALID_MEMBERSHIP');});
test('vínculo sem empresa rejeitado',()=>{const f=fixture();rejected(f,`ALTER TABLE public.gm_company_members DROP CONSTRAINT gm_company_members_pkey CASCADE; ALTER TABLE public.gm_company_members ALTER COLUMN company_id DROP NOT NULL; UPDATE public.gm_company_members SET company_id=NULL WHERE ${f.where};`,'GM_USERNAME_BACKFILL_INVALID_MEMBERSHIP');});
test('alteração indireta de campo protegido pelo trigger causa rollback',()=>{
 const f=fixture();const setup=`CREATE FUNCTION pg_temp.alter_protected_field() RETURNS trigger LANGUAGE plpgsql AS $t$ BEGIN NEW.executor:=true; RETURN NEW; END $t$; CREATE TRIGGER zz_test_protected BEFORE UPDATE ON public.gm_company_members FOR EACH ROW EXECUTE FUNCTION pg_temp.alter_protected_field();`;
 rejected(f,setup,'GM_USERNAME_BACKFILL_PROTECTED_FIELD_CHANGED');
});
test('falha tardia reverte todos os updates e não emite PII',()=>{
 const f=fixture();const setup=`CREATE FUNCTION pg_temp.fail_after_update() RETURNS trigger LANGUAGE plpgsql AS $t$ BEGIN RAISE EXCEPTION 'SAFE_LATE_FAILURE'; END $t$; CREATE TRIGGER zz_test_late AFTER UPDATE ON public.gm_company_members FOR EACH STATEMENT EXECUTE FUNCTION pg_temp.fail_after_update();`;
 rejected(f,setup,'SAFE_LATE_FAILURE');
});
test('replay e segunda execução fazem zero updates',()=>{
 const runId=crypto.randomUUID();
 const eligible=fixture({email:`replay.${runId}@example.invalid`});
 const prefilled=fixture({username:'kept-user',metadata:'INVALID@SOURCE',email:`kept.${runId}@example.invalid`});
 const allUsers=[...eligible.users,...prefilled.users];
 const allCompanies=[eligible.companies[0],prefilled.companies[0]];
 const userList=allUsers.map(quote).join(',');
 const companyList=allCompanies.map(quote).join(',');
 const snapshot=()=>sql(`SELECT jsonb_build_object(
   'members',(SELECT jsonb_agg(jsonb_build_object('row',to_jsonb(m),'xmin',m.xmin::text) ORDER BY company_id,user_id) FROM public.gm_company_members m WHERE user_id IN (${userList})),
   'auth',(SELECT jsonb_agg(jsonb_build_object('row',to_jsonb(u),'xmin',u.xmin::text) ORDER BY id) FROM auth.users u WHERE id IN (${userList})),
   'companies',(SELECT jsonb_agg(jsonb_build_object('row',to_jsonb(c),'xmin',c.xmin::text) ORDER BY id) FROM public.gm_companies c WHERE id IN (${companyList}))
 )::text;`);
 const authSnapshot=()=>sql(`SELECT coalesce(jsonb_agg(jsonb_build_object('row',to_jsonb(u),'xmin',u.xmin::text) ORDER BY id),'[]'::jsonb)::text FROM auth.users u WHERE id IN (${userList});`);
 const tempAbsent=()=>assert.equal(sql("SELECT NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE c.relname='gm_missing_username_candidates' AND n.nspname LIKE 'pg_temp_%');"),'t');
 const executeFullFile=()=>{
  try{execFileSync('docker',[...args,'--file=-'],{input:migrationBytes,encoding:'utf8',timeout:20000,stdio:['pipe','pipe','pipe']});}
  catch(e){throw Error('LOCAL_SQL_TEST_FAILED '+(String(e.stderr||'').match(/ERROR:\s+(\w{5})/)?.[1]||'UNKNOWN'));}
 };
 sql(eligible.seed+prefilled.seed);
 const beforeAuth=authSnapshot();
 try{
  executeFullFile();
  tempAbsent();
  assert.equal(sql(`SELECT count(*)=1 FROM public.gm_company_members WHERE user_id=${quote(eligible.users[0])} AND access_username='safe-user';`),'t');
  assert.equal(sql(`SELECT count(*)=1 FROM public.gm_company_members WHERE user_id=${quote(prefilled.users[0])} AND access_username='kept-user';`),'t');
  assert.equal(sql(`SELECT role='technician' AND active AND access_profile='technician' AND permission_levels='{}'::jsonb AND NOT executor AND company_id=${quote(eligible.companies[0])} FROM public.gm_company_members WHERE user_id=${quote(eligible.users[0])};`),'t');
  assert.equal(authSnapshot(),beforeAuth);
  const afterFirst=snapshot();
  const afterFirstHash=crypto.createHash('sha256').update(afterFirst).digest('hex');
  executeFullFile();
  tempAbsent();
  const afterSecond=snapshot();
  assert.equal(crypto.createHash('sha256').update(afterSecond).digest('hex'),afterFirstHash);
  assert.equal(afterSecond,afterFirst);
 }finally{
  sql(`DELETE FROM public.gm_company_members WHERE user_id IN (${userList}); DELETE FROM public.gm_companies WHERE id IN (${companyList}); DELETE FROM auth.users WHERE id IN (${userList});`);
 }
});

async function withConcurrentLock(lock,action){
 const worker=spawn('docker',args,{stdio:['pipe','pipe','pipe']});let ready='';
 const completed=new Promise((resolve,reject)=>{worker.on('error',reject);worker.on('close',code=>code===0?resolve():reject(Error('LOCAL_LOCK_WORKER_FAILED')));});
 const locked=new Promise((resolve,reject)=>{worker.stdout.on('data',chunk=>{ready+=chunk.toString();if(ready.includes('LOCK_READY'))resolve();});worker.on('error',reject);worker.on('close',()=>{if(!ready.includes('LOCK_READY'))reject(Error('LOCAL_LOCK_NOT_ACQUIRED'));});});
 worker.stdin.end(`BEGIN; ${lock} SELECT 'LOCK_READY'; SELECT pg_sleep(2); ROLLBACK;`);
 await locked;try{await action();}finally{await completed;}
}
test('writer concorrente no vínculo é rejeitado atomicamente',async()=>{
 await withConcurrentLock('LOCK TABLE public.gm_company_members IN ROW EXCLUSIVE MODE;',()=>{
  let denied=false;try{sql(migration);}catch(e){denied=e.message.includes('55P03');}assert(denied);
 });
});
test('fonte Auth bloqueada concorrentemente aborta sem escrita',async()=>{
 const f=fixture();sql(f.seed);
 try{
  await withConcurrentLock(`SELECT 1 FROM auth.users WHERE id=${quote(f.users[0])} FOR UPDATE;`,()=>{
   let denied=false;try{sql(migration);}catch(e){denied=e.message.includes('55P03');}assert(denied);
   assert.equal(sql(`SELECT access_username IS NULL FROM public.gm_company_members WHERE ${f.where}`),'t');
  });
 }finally{
  // Fixture cleanup is restricted to the freshly generated synthetic identities.
  sql(`DELETE FROM public.gm_company_members WHERE ${f.where}; DELETE FROM public.gm_companies WHERE id=${quote(f.companies[0])}; DELETE FROM auth.users WHERE id=${quote(f.users[0])};`);
 }
});
