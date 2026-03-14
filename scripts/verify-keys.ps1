[CmdletBinding()]
param(
    [string]$SecretsPath = "$env:USERPROFILE\.koinara-secrets",
    [string]$ExpectedAddressesPath = "",
    [string]$NodeBin = "node"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Step([string]$Message) { Write-Host "[*] $Message" -ForegroundColor Cyan }
function Write-Ok([string]$Message) { Write-Host "[+] $Message" -ForegroundColor Green }
function Write-Warn([string]$Message) { Write-Host "[!] $Message" -ForegroundColor Yellow }
function Write-Fail([string]$Message) { Write-Host "[-] $Message" -ForegroundColor Red }

$walletDir = Join-Path $SecretsPath "wallets"
if (-not (Test-Path $walletDir)) {
    throw "Wallet directory not found: $walletDir"
}

$keyFiles = Get-ChildItem -Path $walletDir -Filter "*.key" -File
if ($keyFiles.Count -eq 0) {
    throw "No .key files found in $walletDir"
}

Write-Step "Deriving addresses from key files"
$script = @'
const { ethers } = require("ethers");
const fs = require("fs");
const keyPath = process.argv[2];
try {
  const raw = fs.readFileSync(keyPath, "utf8").trim();
  const normalized = raw.startsWith("0x") ? raw : `0x${raw}`;
  const wallet = new ethers.Wallet(normalized);
  process.stdout.write(wallet.address);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
'@

$tempScript = Join-Path $env:TEMP "koinara-derive-address-$([guid]::NewGuid().ToString('N')).cjs"
Set-Content -Path $tempScript -Value $script

$expectedMap = @{}
if ($ExpectedAddressesPath) {
    if (-not (Test-Path $ExpectedAddressesPath)) {
        throw "Expected addresses file not found: $ExpectedAddressesPath"
    }
    $loaded = Get-Content $ExpectedAddressesPath -Raw | ConvertFrom-Json -AsHashtable
    foreach ($key in $loaded.Keys) {
        $expectedMap[$key] = [string]$loaded[$key]
    }
} else {
    Write-Warn "No expected address map supplied. The script will validate key format and print derived addresses only."
}

$allPassed = $true
foreach ($file in $keyFiles) {
    $address = (& $NodeBin $tempScript $file.FullName 2>$null).Trim()
    if (-not $address) {
        Write-Fail "$($file.Name): failed to derive an address"
        $allPassed = $false
        continue
    }

    if ($expectedMap.ContainsKey($file.Name)) {
        if ($address.ToLowerInvariant() -eq $expectedMap[$file.Name].ToLowerInvariant()) {
            Write-Ok "$($file.Name): MATCH ($address)"
        } else {
            Write-Fail "$($file.Name): MISMATCH expected $($expectedMap[$file.Name]) got $address"
            $allPassed = $false
        }
    } else {
        Write-Host "$($file.Name): $address"
    }
}

Remove-Item $tempScript -Force -ErrorAction SilentlyContinue

if (-not $allPassed) {
    exit 1
}
