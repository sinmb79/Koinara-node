$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$sourceDir = Join-Path $repoRoot "skills\koinara-node"
$targetRoot = Join-Path $env:USERPROFILE ".openclaw\skills"
$targetDir = Join-Path $targetRoot "koinara-node"

if (-not (Test-Path $sourceDir)) {
  throw "Missing skill source: $sourceDir"
}

New-Item -ItemType Directory -Force -Path $targetRoot | Out-Null
if (Test-Path $targetDir) {
  Remove-Item -Recurse -Force $targetDir
}

Copy-Item -Recurse -Force $sourceDir $targetDir

Write-Host "Installed OpenClaw skill:"
Write-Host "  $targetDir"
Write-Host ""
Write-Host "Restart OpenClaw or reload skills to pick up the new Koinara skill."
