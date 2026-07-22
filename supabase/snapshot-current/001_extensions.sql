-- GestMan365 Supabase snapshot — reference only, captured 2026-07-22.
-- Schema-only. No customer data. Do not apply directly to production.

CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

-- plpgsql 1.0 is installed in pg_catalog by PostgreSQL.
-- Remote versions: pg_stat_statements 1.11, pgcrypto 1.3,
-- uuid-ossp 1.1, supabase_vault 0.3.1.

