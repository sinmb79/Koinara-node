[CmdletBinding(SupportsShouldProcess)]
param(
    [Parameter(Mandatory)]
    [ValidatePattern('^[A-Z]:$')]
    [string]$UsbDriveLetter,

    [string]$SecretsPath = "$env:USERPROFILE\.koinara-secrets",

    [string]$ManifestDir = "",

    [SecureString]$BackupPassword,

    [switch]$SkipManifests
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Step([string]$Message) { Write-Host "[*] $Message" -ForegroundColor Cyan }
function Write-Ok([string]$Message) { Write-Host "[+] $Message" -ForegroundColor Green }
function Write-Warn([string]$Message) { Write-Host "[!] $Message" -ForegroundColor Yellow }

function Resolve-7ZipPath {
    $candidates = @(
        (Get-Command 7z -ErrorAction SilentlyContinue).Source,
        "$env:ProgramFiles\7-Zip\7z.exe",
        "${env:ProgramFiles(x86)}\7-Zip\7z.exe"
    ) | Where-Object { $_ -and (Test-Path $_) }

    if (-not $candidates) {
        throw "7-Zip was not found. Install 7-Zip before running backup-to-usb.ps1."
    }

    return $candidates[0]
}

function ConvertTo-PlainText([SecureString]$SecureValue) {
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureValue)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
}

Write-Step "Checking prerequisites"
$sevenZip = Resolve-7ZipPath
if (-not (Test-Path $SecretsPath)) {
    throw "Secrets path not found: $SecretsPath"
}

$drive = Get-Volume -DriveLetter ($UsbDriveLetter.TrimEnd(':')) -ErrorAction SilentlyContinue
if (-not $drive) {
    throw "Drive $UsbDriveLetter was not found."
}

$walletFiles = Get-ChildItem -Path (Join-Path $SecretsPath "wallets") -Filter "*.key" -File -ErrorAction SilentlyContinue
$backupFiles = Get-ChildItem -Path (Join-Path $SecretsPath "backups") -File -ErrorAction SilentlyContinue
if (($walletFiles.Count + $backupFiles.Count) -eq 0) {
    throw "No secret material found under $SecretsPath."
}

$plainPassword = if ($BackupPassword) {
    ConvertTo-PlainText $BackupPassword
} else {
    ConvertTo-PlainText (Read-Host -AsSecureString "Enter archive password")
}

if ([string]::IsNullOrWhiteSpace($plainPassword) -or $plainPassword.Length -lt 12) {
    throw "Archive password must be at least 12 characters."
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$targetDir = Join-Path $UsbDriveLetter "koinara-backup-$timestamp"
$archivePath = Join-Path $targetDir "koinara-secrets-$timestamp.7z"
$checksumPath = Join-Path $targetDir "koinara-secrets-$timestamp.sha256"
$metadataPath = Join-Path $targetDir "backup-metadata.json"

if ($PSCmdlet.ShouldProcess($targetDir, "Create backup folder")) {
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
}

$fileListPath = Join-Path $env:TEMP "koinara-backup-files-$timestamp.txt"
@($walletFiles.FullName + $backupFiles.FullName) | Set-Content -Path $fileListPath

Write-Step "Creating encrypted archive"
if ($PSCmdlet.ShouldProcess($archivePath, "Write encrypted 7z archive")) {
    & $sevenZip a "-p$plainPassword" -mhe=on -mx=9 -t7z $archivePath "@$fileListPath" | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "7-Zip failed while creating the backup archive."
    }
}

Write-Step "Verifying archive integrity"
& $sevenZip t $archivePath "-p$plainPassword" | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw "Archive integrity test failed."
}

$hash = (Get-FileHash -Algorithm SHA256 -Path $archivePath).Hash
"$hash  $(Split-Path $archivePath -Leaf)" | Set-Content -Path $checksumPath

if (-not $SkipManifests) {
    $resolvedManifestDir = $ManifestDir
    if (-not $resolvedManifestDir) {
        $resolvedManifestDir = Join-Path (Split-Path $PSScriptRoot -Parent) "..\base\deployments"
    }
    $resolvedManifestDir = [System.IO.Path]::GetFullPath($resolvedManifestDir)

    if (Test-Path $resolvedManifestDir) {
        Write-Step "Copying deployment manifests"
        $manifestTarget = Join-Path $targetDir "manifests"
        New-Item -ItemType Directory -Path $manifestTarget -Force | Out-Null
        Get-ChildItem -Path $resolvedManifestDir -Filter "*.json" -File | ForEach-Object {
            Copy-Item $_.FullName -Destination (Join-Path $manifestTarget $_.Name) -Force
        }
    } else {
        Write-Warn "Manifest directory not found, skipping manifest backup: $resolvedManifestDir"
    }
}

$metadata = [pscustomobject]@{
    timestamp = $timestamp
    sourceHost = $env:COMPUTERNAME
    sourceUser = $env:USERNAME
    archive = (Split-Path $archivePath -Leaf)
    sha256 = $hash
    walletFileCount = $walletFiles.Count
    backupFileCount = $backupFiles.Count
}
$metadata | ConvertTo-Json -Depth 3 | Set-Content -Path $metadataPath

Remove-Item $fileListPath -Force -ErrorAction SilentlyContinue
$plainPassword = $null

Write-Host ""
Write-Ok "Backup complete"
Write-Host "Location : $targetDir"
Write-Host "Archive  : $archivePath"
Write-Host "SHA-256  : $hash"
Write-Host ""
Write-Host "Next:"
Write-Host "1. Safely eject the USB drive."
Write-Host "2. Store the USB in a physically separate location."
Write-Host "3. Test recovery with scripts\\restore-from-usb.ps1."
