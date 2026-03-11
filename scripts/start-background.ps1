param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("provider", "verifier")]
  [string]$Role
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$runDir = Join-Path $repoRoot ".koinara-node\$Role"
$stdoutLog = Join-Path $runDir "$Role.stdout.log"
$stderrLog = Join-Path $runDir "$Role.stderr.log"
$pidFile = Join-Path $runDir "$Role.pid"

New-Item -ItemType Directory -Force -Path $runDir | Out-Null

function Write-TraceLine {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [Parameter(Mandatory = $true)]
    [string]$Message
  )

  try {
    Add-Content -Path $Path -Value $Message
  } catch {
    # Another long-running process may already own the log file.
  }
}

if (Test-Path $pidFile) {
  $existingPid = (Get-Content $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1).Trim()
  if ($existingPid -and (Get-Process -Id $existingPid -ErrorAction SilentlyContinue)) {
    Write-TraceLine -Path $stdoutLog -Message "[$((Get-Date).ToString('s'))] $Role already running with PID $existingPid"
    exit 0
  }
}

Set-Content -Path $pidFile -Value $PID -Encoding ascii
Write-TraceLine -Path $stdoutLog -Message "[$((Get-Date).ToString('s'))] starting $Role background loop"

try {
  Push-Location $repoRoot
  $npmCmd = (Get-Command npm.cmd -ErrorAction Stop).Source
  & $npmCmd run "$Role`:start" 1>> $stdoutLog 2>> $stderrLog
  exit $LASTEXITCODE
} finally {
  Pop-Location

  if (Test-Path $pidFile) {
    $currentPid = (Get-Content $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1).Trim()
    if ($currentPid -eq [string]$PID) {
      Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
    }
  }
}
