-- GestMan365 - estrutura inicial para Supabase
-- Rode este script no Supabase em SQL Editor > New query.

create table if not exists public.ativos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null,
  setor text not null,
  local_id uuid,
  tag_id uuid,
  sub_tag_id uuid,
  criticidade text not null default 'Media',
  status text not null default 'Operando',
  responsavel text,
  icone text,
  alertas integer not null default 0,
  pos_x numeric(5,2) not null default 50,
  pos_y numeric(5,2) not null default 50,
  created_at timestamptz not null default now()
);

create table if not exists public.locais (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  tipo text not null default 'Area',
  codigo_visual text,
  cor text not null default '#123f8d',
  x numeric(5,2) not null default 0,
  y numeric(5,2) not null default 0,
  largura numeric(5,2) not null default 24,
  altura numeric(5,2) not null default 20,
  created_at timestamptz not null default now()
);

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null,
  descricao text,
  created_at timestamptz not null default now()
);

create table if not exists public.sub_tags (
  id uuid primary key default gen_random_uuid(),
  tag_id uuid references public.tags(id) on delete cascade,
  codigo text not null,
  nome text not null,
  created_at timestamptz not null default now(),
  unique (tag_id, codigo)
);

alter table public.ativos add column if not exists local_id uuid;
alter table public.ativos add column if not exists tag_id uuid;
alter table public.ativos add column if not exists sub_tag_id uuid;
alter table public.ativos add column if not exists icone text;
alter table public.ativos add column if not exists alertas integer not null default 0;
alter table public.ativos add column if not exists pos_x numeric(5,2) not null default 50;
alter table public.ativos add column if not exists pos_y numeric(5,2) not null default 50;
alter table public.locais add column if not exists codigo_visual text;

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
alter table public.locais enable row level security;
alter table public.tags enable row level security;
alter table public.sub_tags enable row level security;
alter table public.ordens_servico enable row level security;
alter table public.preventivas enable row level security;
alter table public.chamados enable row level security;
alter table public.pecas enable row level security;

-- Politicas abertas para prototipo inicial com chave publishable.
-- Antes de usar em producao, troque por politicas com usuarios autenticados.
drop policy if exists "prototipo_select_ativos" on public.ativos;
drop policy if exists "prototipo_insert_ativos" on public.ativos;
drop policy if exists "prototipo_update_ativos" on public.ativos;
drop policy if exists "prototipo_select_locais" on public.locais;
drop policy if exists "prototipo_insert_locais" on public.locais;
drop policy if exists "prototipo_update_locais" on public.locais;
drop policy if exists "prototipo_select_tags" on public.tags;
drop policy if exists "prototipo_insert_tags" on public.tags;
drop policy if exists "prototipo_update_tags" on public.tags;
drop policy if exists "prototipo_select_sub_tags" on public.sub_tags;
drop policy if exists "prototipo_insert_sub_tags" on public.sub_tags;
drop policy if exists "prototipo_update_sub_tags" on public.sub_tags;
drop policy if exists "prototipo_select_ordens" on public.ordens_servico;
drop policy if exists "prototipo_insert_ordens" on public.ordens_servico;
drop policy if exists "prototipo_update_ordens" on public.ordens_servico;
drop policy if exists "prototipo_select_preventivas" on public.preventivas;
drop policy if exists "prototipo_insert_preventivas" on public.preventivas;
drop policy if exists "prototipo_update_preventivas" on public.preventivas;
drop policy if exists "prototipo_select_chamados" on public.chamados;
drop policy if exists "prototipo_insert_chamados" on public.chamados;
drop policy if exists "prototipo_update_chamados" on public.chamados;
drop policy if exists "prototipo_select_pecas" on public.pecas;
drop policy if exists "prototipo_insert_pecas" on public.pecas;
drop policy if exists "prototipo_update_pecas" on public.pecas;

create policy "prototipo_select_ativos" on public.ativos for select using (true);
create policy "prototipo_insert_ativos" on public.ativos for insert with check (true);
create policy "prototipo_update_ativos" on public.ativos for update using (true);

create policy "prototipo_select_locais" on public.locais for select using (true);
create policy "prototipo_insert_locais" on public.locais for insert with check (true);
create policy "prototipo_update_locais" on public.locais for update using (true);

create policy "prototipo_select_tags" on public.tags for select using (true);
create policy "prototipo_insert_tags" on public.tags for insert with check (true);
create policy "prototipo_update_tags" on public.tags for update using (true);

create policy "prototipo_select_sub_tags" on public.sub_tags for select using (true);
create policy "prototipo_insert_sub_tags" on public.sub_tags for insert with check (true);
create policy "prototipo_update_sub_tags" on public.sub_tags for update using (true);

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

insert into public.locais (nome, tipo, cor, x, y, largura, altura)
values
  ('Linha 01 - Producao', 'Linha', '#123f8d', 6, 8, 42, 32),
  ('Linha 02 - Producao', 'Linha', '#123f8d', 54, 8, 36, 32),
  ('Linha 03 - Producao', 'Linha', '#ff8a4c', 12, 54, 32, 30)
on conflict (nome) do nothing;

insert into public.tags (codigo, nome, descricao)
values
  ('MEC', 'Mecanica', 'Conjuntos mecanicos, transmissao e rolamentos'),
  ('ELE', 'Eletrica', 'Painel, motor, sensores e automacao'),
  ('UTIL', 'Utilidades', 'Ar comprimido, agua, vapor e energia')
on conflict (codigo) do nothing;

insert into public.sub_tags (tag_id, codigo, nome)
select id, 'ROL', 'Rolamentos' from public.tags where codigo = 'MEC'
on conflict (tag_id, codigo) do nothing;

insert into public.sub_tags (tag_id, codigo, nome)
select id, 'TRM', 'Transmissao' from public.tags where codigo = 'MEC'
on conflict (tag_id, codigo) do nothing;

insert into public.sub_tags (tag_id, codigo, nome)
select id, 'MOT', 'Motor eletrico' from public.tags where codigo = 'ELE'
on conflict (tag_id, codigo) do nothing;

insert into public.sub_tags (tag_id, codigo, nome)
select id, 'CMP', 'Compressor' from public.tags where codigo = 'UTIL'
on conflict (tag_id, codigo) do nothing;

insert into public.ativos (codigo, nome, setor, criticidade, status, responsavel, pos_x, pos_y, local_id, tag_id, sub_tag_id)
values
  (
    'AT-001',
    'Compressor Atlas 40HP',
    'Utilidades',
    'Alta',
    'Operando',
    'Marcos Lima',
    72,
    22,
    (select id from public.locais where nome = 'Utilidades' limit 1),
    (select id from public.tags where codigo = 'UTIL' limit 1),
    (select st.id from public.sub_tags st join public.tags t on t.id = st.tag_id where t.codigo = 'UTIL' and st.codigo = 'CMP' limit 1)
  ),
  (
    'AT-002',
    'Esteira Linha 1',
    'Producao',
    'Alta',
    'Em manutencao',
    'Paula Rocha',
    25,
    24,
    (select id from public.locais where nome = 'Linha 02 - Producao' limit 1),
    (select id from public.tags where codigo = 'MEC' limit 1),
    (select st.id from public.sub_tags st join public.tags t on t.id = st.tag_id where t.codigo = 'MEC' and st.codigo = 'TRM' limit 1)
  ),
  (
    'AT-003',
    'Painel CCM-01',
    'Eletrica',
    'Media',
    'Inspecao',
    'Bianca Torres',
    42,
    31,
    (select id from public.locais where nome = 'Linha 03 - Producao' limit 1),
    (select id from public.tags where codigo = 'ELE' limit 1),
    (select st.id from public.sub_tags st join public.tags t on t.id = st.tag_id where t.codigo = 'ELE' and st.codigo = 'MOT' limit 1)
  )
on conflict (codigo) do nothing;

insert into public.chamados (numero, origem, descricao, prioridade, status)
values
  ('CH-2201', 'Linha 2', 'Ruido anormal na esteira', 'Alta', 'Triagem'),
  ('CH-2202', 'Almoxarifado', 'Vazamento em empilhadeira', 'Media', 'Aberto')
on conflict (numero) do nothing;
