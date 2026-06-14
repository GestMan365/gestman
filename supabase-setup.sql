-- GestMan365 - estrutura inicial para Supabase
-- Rode este script no Supabase em SQL Editor > New query.

create table if not exists public.ativos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null,
  setor text not null,
  criticidade text not null default 'Media',
  status text not null default 'Operando',
  responsavel text,
  created_at timestamptz not null default now()
);

create table if not exists public.ordens_servico (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique,
  ativo_id uuid references public.ativos(id) on delete set null,
  solicitante text not null,
  prioridade text not null default 'Media',
  status text not null default 'Aberta',
  tecnico text,
  descricao text,
  custo_estimado numeric(12,2) not null default 0,
  prazo date,
  created_at timestamptz not null default now()
);

create table if not exists public.preventivas (
  id uuid primary key default gen_random_uuid(),
  ativo_id uuid references public.ativos(id) on delete cascade,
  nome text not null,
  frequencia text not null,
  proxima_execucao date,
  status text not null default 'No prazo',
  created_at timestamptz not null default now()
);

create table if not exists public.chamados (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique,
  origem text not null,
  descricao text not null,
  prioridade text not null default 'Media',
  status text not null default 'Aberto',
  created_at timestamptz not null default now()
);

create table if not exists public.pecas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null,
  saldo numeric(12,2) not null default 0,
  saldo_minimo numeric(12,2) not null default 0,
  localizacao text,
  created_at timestamptz not null default now()
);

alter table public.ativos enable row level security;
alter table public.ordens_servico enable row level security;
alter table public.preventivas enable row level security;
alter table public.chamados enable row level security;
alter table public.pecas enable row level security;

-- Politicas abertas para prototipo inicial com chave publishable.
-- Antes de usar em producao, troque por politicas com usuarios autenticados.
create policy "prototipo_select_ativos" on public.ativos for select using (true);
create policy "prototipo_insert_ativos" on public.ativos for insert with check (true);
create policy "prototipo_update_ativos" on public.ativos for update using (true);

create policy "prototipo_select_ordens" on public.ordens_servico for select using (true);
create policy "prototipo_insert_ordens" on public.ordens_servico for insert with check (true);
create policy "prototipo_update_ordens" on public.ordens_servico for update using (true);

create policy "prototipo_select_preventivas" on public.preventivas for select using (true);
create policy "prototipo_insert_preventivas" on public.preventivas for insert with check (true);
create policy "prototipo_update_preventivas" on public.preventivas for update using (true);

create policy "prototipo_select_chamados" on public.chamados for select using (true);
create policy "prototipo_insert_chamados" on public.chamados for insert with check (true);
create policy "prototipo_update_chamados" on public.chamados for update using (true);

create policy "prototipo_select_pecas" on public.pecas for select using (true);
create policy "prototipo_insert_pecas" on public.pecas for insert with check (true);
create policy "prototipo_update_pecas" on public.pecas for update using (true);

insert into public.ativos (codigo, nome, setor, criticidade, status, responsavel)
values
  ('AT-001', 'Compressor Atlas 40HP', 'Utilidades', 'Alta', 'Operando', 'Marcos Lima'),
  ('AT-002', 'Esteira Linha 2', 'Producao', 'Alta', 'Em manutencao', 'Paula Rocha'),
  ('AT-003', 'Empilhadeira E-14', 'Logistica', 'Media', 'Operando', 'Renato Alves')
on conflict (codigo) do nothing;

insert into public.chamados (numero, origem, descricao, prioridade, status)
values
  ('CH-2201', 'Linha 2', 'Ruido anormal na esteira', 'Alta', 'Triagem'),
  ('CH-2202', 'Almoxarifado', 'Vazamento em empilhadeira', 'Media', 'Aberto')
on conflict (numero) do nothing;
