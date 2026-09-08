import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),"utf8");
const migration=read("supabase/migrations/20260908213849_asset_work_order_lifecycle.sql");
const transitionMigration=read("supabase/migrations/20260824234000_work_order_state_machine.sql");
const downtimeMigration=read("supabase/migrations/20260825001000_asset_downtime_sync.sql");

const functionSql=(source,name)=>{
  const start=source.indexOf(`create or replace function public.${name}(`);
  assert.notEqual(start,-1,`Função ${name} ausente`);
  const end=source.indexOf("\n$$;",start);
  assert.notEqual(end,-1,`Fim da função ${name} ausente`);
  return source.slice(start,end+4);
};

const definitions=(source,name)=>{
  const marker=`create or replace function public.${name}(`;
  const result=[];
  let cursor=0;
  while((cursor=source.indexOf(marker,cursor))>=0){
    const returns=source.indexOf("\nreturns ",cursor);
    result.push(source.slice(cursor,returns).replace(/\s+/g," ").trim());
    cursor=returns+1;
  }
  return result;
};

const activeSql=functionSql(migration,"gm_work_order_is_asset_active");
const reconcileSql=functionSql(migration,"gm_reconcile_asset_work_order_lifecycle");
const manualSql=functionSql(migration,"gm_mark_manual_asset_status_changes");
const triggerSql=functionSql(migration,"gm_enforce_work_order_state_transition");

test("transformações JSON são SECURITY INVOKER com search_path seguro",()=>{
  for(const body of [activeSql,reconcileSql,manualSql]){
    assert.match(body,/security invoker/i);
    assert.doesNotMatch(body,/security definer/i);
    assert.match(body,/set search_path = ''/i);
  }
});

test("a única SECURITY DEFINER da migration é a trigger interna justificada",()=>{
  const definers=[activeSql,reconcileSql,manualSql,triggerSql].filter(body=>/security definer/i.test(body));
  assert.deepEqual(definers,[triggerSql]);
  assert.match(triggerSql,/security definer/i);
  assert.match(triggerSql,/set search_path = ''/i);
  assert.match(migration,/comment on function public\.gm_enforce_work_order_state_transition\(\).*Trigger SECURITY DEFINER interno/is);
});

test("anônimo é rejeitado antes de qualquer leitura ou reconciliação",()=>{
  const auth=triggerSql.indexOf("v_actor_user_id := auth.uid()");
  const rejection=triggerSql.indexOf("GM_AUTH_REQUIRED");
  const marker=triggerSql.indexOf("v_marker :=");
  const reconciliation=triggerSql.indexOf("gm_reconcile_asset_work_order_lifecycle");
  assert.ok(auth>=0&&rejection>auth&&marker>rejection&&reconciliation>marker);
});

test("membro do tenant é exigido e contexto cruzado é bloqueado antes da escrita",()=>{
  const membership=triggerSql.indexOf("public.gm_is_company_member(v_company_id)");
  const denied=triggerSql.indexOf("GM_TENANT_ACCESS_DENIED");
  const tenantOrder=triggerSql.indexOf("GM_ORDER_TENANT_MISMATCH");
  const tenantAsset=triggerSql.indexOf("GM_ORDER_ASSET_TENANT_MISMATCH");
  const reconciliation=triggerSql.indexOf("gm_reconcile_asset_work_order_lifecycle");
  assert.ok(membership>=0&&denied>membership);
  assert.ok(tenantOrder>denied&&tenantAsset>tenantOrder&&reconciliation>tenantAsset);
  assert.match(reconcileSql,/if v_asset is null then raise exception 'GM_ORDER_ASSET_TENANT_MISMATCH'/i);
});

test("PUBLIC e anon não executam auxiliares ou trigger; somente RPC recebe authenticated",()=>{
  for(const signature of [
    "public.gm_work_order_is_asset_active(jsonb)",
    "public.gm_reconcile_asset_work_order_lifecycle(jsonb, text, uuid)",
    "public.gm_mark_manual_asset_status_changes(jsonb, jsonb)",
    "public.gm_enforce_work_order_state_transition()",
  ]){
    assert.ok(migration.includes(`revoke all on function ${signature} from public, anon, authenticated;`));
    assert.ok(!migration.includes(`grant execute on function ${signature}`));
  }
  const rpc="public.gm_transition_work_order(bigint, text, text, jsonb, text, uuid)";
  assert.ok(migration.includes(`revoke all on function ${rpc} from public, anon;`));
  assert.ok(migration.includes(`grant execute on function ${rpc} to authenticated;`));
  assert.match(transitionMigration,/if auth\.uid\(\) is null then raise exception 'GM_AUTH_REQUIRED'/i);
  assert.match(transitionMigration,/where public\.gm_is_company_member\(tenant\.company_id\)/i);
});

test("não há sobrecarga homônima exposta nas migrations locais",()=>{
  const sources=[transitionMigration,downtimeMigration,migration].join("\n");
  assert.deepEqual([...new Set(definitions(sources,"gm_enforce_work_order_state_transition"))],["create or replace function public.gm_enforce_work_order_state_transition()"]);
  assert.equal(new Set(definitions(sources,"gm_reconcile_asset_work_order_lifecycle")).size,1);
  assert.equal(new Set(definitions(sources,"gm_mark_manual_asset_status_changes")).size,1);
});

test("concorrência, replay e rollback continuam transacionais",()=>{
  assert.match(transitionMigration,/for update;/i);
  assert.match(transitionMigration,/unique \(company_id, request_id\)/i);
  assert.match(transitionMigration,/if found then[\s\S]*return query[\s\S]*return;/i);
  assert.match(migration,/^begin;/i);
  assert.match(migration,/commit;\s*$/i);
  assert.doesNotMatch(migration,/\b(drop\s+(table|schema)|truncate|delete\s+from|update\s+public\.)\b/i);
});

test("a integração com duas O.S., parada ativa e status manual foi preservada",()=>{
  assert.match(reconcileSql,/v_has_active_order/i);
  assert.match(reconcileSql,/v_has_active_downtime/i);
  assert.match(reconcileSql,/workOrderStatusControl/i);
  assert.match(reconcileSql,/statusSetManually/i);
  assert.match(reconcileSql,/WORK_ORDER_MAINTENANCE_RELEASED_DURING_DOWNTIME/i);
});

test("somente uma migration da Fase 04 existe no diretório",()=>{
  const files=fs.readdirSync(new URL("../supabase/migrations/",import.meta.url))
    .filter(name=>name.startsWith("202608310001_")||name.startsWith("20260908213849_"));
  assert.deepEqual(files,["20260908213849_asset_work_order_lifecycle.sql"]);
});
