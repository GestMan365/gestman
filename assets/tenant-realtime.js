import { createClient } from '@supabase/supabase-js';

let client = null;
let channel = null;
let activeCompanyId = '';
let connected = false;

async function disconnect() {
  const oldClient = client;
  const oldChannel = channel;
  client = null;
  channel = null;
  activeCompanyId = '';
  connected = false;
  if (oldClient && oldChannel) await oldClient.removeChannel(oldChannel).catch(() => {});
}

function connect({ url, key, companyId, onChange }) {
  if (!url || !key || !companyId) return;
  if (activeCompanyId === companyId && channel) return;
  disconnect();
  activeCompanyId = companyId;
  // The public channel carries only a version number; operational data remains behind tenant RLS.
  client = createClient(url, key, {
    auth: { persistSession:false, autoRefreshToken:false, detectSessionInUrl:false },
    realtime: { params: { eventsPerSecond:10 } },
  });
  const liveClient = client;
  channel = client.channel(`gm-state:${companyId}`, { config:{ broadcast:{ ack:true } } });
  channel.on('broadcast', { event:'saved' }, ({ payload }) => {
    if (liveClient !== client || activeCompanyId !== companyId) return;
    const version = Number(payload?.version);
    if (Number.isSafeInteger(version) && version > 0) onChange(version);
  });
  channel.subscribe(status => {
    if (liveClient !== client) return;
    connected = status === 'SUBSCRIBED';
    if (connected) onChange(0); // Reconcile changes missed while the socket was reconnecting.
  });
}

async function publish(companyId, version) {
  if (!channel || !connected || activeCompanyId !== companyId || !Number.isSafeInteger(version)) return false;
  try {
    return (await channel.send({ type:'broadcast', event:'saved', payload:{ version } })) === 'ok';
  } catch { return false; }
}

window.GMTenantRealtime = { connect, disconnect, publish, isConnected:() => connected };
window.dispatchEvent(new Event('gm-tenant-realtime-ready'));
