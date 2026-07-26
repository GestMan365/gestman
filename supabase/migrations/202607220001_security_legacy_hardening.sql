begin;

-- Contencao segura de legados expostos.
-- Nao consulta valores de clientes e nao reabre politicas publicas.

do $$
begin
  if to_regclass('public.ativos') is not null then
    execute 'drop policy if exists prototipo_select_ativos on public.ativos';
    execute 'drop policy if exists prototipo_insert_ativos on public.ativos';
    execute 'drop policy if exists prototipo_update_ativos on public.ativos';
  end if;

  if to_regclass('public.chamados') is not null then
    execute 'drop policy if exists prototipo_select_chamados on public.chamados';
    execute 'drop policy if exists prototipo_insert_chamados on public.chamados';
    execute 'drop policy if exists prototipo_update_chamados on public.chamados';
  end if;

  if to_regclass('public.ordens_servico') is not null then
    execute 'drop policy if exists prototipo_select_ordens_servico on public.ordens_servico';
    execute 'drop policy if exists prototipo_insert_ordens_servico on public.ordens_servico';
    execute 'drop policy if exists prototipo_update_ordens_servico on public.ordens_servico';
  end if;

  if to_regclass('public.pecas') is not null then
    execute 'drop policy if exists prototipo_select_pecas on public.pecas';
    execute 'drop policy if exists prototipo_insert_pecas on public.pecas';
    execute 'drop policy if exists prototipo_update_pecas on public.pecas';
  end if;

  if to_regclass('public.preventivas') is not null then
    execute 'drop policy if exists prototipo_select_preventivas on public.preventivas';
    execute 'drop policy if exists prototipo_insert_preventivas on public.preventivas';
    execute 'drop policy if exists prototipo_update_preventivas on public.preventivas';
  end if;

  if to_regclass('public.gestman_empresas') is not null then
    execute 'drop policy if exists gestman_empresas_insert_public on public.gestman_empresas';
    execute 'revoke all on table public.gestman_empresas from public, anon, authenticated';
  end if;

  if to_regclass('public.gestman_usuarios') is not null then
    execute 'drop policy if exists gestman_usuarios_insert_public on public.gestman_usuarios';
    execute 'revoke all on table public.gestman_usuarios from public, anon, authenticated';
    execute 'alter table public.gestman_usuarios enable row level security';
  end if;

  if to_regprocedure('public.gestman_login(text,text,text)') is not null then
    execute 'revoke execute on function public.gestman_login(text,text,text) from public, anon, authenticated';
  end if;
end
$$;

create or replace function public.gm_block_legacy_password_writes()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'INSERT' and new.senha is not null then
    raise exception 'GM_LEGACY_PASSWORD_WRITE_BLOCKED' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and new.senha is distinct from old.senha then
    raise exception 'GM_LEGACY_PASSWORD_WRITE_BLOCKED' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.gm_block_legacy_password_writes() from public, anon, authenticated;

do $$
begin
  if to_regclass('public.gestman_usuarios') is not null then
    execute 'drop trigger if exists gm_block_legacy_password_writes on public.gestman_usuarios';
    execute 'create trigger gm_block_legacy_password_writes before insert or update on public.gestman_usuarios for each row execute function public.gm_block_legacy_password_writes()';
  end if;
end
$$;

-- Porta atomica e idempotente usada exclusivamente pela Edge Function de
-- bootstrap. A identidade vem do Supabase Auth validado no servidor.
create or replace function public.gm_bootstrap_company_server(
  p_user_id uuid,
  p_name text,
  p_slug text,
  p_display_name text,
  p_idempotency_key text
)
returns table(
  company_name text,
  company_slug text,
  created boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_company public.gm_companies%rowtype;
  v_existing public.gm_companies%rowtype;
  v_name text := trim(coalesce(p_name, ''));
  v_slug text := lower(trim(coalesce(p_slug, '')));
  v_display_name text := trim(coalesce(p_display_name, ''));
begin
  if p_user_id is null
     or not exists (
       select 1
       from auth.users u
       where u.id = p_user_id
     ) then
    raise exception 'GM_AUTH_USER_NOT_FOUND' using errcode = '42501';
  end if;

  if length(v_name) < 2 or length(v_name) > 160
     or length(v_display_name) < 2 or length(v_display_name) > 160 then
    raise exception 'GM_REQUIRED_FIELDS' using errcode = '22023';
  end if;
  if v_slug !~ '^[a-z0-9][a-z0-9-]{1,62}$' then
    raise exception 'GM_INVALID_SLUG' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_idempotency_key, ''))) < 16
     or length(p_idempotency_key) > 128 then
    raise exception 'GM_INVALID_IDEMPOTENCY_KEY' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('gm.bootstrap.' || p_user_id::text, 0)
  );

  select c.*
  into v_existing
  from public.gm_company_members m
  join public.gm_companies c on c.id = m.company_id
  where m.user_id = p_user_id
  order by m.created_at
  limit 1;

  if found then
    if v_existing.slug = v_slug then
      return query
      select v_existing.name, v_existing.slug, false;
      return;
    end if;
    raise exception 'GM_USER_ALREADY_HAS_COMPANY' using errcode = '23505';
  end if;

  if exists (select 1 from public.gm_companies c where c.slug = v_slug) then
    raise exception 'GM_SLUG_ALREADY_EXISTS' using errcode = '23505';
  end if;

  insert into public.gm_companies(name, slug, created_by)
  values (v_name, v_slug, p_user_id)
  returning * into v_company;

  insert into public.gm_profiles(user_id, display_name, active)
  values (p_user_id, v_display_name, true)
  on conflict (user_id) do update
  set display_name = excluded.display_name,
      active = true,
      updated_at = now();

  insert into public.gm_company_members(
    company_id,
    user_id,
    role,
    active,
    access_profile
  )
  values (
    v_company.id,
    p_user_id,
    'administrator',
    true,
    'admin'
  );

  insert into public.gm_tenant_state(company_id, state, version, updated_by)
  values (v_company.id, '{}'::jsonb, 0, p_user_id);

  insert into public.gm_user_preferences(
    company_id,
    user_id,
    preferences
  )
  values (v_company.id, p_user_id, '{}'::jsonb);

  insert into public.gm_audit_log(
    company_id,
    user_id,
    action,
    entity,
    entity_id,
    metadata
  )
  values (
    v_company.id,
    p_user_id,
    'company.bootstrap',
    'company',
    v_company.id::text,
    jsonb_build_object(
      'idempotency_hash',
      encode(extensions.digest(p_idempotency_key, 'sha256'), 'hex')
    )
  );

  return query
  select v_company.name, v_company.slug, true;
exception
  when unique_violation then
    raise exception 'GM_BOOTSTRAP_CONFLICT' using errcode = '23505';
end;
$$;

revoke all on function public.gm_bootstrap_company_server(
  uuid,
  text,
  text,
  text,
  text
) from public, anon, authenticated;
grant execute on function public.gm_bootstrap_company_server(
  uuid,
  text,
  text,
  text,
  text
) to service_role;

commit;
