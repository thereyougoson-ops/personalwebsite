param(
  [string]$WebAppPath = "C:\Users\ptoul\Downloads\sokoloff\base44clone\web-app",
  [string]$RenameMapPath = "C:\Users\ptoul\Downloads\sokoloff\base44clone\web-app\docs\rename-map.json"
)
$ErrorActionPreference = "Stop"
if (-not (Test-Path -LiteralPath $RenameMapPath)) {
  throw "Missing rename map: $RenameMapPath"
}
$map = Get-Content -LiteralPath $RenameMapPath -Raw | ConvertFrom-Json
foreach ($entry in $map.PSObject.Properties) {
  $old = $entry.Name
  $new = [string]$entry.Value
  if ($old -eq $new) { continue }
  $oldPath = Join-Path $WebAppPath $old
  if (Test-Path -LiteralPath $oldPath) {
    Remove-Item -LiteralPath $oldPath -Force
  }
}
Write-Output "Removed legacy alias paths where old != new."


