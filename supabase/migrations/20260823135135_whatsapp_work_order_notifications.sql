-- Registro server-side das tentativas de alerta de O.S. pelo WhatsApp.
-- Os telefones ficam cifrados com uma chave exclusiva da Edge Function.

create table if not exists public.gm_whatsapp_settings (
  company_id uuid primary key references public.gm_companies(id) on delete cascade,
  enabled boolean not null default false,
  recipient_ciphertext text not null default '',
  recipient_iv text not null default '',
  recipient_last4 text[] not null default '{}',
  notify_on_create boolean not null default true,
  notify_on_status boolean not null default true,
  notify_on_assignment boolean not null default true,
  notify_on_priority boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gm_whatsapp_settings_recipient_limit_check
    check (cardinality(recipient_last4) <= 5)
);

drop trigger if exists gm_whatsapp_settings_updated_at on public.gm_whatsapp_settings;
create trigger gm_whatsapp_settings_updated_at
  before update on public.gm_whatsapp_settings
  for each row execute function public.gm_set_updated_at();

alter table public.gm_whatsapp_settings enable row level security;

revoke all on table public.gm_whatsapp_settings from anon, authenticated;
grant select, insert, update, delete on table public.gm_whatsapp_settings to service_role;

comment on table public.gm_whatsapp_settings is
  'Configuracao multiempresa dos alertas de O.S.; destinatarios cifrados e acessiveis somente pela Edge Function.';

create table if not exists public.gm_whatsapp_delivery_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.gm_companies(id) on delete cascade,
  order_id text not null,
  event_key text not null,
  event_type text not null,
  recipient_hash text not null,
  recipient_last4 text,
  status text not null default 'pending',
  provider_message_id text,
  error_code text,
  error_message text,
  attempt_count integer not null default 1,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gm_whatsapp_delivery_event_type_check
    check (event_type in ('created', 'status_changed', 'assigned', 'priority_changed', 'test')),
  constraint gm_whatsapp_delivery_status_check
    check (status in ('pending', 'accepted', 'failed', 'skipped')),
  constraint gm_whatsapp_delivery_recipient_hash_check
    check (length(recipient_hash) = 64),
  constraint gm_whatsapp_delivery_attempt_count_check
    check (attempt_count between 1 and 10),
  constraint gm_whatsapp_delivery_unique
    unique (company_id, event_key, recipient_hash)
);

create index if not exists gm_whatsapp_delivery_company_created_idx
  on public.gm_whatsapp_delivery_log (company_id, created_at desc);

create index if not exists gm_whatsapp_delivery_order_idx
  on public.gm_whatsapp_delivery_log (company_id, order_id, created_at desc);

drop trigger if exists gm_whatsapp_delivery_updated_at on public.gm_whatsapp_delivery_log;
create trigger gm_whatsapp_delivery_updated_at
  before update on public.gm_whatsapp_delivery_log
  for each row execute function public.gm_set_updated_at();

alter table public.gm_whatsapp_delivery_log enable row level security;

revoke all on table public.gm_whatsapp_delivery_log from anon, authenticated;
grant select on table public.gm_whatsapp_delivery_log to authenticated;
grant select, insert, update, delete on table public.gm_whatsapp_delivery_log to service_role;

drop policy if exists gm_whatsapp_delivery_admin_select on public.gm_whatsapp_delivery_log;
create policy gm_whatsapp_delivery_admin_select
  on public.gm_whatsapp_delivery_log
  for select
  to authenticated
  using (public.gm_is_company_admin(company_id));

comment on table public.gm_whatsapp_delivery_log is
  'Log multiempresa e idempotente dos alertas de Ordem de Servico enviados pelo WhatsApp Cloud API.';
