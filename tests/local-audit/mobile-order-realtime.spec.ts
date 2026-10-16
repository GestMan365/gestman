import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto('./');
  await page.evaluate(() => window.eval(`
    currentAccount={company:{id:'qa-company',login:'qa'},user:{id:'qa-user',name:'QA',role:'admin',accessProfile:'admin',active:true}};
    document.body.classList.remove('auth-required','auth-loading','auth-restoring');
    document.body.classList.add('theme-light');
    gmKnownRemoteOrderIds=new Set(['old-order']);
  `));
});

test('nova O.S. gera notificação interna imediata e apenas uma vez', async ({ page }) => {
  const result = await page.evaluate(() => window.eval(`
    const orders=[{id:'old-order',number:'O.S.-001',status:'Aberta'},{id:'new-order',number:'O.S.-002',title:'Revisar bomba',status:'Aberta'}];
    gmObserveNewRemoteOrders(orders);
    gmObserveNewRemoteOrders(orders);
    stage20Notifications().filter(item=>item.related?.id==='new-order').map(item=>({title:item.title,read:item.read}));
  `));
  expect(result).toEqual([{ title:'Nova O.S. aberta · O.S.-002', read:false }]);
});

test('aviso em tempo real notifica mesmo com formulário aberto e adia apenas atualização da tela', async ({ page }) => {
  const pending = await page.evaluate(() => window.eval(`
    gmRemoteStateVersion=1;
    gmReadSession=()=>({access_token:'qa-token'});
    gmBackgroundRefreshBlocked=()=>true;
    gmRpc=async()=>({version:2,state:{orders:[{id:'old-order',number:'O.S.-001',status:'Aberta'},{id:'new-order-2',number:'O.S.-003',title:'Inspecionar motor',status:'Aberta'}]}});
    gmRefreshRemoteFromSignal(2).then(()=>({version:gmPendingRemoteState?.version,notified:stage20Notifications().some(item=>item.related?.id==='new-order-2')}));
  `));
  expect(pending).toEqual({ version:2, notified:true });
  const applied = await page.evaluate(() => window.eval(`
    gmBackgroundRefreshBlocked=()=>false;
    loadSupabaseState=async (_show,_force,remote)=>{gmRemoteStateVersion=remote.version;return true};
    gmApplyPendingRemoteState().then(()=>({version:gmRemoteStateVersion,pending:gmPendingRemoteState}));
  `));
  expect(applied).toEqual({ version:2, pending:null });
  await expect.poll(() => page.evaluate(() => Boolean((window as any).GMTenantRealtime))).toBe(true);
});
