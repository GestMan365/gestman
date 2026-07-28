begin;

create or replace function public.gm_storage_path_is_canonical(p_name text)
returns boolean
language plpgsql
immutable
strict
set search_path = public
as $$
declare
  v_parts text[];
  v_part text;
begin
  if p_name = ''
     or length(p_name) > 1024
     or p_name <> btrim(p_name)
     or left(p_name, 1) = '/'
     or p_name ~ '^[A-Za-z]:'
     or p_name ~ '[[:cntrl:]]'
     or position(E'\\' in p_name) > 0
     or position('//' in p_name) > 0
     or p_name ~* '%(25|2e|2f|5c)'
     or position(chr(65294) in p_name) > 0
     or position(chr(65295) in p_name) > 0
     or position(chr(65340) in p_name) > 0
     or position(chr(8725) in p_name) > 0
     or position(chr(8260) in p_name) > 0 then
    return false;
  end if;

  v_parts := string_to_array(p_name, '/');
  if cardinality(v_parts) < 3
     or v_parts[1] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or lower(v_parts[2]) not in ('orders', 'assets', 'stock', 'documents') then
    return false;
  end if;

  foreach v_part in array v_parts loop
    if v_part in ('', '.', '..') or length(v_part) > 255 then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

create or replace function public.gm_storage_company_id(p_name text)
returns uuid
language plpgsql
immutable
strict
set search_path = public
as $$
declare
  v_part text;
begin
  if not public.gm_storage_path_is_canonical(p_name) then
    return null;
  end if;
  v_part := (string_to_array(p_name, '/'))[1];
  return v_part::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

create or replace function public.gm_storage_module(p_name text)
returns text
language sql
immutable
strict
set search_path = public
as $$
  select case
    when public.gm_storage_path_is_canonical(p_name)
      then lower((string_to_array(p_name, '/'))[2])
    else null
  end;
$$;

do $$
begin
  if to_regclass('storage.objects') is not null then
    execute 'drop policy if exists gm_storage_select on storage.objects';
    execute 'drop policy if exists gm_storage_insert on storage.objects';
    execute 'drop policy if exists gm_storage_update on storage.objects';
    execute 'drop policy if exists gm_storage_delete on storage.objects';

    execute $policy$
      create policy gm_storage_select on storage.objects
        for select to authenticated
        using (
          bucket_id = 'gestman-attachments'
          and public.gm_storage_path_is_canonical(name)
          and public.gm_is_company_member(public.gm_storage_company_id(name))
        )
    $policy$;

    execute $policy$
      create policy gm_storage_insert on storage.objects
        for insert to authenticated
        with check (
          bucket_id = 'gestman-attachments'
          and public.gm_storage_path_is_canonical(name)
          and public.gm_member_can(
            public.gm_storage_company_id(name),
            public.gm_storage_module(name),
            'operate'
          )
        )
    $policy$;

    execute $policy$
      create policy gm_storage_update on storage.objects
        for update to authenticated
        using (
          bucket_id = 'gestman-attachments'
          and public.gm_storage_path_is_canonical(name)
          and public.gm_member_can(
            public.gm_storage_company_id(name),
            public.gm_storage_module(name),
            'operate'
          )
        )
        with check (
          bucket_id = 'gestman-attachments'
          and public.gm_storage_path_is_canonical(name)
          and public.gm_member_can(
            public.gm_storage_company_id(name),
            public.gm_storage_module(name),
            'operate'
          )
        )
    $policy$;

    execute $policy$
      create policy gm_storage_delete on storage.objects
        for delete to authenticated
        using (
          bucket_id = 'gestman-attachments'
          and public.gm_storage_path_is_canonical(name)
          and public.gm_member_can(
            public.gm_storage_company_id(name),
            public.gm_storage_module(name),
            'manage'
          )
        )
    $policy$;
  end if;
end
$$;

revoke all on function public.gm_storage_path_is_canonical(text) from public, anon;
revoke all on function public.gm_storage_company_id(text) from public, anon;
revoke all on function public.gm_storage_module(text) from public, anon;
grant execute on function public.gm_storage_path_is_canonical(text) to authenticated, service_role;
grant execute on function public.gm_storage_company_id(text) to authenticated, service_role;
grant execute on function public.gm_storage_module(text) to authenticated, service_role;

commit;
