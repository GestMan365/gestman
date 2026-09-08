begin;

-- Forward-only data repair. Never replay the superseded 202607190001.
-- Only missing membership usernames are changed. Existing updated_at triggers
-- remain enabled; all other membership fields are checked after the update.
set local statement_timeout = '30s';
set local lock_timeout = '3s';

do $backfill$
declare
  v_member record;
  v_candidate text;
  v_expected bigint;
  v_changed bigint;
begin
  -- Refuse concurrent membership writers instead of using a stale predicate.
  -- This short, migration-only lock also protects the per-company uniqueness
  -- preflight against new memberships until the transaction commits.
  lock table public.gm_company_members in share row exclusive mode nowait;

  if to_regclass('public.gm_company_members_company_username_uidx') is null then
    raise exception 'GM_USERNAME_BACKFILL_UNIQUE_INDEX_REQUIRED' using errcode = '23514';
  end if;

  create temporary table gm_missing_username_candidates (
    company_id uuid not null,
    user_id uuid not null,
    candidate text not null,
    protected_before jsonb not null,
    primary key (company_id, user_id)
  ) on commit drop;

  for v_member in
    select m.company_id, m.user_id,
           to_jsonb(m) - 'access_username' - 'updated_at' as protected_before
    from public.gm_company_members m
    where m.access_username is null or trim(m.access_username) = ''
    order by m.company_id, m.user_id
  loop
    if v_member.company_id is null or v_member.user_id is null then
      raise exception 'GM_USERNAME_BACKFILL_INVALID_MEMBERSHIP' using errcode = '23514';
    end if;

    perform 1 from public.gm_companies c
    where c.id = v_member.company_id
    for key share nowait;
    if not found then
      raise exception 'GM_USERNAME_BACKFILL_INVALID_MEMBERSHIP' using errcode = '23514';
    end if;

    -- Exact historical candidate precedence, with the hardened 202607280002
    -- identifier validation. Metadata never determines tenant or privileges.
    select coalesce(
      nullif(u.raw_user_meta_data->>'access_username', ''),
      split_part(u.email, '.', 1)
    ) into v_candidate
    from auth.users u
    where u.id = v_member.user_id
    for share nowait;
    if not found then
      raise exception 'GM_USERNAME_BACKFILL_AUTH_USER_MISSING' using errcode = '23503';
    end if;
    if v_candidate is null or trim(v_candidate) = '' then
      raise exception 'GM_USERNAME_BACKFILL_SOURCE_MISSING' using errcode = '23514';
    end if;
    if v_candidate !~ '^[a-z0-9][a-z0-9._-]{1,47}$' then
      raise exception 'GM_USERNAME_BACKFILL_INVALID_USERNAME' using errcode = '23514';
    end if;

    insert into pg_temp.gm_missing_username_candidates
      (company_id, user_id, candidate, protected_before)
    values (v_member.company_id, v_member.user_id, v_candidate, v_member.protected_before);
  end loop;

  if exists (
    select 1 from pg_temp.gm_missing_username_candidates c
    group by c.company_id, lower(c.candidate)
    having count(*) > 1
  ) or exists (
    select 1
    from pg_temp.gm_missing_username_candidates c
    join public.gm_company_members m
      on m.company_id = c.company_id
     and lower(m.access_username) = lower(c.candidate)
    where m.user_id <> c.user_id
  ) then
    raise exception 'GM_USERNAME_BACKFILL_COLLISION' using errcode = '23505';
  end if;

  select count(*) into v_expected from pg_temp.gm_missing_username_candidates;

  update public.gm_company_members m
  set access_username = c.candidate
  from pg_temp.gm_missing_username_candidates c
  where m.company_id = c.company_id
    and m.user_id = c.user_id
    and (m.access_username is null or trim(m.access_username) = '')
    and to_jsonb(m) - 'access_username' - 'updated_at' = c.protected_before;
  get diagnostics v_changed = row_count;

  if v_changed <> v_expected then
    raise exception 'GM_USERNAME_BACKFILL_CONCURRENT_CHANGE' using errcode = '40001';
  end if;
  if exists (
    select 1
    from pg_temp.gm_missing_username_candidates c
    join public.gm_company_members m
      on m.company_id = c.company_id and m.user_id = c.user_id
    where to_jsonb(m) - 'access_username' - 'updated_at' <> c.protected_before
       or m.access_username is distinct from c.candidate
  ) then
    raise exception 'GM_USERNAME_BACKFILL_PROTECTED_FIELD_CHANGED' using errcode = '23514';
  end if;
  if exists (
    select 1 from public.gm_company_members m
    where m.access_username is null or trim(m.access_username) = ''
  ) then
    raise exception 'GM_USERNAME_BACKFILL_INCOMPLETE' using errcode = '23514';
  end if;
exception
  when unique_violation then
    -- Do not expose PostgreSQL's duplicate-key detail (it contains usernames).
    raise exception 'GM_USERNAME_BACKFILL_COLLISION' using errcode = '23505';
  when lock_not_available then
    raise exception 'GM_USERNAME_BACKFILL_CONCURRENT_CHANGE' using errcode = '55P03';
end;
$backfill$;

commit;
