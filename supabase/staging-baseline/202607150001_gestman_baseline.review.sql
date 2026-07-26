-- REVIEW ONLY - DO NOT MOVE TO supabase/migrations OR APPLY.
--
-- This is the review scaffold for the missing GestMan365 baseline migration.
-- It intentionally contains no CREATE TABLE/FUNCTION/POLICY statements because
-- the repository snapshot does not include authoritative definitions for all
-- required columns, constraints, indexes, triggers and helper functions.
--
-- Required reconstruction order:
--   1. extensions and exact application tables;
--   2. primary keys, foreign keys, checks and indexes;
--   3. tenant/auth helper functions with safe search_path;
--   4. base RLS and grants;
--   5. tenant-state and administration RPCs;
--   6. private Storage bucket and path helpers;
--   7. Edge Functions;
--   8. onboarding migrations from 202607160004 onward;
--   9. security hardening migrations 202607220001 through 202607220003.
--
-- Core objects known to be prerequisites:
--   public.gm_companies
--   public.gm_profiles
--   public.gm_company_members
--   public.gm_tenant_state
--   public.gm_user_preferences
--   public.gm_audit_log
--   public.gm_set_updated_at()
--   public.gm_is_company_member(uuid)
--   public.gm_is_company_admin(uuid)
--   public.gm_member_can(uuid,text,text)
--   public.gm_storage_company_id(text)
--   public.gm_storage_module(text)
--
-- Operational and legacy tables listed in snapshot-current/003_tables.sql also
-- require their exact DDL. Catalog comments are not sufficient to reconstruct
-- them safely.
--
-- Fail closed if this review file is executed accidentally.
begin;

do $review_only$
begin
  raise exception
    'GM_BASELINE_REVIEW_ONLY: authoritative schema definitions are required';
end
$review_only$;

rollback;
