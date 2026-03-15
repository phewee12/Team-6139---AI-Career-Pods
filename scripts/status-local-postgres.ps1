$pgBin = "C:\Program Files\PostgreSQL\16\bin"
$dataDir = Join-Path (Resolve-Path (Join-Path $PSScriptRoot "..")).Path "local-pgdata"

if (-not (Test-Path $pgBin) -or -not (Test-Path $dataDir)) {
  Write-Output "Local PostgreSQL cluster not found."
  exit 1
}

& "$pgBin\pg_ctl.exe" -D $dataDir status
