[CmdletBinding()]
param(
  [string]$OutputPath
)

$ErrorActionPreference = "Stop"
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$migrationDirectory = Join-Path $projectRoot "supabase\migrations"

if (-not $OutputPath) {
  $OutputPath = Join-Path $projectRoot "release\supabase\cooperative-records-bootstrap.sql"
}

$outputDirectory = Split-Path -Parent $OutputPath
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null

$header = @"
-- Cooperative Records Supabase bootstrap
-- Generated from supabase/migrations in filename order.
-- Run once in the Supabase SQL Editor for a new project.

begin;
"@

$sections = Get-ChildItem -LiteralPath $migrationDirectory -Filter "*.sql" -File |
  Sort-Object Name |
  ForEach-Object {
    "`n-- ============================================================`n-- $($_.Name)`n-- ============================================================`n`n$((Get-Content -LiteralPath $_.FullName -Raw).Trim())`n"
  }

$content = $header + ($sections -join "") + "`ncommit;`n"
[System.IO.File]::WriteAllText($OutputPath, $content, [System.Text.UTF8Encoding]::new($false))

Write-Host "Created $OutputPath"
