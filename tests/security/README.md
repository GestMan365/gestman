# Security checks

This folder contains local-only validation helpers for the Supabase security remediation.

The static PowerShell check focuses on:

1. legacy permissive policies;
2. open grants to `public` and `anon`;
3. `service_role` references in the frontend;
4. absence of frontend changes in this security-only delivery;
5. absence of credential, token and `.env` files;
6. no SELECT/RETURNING of legacy password values;
7. server-side use of `service_role` for the public request RPC;
8. accidental introduction of a fourth migration without confirmed dependencies.

Run locally:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass `
  -File ".\tests\security\security_static_checks.ps1"
```

The SQL files are pgTAP specifications only. They were not executed because this workspace
does not have an isolated Supabase/PostgreSQL test environment. They must never be pointed at
production.
