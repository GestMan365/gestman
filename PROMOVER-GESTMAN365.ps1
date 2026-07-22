[CmdletBinding()]
param(
  [ValidateSet("Promote", "Verify", "Rollback")]
  [string]$Action = "Promote",
  [string]$Source = "C:\Users\andsa\Documents\Codex\2026-07-10\apa\GestMan365-Claude",
  [string]$Target = "C:\Users\andsa\Desktop\GestMan365-Claude",
  [string]$Backup = "C:\Users\andsa\Desktop\GestMan365-Claude-backup-20260721"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Resolve-ExistingDirectory([string]$Path, [string]$Label) {
  if (-not (Test-Path -LiteralPath $Path -PathType Container)) {
    throw "$Label nao encontrado: $Path"
  }
  return (Resolve-Path -LiteralPath $Path).Path.TrimEnd("\")
}

function Get-RelativePath([string]$Root, [string]$FullName) {
  return $FullName.Substring($Root.Length + 1).Replace("\", "/")
}

function Get-Hash([string]$Path) {
  return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash
}

function Copy-OneFile([string]$From, [string]$To) {
  $parent = Split-Path -Parent $To
  if (-not (Test-Path -LiteralPath $parent)) {
    New-Item -ItemType Directory -Path $parent -Force | Out-Null
  }
  Copy-Item -LiteralPath $From -Destination $To -Force
}

function Get-BackupFiles([string]$Root) {
  $excludedDirectory = "\\(node_modules|dist|playwright-report|test-results|\.cache|\.vite)(\\|$)"
  return @(Get-ChildItem -LiteralPath $Root -Recurse -File -Force | Where-Object {
    $_.FullName -notmatch $excludedDirectory -and
    $_.Extension -notin @(".webm", ".mp4", ".trace", ".tmp", ".tsbuildinfo") -and
    $_.Name -ne "trace.zip"
  })
}

function Get-PromotionFiles([string]$Root) {
  $relativeFiles = New-Object "System.Collections.Generic.List[string]"
  foreach ($file in @(
    ".env.example", ".gitignore", "package.json", "package-lock.json",
    "playwright.config.ts", "vite.config.ts", "tsconfig.json", "tsconfig.node.json",
    "index.html", "README.md", "ESCOPO.md", "GESTMAN365_ENGINEERING.md",
    "GESTMAN365_PRODUCT_SPEC.md", "GESTMAN365_ROADMAP.md",
    "GESTMAN365_DELIVERY_REPORT.md", "GESTMAN365_CONSOLIDATION_DIFF.md",
    "PROMOVER-GESTMAN365.ps1"
  )) {
    if (Test-Path -LiteralPath (Join-Path $Root $file) -PathType Leaf) {
      $relativeFiles.Add($file.Replace("\", "/"))
    }
  }

  foreach ($directory in @("src", "tests", "scripts", "consolidation")) {
    $directoryPath = Join-Path $Root $directory
    if (Test-Path -LiteralPath $directoryPath -PathType Container) {
      foreach ($file in Get-ChildItem -LiteralPath $directoryPath -Recurse -File -Force) {
        $relativeFiles.Add((Get-RelativePath $Root $file.FullName))
      }
    }
  }
  return @($relativeFiles | Sort-Object -Unique)
}

$sourceRoot = Resolve-ExistingDirectory $Source "Copia validada"
$targetRoot = Resolve-ExistingDirectory $Target "Projeto original"
$backupFull = [IO.Path]::GetFullPath($Backup).TrimEnd("\")

if ($sourceRoot -eq $targetRoot -or $backupFull -eq $targetRoot -or $backupFull -eq $sourceRoot) {
  throw "Source, Target e Backup devem ser diretorios diferentes."
}

$targetEnv = Join-Path $targetRoot ".env"
if (-not (Test-Path -LiteralPath $targetEnv -PathType Leaf)) {
  throw "O .env original nao foi encontrado; promocao interrompida."
}
$targetEnvHashBefore = Get-Hash $targetEnv
$promotionFiles = Get-PromotionFiles $sourceRoot
if ($promotionFiles.Count -eq 0) { throw "Nenhum arquivo elegivel para promocao." }

if ($Action -eq "Promote") {
  if (Test-Path -LiteralPath $backupFull) {
    throw "O backup ja existe e nao sera sobrescrito: $backupFull"
  }

  New-Item -ItemType Directory -Path $backupFull | Out-Null
  $backupFiles = Get-BackupFiles $targetRoot
  $backupBytes = 0L
  $manifest = New-Object "System.Collections.Generic.List[string]"
  $manifest.Add("relative_path`tbytes`tsha256")
  foreach ($file in $backupFiles) {
    $relative = Get-RelativePath $targetRoot $file.FullName
    Copy-OneFile $file.FullName (Join-Path $backupFull $relative)
    $backupBytes += $file.Length
    $manifest.Add("$relative`t$($file.Length)`t$(Get-Hash $file.FullName)")
  }
  [IO.File]::WriteAllLines((Join-Path $backupFull "BACKUP-MANIFEST-SHA256.tsv"), $manifest, [Text.UTF8Encoding]::new($false))

  $copiedBackupFiles = Get-BackupFiles $backupFull | Where-Object { $_.Name -ne "BACKUP-MANIFEST-SHA256.tsv" }
  $copiedBytes = ($copiedBackupFiles | Measure-Object Length -Sum).Sum
  if ($copiedBackupFiles.Count -ne $backupFiles.Count -or $copiedBytes -ne $backupBytes) {
    throw "Contagem ou tamanho do backup divergiu; promocao interrompida."
  }
  foreach ($critical in @(".env", "package.json", "package-lock.json", "vite.config.ts", "index.html")) {
    $originalCritical = Join-Path $targetRoot $critical
    $backupCritical = Join-Path $backupFull $critical
    if ((Test-Path -LiteralPath $originalCritical) -and (Get-Hash $originalCritical) -ne (Get-Hash $backupCritical)) {
      throw "Hash critico divergente no backup: $critical"
    }
  }

  $state = New-Object "System.Collections.Generic.List[string]"
  $state.Add("relative_path`texisted_before`told_sha256`tnew_sha256")
  foreach ($relative in $promotionFiles) {
    $sourceFile = Join-Path $sourceRoot $relative
    $targetFile = Join-Path $targetRoot $relative
    $existed = Test-Path -LiteralPath $targetFile -PathType Leaf
    $oldHash = if ($existed) { Get-Hash $targetFile } else { "-" }
    $newHash = Get-Hash $sourceFile
    $state.Add("$relative`t$existed`t$oldHash`t$newHash")
    Copy-OneFile $sourceFile $targetFile
  }
  [IO.File]::WriteAllLines((Join-Path $backupFull "PROMOTION-STATE.tsv"), $state, [Text.UTF8Encoding]::new($false))

  foreach ($relative in $promotionFiles) {
    if ((Get-Hash (Join-Path $sourceRoot $relative)) -ne (Get-Hash (Join-Path $targetRoot $relative))) {
      throw "Falha na verificacao apos promocao: $relative"
    }
  }
  if ((Get-Hash $targetEnv) -ne $targetEnvHashBefore) {
    throw "O .env original foi alterado; execute rollback imediatamente."
  }
  Write-Output "PROMOTION_OK=True"
  Write-Output "PROMOTED_FILES=$($promotionFiles.Count)"
  Write-Output "BACKUP_FILES=$($backupFiles.Count)"
  Write-Output "BACKUP_BYTES=$backupBytes"
  Write-Output "BACKUP=$backupFull"
}

if ($Action -eq "Verify") {
  $differences = 0
  foreach ($relative in $promotionFiles) {
    $sourceFile = Join-Path $sourceRoot $relative
    $targetFile = Join-Path $targetRoot $relative
    if (-not (Test-Path -LiteralPath $targetFile) -or (Get-Hash $sourceFile) -ne (Get-Hash $targetFile)) {
      $differences++
      Write-Output "DIFFERENCE=$relative"
    }
  }
  if ((Get-Hash $targetEnv) -ne $targetEnvHashBefore) { throw "Hash do .env mudou durante a verificacao." }
  Write-Output "VERIFY_DIFFERENCES=$differences"
  if ($differences -ne 0) { exit 2 }
}

if ($Action -eq "Rollback") {
  $backupRoot = Resolve-ExistingDirectory $backupFull "Backup"
  $stateFile = Join-Path $backupRoot "PROMOTION-STATE.tsv"
  if (-not (Test-Path -LiteralPath $stateFile -PathType Leaf)) {
    throw "Estado da promocao nao encontrado no backup."
  }
  $rows = Import-Csv -LiteralPath $stateFile -Delimiter "`t"
  foreach ($row in $rows) {
    $relative = $row.relative_path
    $targetFile = Join-Path $targetRoot $relative
    $backupFile = Join-Path $backupRoot $relative
    if ($row.existed_before -eq "True") {
      Copy-OneFile $backupFile $targetFile
    } elseif (Test-Path -LiteralPath $targetFile -PathType Leaf) {
      $resolvedTargetFile = [IO.Path]::GetFullPath($targetFile)
      if (-not $resolvedTargetFile.StartsWith($targetRoot + "\", [StringComparison]::OrdinalIgnoreCase)) {
        throw "Caminho de rollback fora do projeto: $relative"
      }
      Remove-Item -LiteralPath $resolvedTargetFile -Force
    }
  }
  $backupEnv = Join-Path $backupRoot ".env"
  if ((Get-Hash $targetEnv) -ne (Get-Hash $backupEnv)) {
    Copy-OneFile $backupEnv $targetEnv
  }
  Write-Output "ROLLBACK_OK=True"
  Write-Output "ROLLBACK_FILES=$($rows.Count)"
}
