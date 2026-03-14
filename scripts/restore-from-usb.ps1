[CmdletBinding(SupportsShouldProcess)]
param(
    [Parameter(Mandatory)]
    [ValidateScript({ Test-Path $_ })]
    [string]$BackupArchive,

    [string]$RestorePath = "$env:USERPROFILE\.koinara-secrets",

    [SecureString]$BackupPassword
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
        throw "7-Zip was not found. Install 7-Zip before running restore-from-usb.ps1."
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

function Protect-SecretFolder([string]$Path) {
    icacls $Path /inheritance:r | Out-Null
    icacls $Path /grant:r "$env:USERDOMAIN\$env:USERNAME:(OI)(CI)F" "SYSTEM:(OI)(CI)F" "Administrators:(OI)(CI)F" | Out-Null
    cmd /c "attrib +h +s `"$Path`"" | Out-Null
    try {
        cipher /e /s:$Path | Out-Null
    } catch {
        Write-Warn "EFS encryption is not available on this machine."
    }
}

Write-Step "Checking archive and checksum"
$sevenZip = Resolve-7ZipPath
$archiveDir = Split-Path $BackupArchive -Parent
$archiveName = Split-Path $BackupArchive -Leaf
$checksumPath = Join-Path $archiveDir ($archiveName -replace '\.7z$', '.sha256')

if (Test-Path $checksumPath) {
    $expected = ((Get-Content $checksumPath -Raw).Trim().Split()[0]).ToUpperInvariant()
    $actual = (Get-FileHash -Algorithm SHA256 -Path $BackupArchive).Hash.ToUpperInvariant()
    if ($expected -ne $actual) {
        throw "Checksum verification failed for $BackupArchive."
    }
    Write-Ok "Checksum verified"
} else {
    Write-Warn "No checksum file found. Continuing without checksum verification."
}

$plainPassword = if ($BackupPassword) {
    ConvertTo-PlainText $BackupPassword
} else {
    ConvertTo-PlainText (Read-Host -AsSecureString "Enter archive password")
}

& $sevenZip t $BackupArchive "-p$plainPassword" | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw "Archive integrity test failed."
}

if (Test-Path $RestorePath) {
    $backupName = "$RestorePath.bak-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    if ($PSCmdlet.ShouldProcess($RestorePath, "Rename existing secrets folder to $backupName")) {
        Rename-Item -Path $RestorePath -NewName (Split-Path $backupName -Leaf)
    }
}

$tempDir = Join-Path $env:TEMP "koinara-restore-$([guid]::NewGuid().ToString('N'))"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

Write-Step "Extracting archive"
& $sevenZip x $BackupArchive "-p$plainPassword" "-o$tempDir" -y | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw "Archive extraction failed."
}

New-Item -ItemType Directory -Path (Join-Path $RestorePath "wallets") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $RestorePath "backups") -Force | Out-Null

Get-ChildItem -Path $tempDir -Recurse -File | ForEach-Object {
    $destination = if ($_.Extension -eq ".key") {
        Join-Path $RestorePath "wallets"
    } elseif ($_.Extension -in @(".clixml", ".txt")) {
        Join-Path $RestorePath "backups"
    } else {
        $RestorePath
    }

    Move-Item $_.FullName -Destination (Join-Path $destination $_.Name) -Force
}

Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue
$plainPassword = $null

Write-Step "Applying ACL, hidden/system attributes, and EFS"
Protect-SecretFolder $RestorePath
Protect-SecretFolder (Join-Path $RestorePath "backups")

Write-Step "Restored file hashes"
Get-ChildItem -Path $RestorePath -Recurse -File | ForEach-Object {
    $hash = (Get-FileHash -Algorithm SHA256 -Path $_.FullName).Hash
    Write-Host "$hash  $($_.FullName)"
}

Write-Host ""
Write-Ok "Restore complete"
Write-Host "RestorePath: $RestorePath"
Write-Host "Run scripts\\verify-keys.ps1 next if you want to validate the restored key files."
