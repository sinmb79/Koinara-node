param()

$ErrorActionPreference = "Stop"

$userId = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$launcherPath = (Resolve-Path (Join-Path $PSScriptRoot "start-background.ps1")).Path

$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -Hidden `
  -ExecutionTimeLimit ([TimeSpan]::Zero) `
  -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Minutes 1)

$principal = New-ScheduledTaskPrincipal -UserId $userId -LogonType Interactive -RunLevel Limited

foreach ($role in @("provider", "verifier")) {
  $taskName = "Koinara $($role.Substring(0, 1).ToUpper() + $role.Substring(1)) Autostart"
  $trigger = New-ScheduledTaskTrigger -AtLogOn -User $userId
  $action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$launcherPath`" $role"

  Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Description "Starts Koinara $role automatically at user logon." `
    -Force | Out-Null
}

Get-ScheduledTask -TaskName "Koinara Provider Autostart", "Koinara Verifier Autostart" |
  Select-Object TaskName, State
