param()

$ErrorActionPreference = "Stop"

foreach ($taskName in @("Koinara Provider Autostart", "Koinara Verifier Autostart")) {
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
}
