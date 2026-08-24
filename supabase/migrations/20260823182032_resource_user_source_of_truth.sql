begin;

-- Vínculo canônico entre a conta de acesso e o recurso operacional.
-- O recurso continua armazenado no estado tenant; esta tabela garante a
-- cardinalidade 1:1 e permite validação transacional no servidor.
create table if not exists public.gm_resource_user_links (
  company_id uuid not null,
  resource_id text not null,
  user_id uuid not null,
  linked_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gm_resource_user_links_pkey primary key (company_id, resource_id),
  constraint gm_resource_user_links_company_user_key unique (company_id, user_id),
  constraint gm_resource_user_links_resource_id_check
    check (length(trim(resource_id)) between 1 and 160),
  constraint gm_resource_user_links_company_fkey
    foreign key (company_id) references public.gm_companies(id) on delete cascade,
  constraint gm_resource_user_links_membership_fkey
    foreign key (company_id, user_id)
    references public.gm_company_members(company_id, user_id) on delete cascade,
  constraint gm_resource_user_links_linked_by_fkey
    foreign key (linked_by) references auth.users(id) on delete set null
);

create index if not exists gm_resource_user_links_user_id_idx
  on public.gm_resource_user_links(user_id);

drop trigger if exists gm_resource_user_links_updated_at on public.gm_resource_user_links;
create trigger gm_resource_user_links_updated_at
before update on public.gm_resource_user_links
for each row execute function public.gm_set_updated_at();

alter table public.gm_resource_user_links enable row level security;

drop policy if exists gm_resource_user_links_company_select on public.gm_resource_user_links;
create policy gm_resource_user_links_company_select
on public.gm_resource_user_links
for select
to authenticated
using (public.gm_is_company_member(company_id));

revoke all on table public.gm_resource_user_links from public, anon, authenticated;
grant select on table public.gm_resource_user_links to authenticated;

-- Remove vínculos órfãos quando um recurso for removido ou desvinculado por
-- qualquer gravação válida do estado tenant.
create or replace function public.gm_prune_resource_user_links()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.gm_resource_user_links link
  where link.company_id = new.company_id
    and not exists (
      select 1
      from jsonb_array_elements(
        case
          when jsonb_typeof(new.state -> 'resources') = 'array' then new.state -> 'resources'
          else '[]'::jsonb
        end
      ) resource
      where resource ->> 'id' = link.resource_id
        and resource ->> 'userId' = link.user_id::text
    );
  return new;
end;
$$;

drop trigger if exists gm_tenant_state_prune_resource_user_links on public.gm_tenant_state;
create trigger gm_tenant_state_prune_resource_user_links
after insert or update of state on public.gm_tenant_state
for each row execute function public.gm_prune_resource_user_links();

-- Se uma conta for removida por uma operação administrativa externa, limpa o
-- espelho userId no JSON sem apagar o recurso nem os snapshots históricos.
create or replace function public.gm_clear_deleted_resource_user_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.gm_tenant_state tenant
  set state = jsonb_set(
        tenant.state,
        '{resources}',
        (
          select coalesce(
            jsonb_agg(
              case
                when resource ->> 'id' = old.resource_id
                 and resource ->> 'userId' = old.user_id::text
                then jsonb_set(resource, '{userId}', '""'::jsonb, true)
                else resource
              end order by position
            ),
            '[]'::jsonb
          )
          from jsonb_array_elements(
            case
              when jsonb_typeof(tenant.state -> 'resources') = 'array' then tenant.state -> 'resources'
              else '[]'::jsonb
            end
          ) with ordinality as resources(resource, position)
        ),
        true
      ),
      version = tenant.version + 1,
      updated_by = null
  where tenant.company_id = old.company_id
    and exists (
      select 1
      from jsonb_array_elements(
        case
          when jsonb_typeof(tenant.state -> 'resources') = 'array' then tenant.state -> 'resources'
          else '[]'::jsonb
        end
      ) resource
      where resource ->> 'id' = old.resource_id
        and resource ->> 'userId' = old.user_id::text
    );
  return old;
end;
$$;

drop trigger if exists gm_resource_user_links_clear_state on public.gm_resource_user_links;
create trigger gm_resource_user_links_clear_state
after delete on public.gm_resource_user_links
for each row execute function public.gm_clear_deleted_resource_user_link();

-- Diretório tenant-scoped usado por Recursos, O.S. e calendário. Não expõe
-- e-mail de autenticação nem usuários de outras empresas.
create or replace function public.gm_list_operational_users()
returns table (
  user_id uuid,
  resource_id text,
  display_name text,
  access_username text,
  contact_email text,
  job_title text,
  access_profile text,
  executor boolean,
  active boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select member.company_id
    from public.gm_company_members member
    left join public.gm_profiles profile on profile.user_id = member.user_id
    where member.user_id = auth.uid()
      and member.active
      and coalesce(profile.active, true)
    order by member.created_at
    limit 1
  )
  select member.user_id,
         link.resource_id,
         coalesce(profile.display_name, member.access_username, 'Usuário'),
         coalesce(member.access_username, ''),
         coalesce(profile.contact_email, ''),
         coalesce(profile.job_title, ''),
         case when member.role = 'administrator' then 'admin' else member.access_profile end,
         member.executor,
         (member.active and coalesce(profile.active, true))
  from mine
  join public.gm_company_members member on member.company_id = mine.company_id
  left join public.gm_profiles profile on profile.user_id = member.user_id
  left join public.gm_resource_user_links link
    on link.company_id = member.company_id and link.user_id = member.user_id
  order by member.active desc, coalesce(profile.display_name, member.access_username, ''), member.user_id;
$$;

-- Salva o estado e o vínculo 1:1 na mesma transação. O RPC existente continua
-- responsável pela autorização por módulo, controle de versão e auditoria do
-- estado completo.
create or replace function public.gm_save_resource_user_link(
  p_expected_version bigint,
  p_state jsonb,
  p_resource_id text,
  p_user_id uuid default null
)
returns table (
  version bigint,
  updated_at timestamptz,
  resource_id text,
  user_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company_id uuid;
  v_resource jsonb;
  v_old_user_id uuid;
  v_version bigint;
  v_updated_at timestamptz;
begin
  if auth.uid() is null then raise exception 'GM_AUTH_REQUIRED'; end if;
  if jsonb_typeof(p_state) <> 'object' then raise exception 'GM_INVALID_STATE'; end if;
  if jsonb_typeof(p_state -> 'resources') <> 'array' then raise exception 'GM_INVALID_RESOURCES'; end if;
  if trim(coalesce(p_resource_id, '')) = '' then raise exception 'GM_RESOURCE_REQUIRED'; end if;

  select tenant.company_id
    into v_company_id
  from public.gm_tenant_state tenant
  where public.gm_is_company_member(tenant.company_id)
  order by tenant.updated_at desc
  limit 1;

  if v_company_id is null then raise exception 'GM_COMPANY_NOT_FOUND'; end if;
  if public.gm_access_level_rank(public.gm_member_module_level(v_company_id, 'resources'))
     < public.gm_access_level_rank('manage') then
    raise exception 'GM_PERMISSION_DENIED:resources';
  end if;

  select resource
    into v_resource
  from jsonb_array_elements(p_state -> 'resources') resource
  where resource ->> 'id' = p_resource_id
  limit 1;

  if v_resource is null then raise exception 'GM_RESOURCE_NOT_FOUND'; end if;
  if p_user_id is null and coalesce(v_resource ->> 'userId', '') <> '' then
    raise exception 'GM_RESOURCE_LINK_STATE_MISMATCH';
  end if;
  if p_user_id is not null and coalesce(v_resource ->> 'userId', '') <> p_user_id::text then
    raise exception 'GM_RESOURCE_LINK_STATE_MISMATCH';
  end if;
  if p_user_id is not null
     and coalesce(v_resource ->> 'resourceType', 'Usuário interno') <> 'Usuário interno' then
    raise exception 'GM_RESOURCE_TYPE_INVALID';
  end if;

  if p_user_id is not null and exists (
    select 1
    from jsonb_array_elements(p_state -> 'resources') other_resource
    where other_resource ->> 'id' <> p_resource_id
      and other_resource ->> 'userId' = p_user_id::text
  ) then
    raise exception 'GM_RESOURCE_USER_ALREADY_LINKED';
  end if;

  select link.user_id
    into v_old_user_id
  from public.gm_resource_user_links link
  where link.company_id = v_company_id and link.resource_id = p_resource_id;

  if p_user_id is not null then
    if not exists (
      select 1
      from public.gm_company_members member
      left join public.gm_profiles profile on profile.user_id = member.user_id
      where member.company_id = v_company_id
        and member.user_id = p_user_id
        and member.active
        and coalesce(profile.active, true)
    ) then
      raise exception 'GM_RESOURCE_USER_NOT_ACTIVE';
    end if;
    if exists (
      select 1
      from public.gm_resource_user_links link
      where link.company_id = v_company_id
        and link.user_id = p_user_id
        and link.resource_id <> p_resource_id
    ) then
      raise exception 'GM_RESOURCE_USER_ALREADY_LINKED';
    end if;

    insert into public.gm_resource_user_links(company_id, resource_id, user_id, linked_by)
    values (v_company_id, p_resource_id, p_user_id, auth.uid())
    on conflict on constraint gm_resource_user_links_pkey do update set
      user_id = excluded.user_id,
      linked_by = excluded.linked_by;
  end if;

  select saved.version, saved.updated_at
    into v_version, v_updated_at
  from public.gm_save_tenant_state(p_expected_version, p_state) saved;

  insert into public.gm_audit_log(company_id, user_id, action, entity, entity_id, metadata)
  values (
    v_company_id,
    auth.uid(),
    case when p_user_id is null then 'resource.user.unlink' else 'resource.user.link' end,
    'resource',
    p_resource_id,
    jsonb_build_object('previous_user_id', v_old_user_id, 'user_id', p_user_id)
  );

  return query select v_version, v_updated_at, p_resource_id, p_user_id;
exception
  when unique_violation then
    raise exception 'GM_RESOURCE_USER_ALREADY_LINKED';
end;
$$;

revoke all on function public.gm_list_operational_users() from public, anon;
revoke all on function public.gm_save_resource_user_link(bigint, jsonb, text, uuid) from public, anon;
grant execute on function public.gm_list_operational_users() to authenticated;
grant execute on function public.gm_save_resource_user_link(bigint, jsonb, text, uuid) to authenticated;

comment on table public.gm_resource_user_links is
  'Vínculo canônico 1:1 entre recursos operacionais do estado tenant e usuários de acesso.';

commit;
