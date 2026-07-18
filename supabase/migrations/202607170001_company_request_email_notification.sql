-- Rastreamento do e-mail de notificacao das solicitacoes de novas empresas.
-- Migration aditiva: nao remove nem altera dados existentes.

alter table public.company_requests
  add column if not exists notification_email text,
  add column if not exists notification_sent_at timestamptz,
  add column if not exists notification_error text;

comment on column public.company_requests.notification_email is
  'Destinatario interno da notificacao de nova solicitacao.';
comment on column public.company_requests.notification_sent_at is
  'Data e hora em que o provedor confirmou o envio da notificacao.';
comment on column public.company_requests.notification_error is
  'Ultimo erro do provedor de e-mail, sem dados secretos.';

revoke all on public.company_requests from anon;

