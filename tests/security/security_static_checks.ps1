$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$securityMigrations = @(
    (Join-Path $root 'supabase\migrations\202607220001_security_legacy_hardening.sql'),
    (Join-Path $root 'supabase\migrations\202607220002_security_bootstrap_and_rpc_grants.sql'),
    (Join-Path $root 'supabase\migrations\202607220003_security_storage_policies.sql')
)
$frontendPaths = @('index.html', '404.html', 'src')
$deliveryPaths = @(
    'BOOTSTRAP_COMPANY_SECURITY.md',
    'PASSWORD_COLUMN_REMEDIATION.md',
    'SECURITY_DEPLOYMENT_RUNBOOK.md',
    'SECURITY_REMEDIATION_SCOPE.md',
    'SUPABASE_SECURITY_DEPLOYMENT_PLAN.md',
    'SUPABASE_SECURITY_ROLLBACK.md',
    'supabase/functions/bootstrap-company/index.ts',
    'supabase/functions/submit-company-request/index.ts',
    'supabase/migrations/202607220001_security_legacy_hardening.sql',
    'supabase/migrations/202607220002_security_bootstrap_and_rpc_grants.sql',
    'supabase/migrations/202607220003_security_storage_policies.sql',
    'tests/security/README.md',
    'tests/security/rls.spec.sql',
    'tests/security/rpc.spec.sql',
    'tests/security/security_static_checks.ps1',
    'tests/security/storage.spec.sql'
)

function Fail {
    param([string]$Message)
    Write-Host "FAIL: $Message"
    exit 1
}

function Pass {
    param([string]$Message)
    Write-Host "OK: $Message"
}

function Assert-FilesExist {
    param([string[]]$Paths)
    $missing = $Paths | Where-Object { -not (Test-Path -LiteralPath $_ -PathType Leaf) }
    if ($missing) { Fail ("missing required files: " + ($missing -join ', ')) }
    Pass 'three security migrations exist'
}

function Assert-NotFound {
    param(
        [string]$Label,
        [string[]]$Paths,
        [string]$Pattern
    )
    $matches = $Paths | Select-String -Pattern $Pattern -ErrorAction SilentlyContinue
    if ($matches) {
        Write-Host "FAIL: $Label"
        $matches | ForEach-Object {
            Write-Host ("{0}:{1}: {2}" -f $_.Path, $_.LineNumber, $_.Line.Trim())
        }
        exit 1
    }
    Pass $Label
}

Push-Location $root
try {
    Assert-FilesExist -Paths $securityMigrations

    Assert-NotFound `
        -Label 'no permissive USING/WITH CHECK in security migrations' `
        -Paths $securityMigrations `
        -Pattern '(?i)\bUSING\s*\(\s*true\s*\)|\bWITH\s+CHECK\s*\(\s*true\s*\)'

    Assert-NotFound `
        -Label 'no grants to public in security migrations' `
        -Paths $securityMigrations `
        -Pattern '(?i)\bgrant\b[^;]*\bto\s+public\b'

    Assert-NotFound `
        -Label 'no grants to anon in security migrations' `
        -Paths $securityMigrations `
        -Pattern '(?i)\bgrant\b[^;]*\bto\s+anon\b'

    $frontendChanges = @(
        git diff --name-only HEAD -- @frontendPaths
        git ls-files --others --exclude-standard -- @frontendPaths
    ) | Where-Object { $_ } | Sort-Object -Unique
    $unexpectedFrontendChanges = $frontendChanges |
        Where-Object { $_ -notin @('index.html', '404.html') }
    if ($unexpectedFrontendChanges) {
        Fail ("unexpected frontend files changed: " + ($unexpectedFrontendChanges -join ', '))
    }
    foreach ($frontendFile in @('index.html', '404.html')) {
        $frontendText = Get-Content -LiteralPath (Join-Path $root $frontendFile) -Raw
        if ($frontendText -notmatch 'gmAuthenticatedFunction\("bootstrap-company"') {
            Fail "$frontendFile does not use authenticated bootstrap Edge Function"
        }
        if ($frontendText -match 'gmRpc\("gm_bootstrap_company"') {
            Fail "$frontendFile still calls browser bootstrap RPC directly"
        }
    }
    Pass 'frontend bootstrap contract changed only in index.html and 404.html'

    $deliveryFiles = $deliveryPaths |
        ForEach-Object { Join-Path $root $_ } |
        Where-Object { Test-Path -LiteralPath $_ -PathType Leaf }

    Assert-NotFound `
        -Label 'no credential or access-token literals in delivery files' `
        -Paths $deliveryFiles `
        -Pattern '(?i)(github_pat_|ghp_[A-Za-z0-9]{20,}|eyJhbGciOiJ|sb_secret_|SUPABASE_SERVICE_ROLE_KEY\s*=\s*["''][^"'']+)'

    $unsafeEnv = @(
        git diff --name-only HEAD --
        git ls-files --others --exclude-standard
    ) | Where-Object { $_ -match '(^|/)\.env($|\.)' }
    if ($unsafeEnv) { Fail ("environment file included: " + ($unsafeEnv -join ', ')) }
    Pass 'no environment files included'

    $passwordMigration = Join-Path $root 'supabase\migrations\202607220001_security_legacy_hardening.sql'
    Assert-NotFound `
        -Label 'no legacy password values selected or returned by remediation' `
        -Paths @($passwordMigration) `
        -Pattern '(?i)\bselect\b[^;]*\bsenha\b|\breturning\b[^;]*\bsenha\b'

    $edgePath = Join-Path $root 'supabase\functions\submit-company-request\index.ts'
    $edgeText = Get-Content -LiteralPath $edgePath -Raw
    if ($edgeText -notmatch 'createClient\(SUPABASE_URL,\s*SERVICE_ROLE_KEY') {
        Fail 'public request RPC is not called through a server-side service client'
    }
    if ($edgeText -match 'publicClient\.rpc\("gm_submit_company_request"') {
        Fail 'public request RPC still uses the anonymous client'
    }
    Pass 'service role remains server-side for public request RPC'

    $bootstrapEdgePath = Join-Path $root 'supabase\functions\bootstrap-company\index.ts'
    $bootstrapEdgeText = Get-Content -LiteralPath $bootstrapEdgePath -Raw
    if ($bootstrapEdgeText -notmatch 'service\.auth\.getUser\(token\)') {
        Fail 'bootstrap Edge Function does not validate the Supabase Auth token'
    }
    if ($bootstrapEdgeText -notmatch 'gm_bootstrap_company_server') {
        Fail 'bootstrap Edge Function does not call the service-role-only RPC'
    }
    Pass 'bootstrap service role remains server-side and Auth identity is validated'

    $fourthMigration = Get-ChildItem -Path (Join-Path $root 'supabase\migrations') `
        -Filter '202607220004*.sql' -File -ErrorAction SilentlyContinue
    if ($fourthMigration) { Fail 'unexpected fourth security migration exists' }
    Pass 'fourth migration is correctly absent'

    Pass 'static security checks complete'
}
finally {
    Pop-Location
}
