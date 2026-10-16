-- Treat equivalent duration numbers (for example 2.0000 and 2) as unchanged.
-- Keep every other protected downtime field and the RPC-only transition guard intact.
do $migration$
declare
  definition text;
  old_ms text := 'coalesce(old_item ->> ''durationMs'', '''') is distinct from coalesce(new_item ->> ''durationMs'', '''')';
  old_hours text := 'coalesce(old_item ->> ''durationHours'', '''') is distinct from coalesce(new_item ->> ''durationHours'', '''')';
  new_ms text := 'nullif(old_item ->> ''durationMs'', '''')::numeric is distinct from nullif(new_item ->> ''durationMs'', '''')::numeric';
  new_hours text := 'nullif(old_item ->> ''durationHours'', '''')::numeric is distinct from nullif(new_item ->> ''durationHours'', '''')::numeric';
begin
  select pg_get_functiondef('public.gm_enforce_asset_downtime_sync()'::regprocedure)
    into definition;
  if position(old_ms in definition) = 0 or position(old_hours in definition) = 0 then
    raise exception 'Expected downtime guard definition was not found; migration not applied';
  end if;
  definition := replace(replace(definition, old_ms, new_ms), old_hours, new_hours);
  execute definition;
end;
$migration$;
