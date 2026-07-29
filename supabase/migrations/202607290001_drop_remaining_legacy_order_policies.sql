begin;

-- Production drift containment: these permissive prototype policies use
-- legacy names that predate the ordens_servico naming covered by migration
-- 202607220001. They must not remain available to public roles.
do $$
begin
  if to_regclass('public.ordens_servico') is not null then
    execute
      'drop policy if exists prototipo_select_ordens '
      'on public.ordens_servico';
    execute
      'drop policy if exists prototipo_insert_ordens '
      'on public.ordens_servico';
    execute
      'drop policy if exists prototipo_update_ordens '
      'on public.ordens_servico';
  end if;
end
$$;

commit;
