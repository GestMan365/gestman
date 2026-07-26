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

commit;
