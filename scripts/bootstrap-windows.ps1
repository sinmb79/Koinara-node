$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

Write-Host "Repo root: $repoRoot"
Write-Host "Installing dependencies with npm.cmd to avoid PowerShell execution-policy blocks..."

& npm.cmd install
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host ""
Write-Host "Install complete."
Write-Host "Next steps:"
Write-Host "  npm.cmd run setup"
Write-Host "  npm.cmd run doctor"
