-- Public tenant branding used before authentication.
-- Exposes only the minimum fields required to render a company-specific login.

create or replace function public.gm_public_company_brand(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_slug text := lower(trim(coalesce(p_slug, '')));
  v_company record;
  v_state jsonb := '{}'::jsonb;
begin
  if v_slug !~ '^[a-z0-9][a-z0-9-]{1,62}$' then
    return null;
  end if;

  select c.id, c.slug, c.name
    into v_company
  from public.gm_companies c
  where c.slug = v_slug
    and c.status in ('active', 'trial')
  limit 1;

  if not found then
    return null;
  end if;

  select coalesce(t.state, '{}'::jsonb)
    into v_state
  from public.gm_tenant_state t
  where t.company_id = v_company.id
  limit 1;

  return jsonb_build_object(
    'slug', v_company.slug,
    'name', left(trim(v_company.name), 160),
    'logo_url', coalesce(
      nullif(v_state #>> '{companyBrand,companyLogo}', ''),
      nullif(v_state #>> '{profile,companyLogo}', ''),
      ''
    )
  );
end;
$$;

revoke all on function public.gm_public_company_brand(text) from public;
grant execute on function public.gm_public_company_brand(text) to anon, authenticated, service_role;

comment on function public.gm_public_company_brand(text) is
  'Returns the public name, slug and tenant logo for an active company login route.';
