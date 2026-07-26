-- Local-only Storage security specification.
-- Prerequisites: pgTAP, isolated bucket fixtures and two fictitious tenants.

-- Expected: the private attachment bucket exists.
select ok(
  exists(
    select 1
    from storage.buckets
    where id = 'gestman-attachments'
      and public = false
  ),
  'gestman-attachments private bucket exists'
);

-- Expected: update/delete policies rely on module-scoped membership checks.
select ok(
  exists(
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'gm_storage_update'
  ),
  'gm_storage_update policy is prepared'
);
