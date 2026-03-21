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
$tsxCliPath = Join-Path $repoRoot "node_modules\tsx\dist\cli.mjs"

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
  $nodeCmd = (Get-Command node.exe -ErrorAction Stop).Source
  if (-not (Test-Path $tsxCliPath)) {
    throw "Missing $tsxCliPath. Run npm install first."
  }

  $startCommand = & $nodeCmd $tsxCliPath scripts/resolve-autostart-command.ts $Role
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($startCommand)) {
    throw "Could not resolve an autostart command for role $Role."
  }

  $startCommand = $startCommand.Trim()
  Write-TraceLine -Path $stdoutLog -Message "[$((Get-Date).ToString('s'))] running npm run $startCommand"
  & $npmCmd run $startCommand 1>> $stdoutLog 2>> $stderrLog
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
