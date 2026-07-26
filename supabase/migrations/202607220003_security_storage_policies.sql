begin;

-- Replica local das politicas confirmadas para o bucket privado.
-- O bucket ja existe no remoto; esta migration apenas prepara a definicao local.

do $$
begin
  if to_regclass('storage.objects') is not null then
    execute 'drop policy if exists gm_storage_select on storage.objects';
    execute 'drop policy if exists gm_storage_insert on storage.objects';
    execute 'drop policy if exists gm_storage_update on storage.objects';
    execute 'drop policy if exists gm_storage_delete on storage.objects';

    execute $sql$
      create policy gm_storage_select on storage.objects
        for select to authenticated
        using (
          bucket_id = 'gestman-attachments'
          and public.gm_is_company_member(public.gm_storage_company_id(name))
        )
    $sql$;

    execute $sql$
      create policy gm_storage_insert on storage.objects
        for insert to authenticated
        with check (
          bucket_id = 'gestman-attachments'
          and public.gm_member_can(public.gm_storage_company_id(name), public.gm_storage_module(name), 'operate')
        )
    $sql$;

    execute $sql$
      create policy gm_storage_update on storage.objects
        for update to authenticated
        using (
          bucket_id = 'gestman-attachments'
          and public.gm_member_can(public.gm_storage_company_id(name), public.gm_storage_module(name), 'operate')
        )
        with check (
          bucket_id = 'gestman-attachments'
          and public.gm_member_can(public.gm_storage_company_id(name), public.gm_storage_module(name), 'operate')
        )
    $sql$;

    execute $sql$
      create policy gm_storage_delete on storage.objects
        for delete to authenticated
        using (
          bucket_id = 'gestman-attachments'
          and public.gm_member_can(public.gm_storage_company_id(name), public.gm_storage_module(name), 'manage')
        )
    $sql$;
  end if;
end
$$;

commit;
