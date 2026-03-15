$ErrorActionPreference = "Stop"

$pgBin = "C:\Program Files\PostgreSQL\16\bin"
$dataDir = Join-Path (Resolve-Path (Join-Path $PSScriptRoot "..")).Path "local-pgdata"
$logFile = Join-Path (Resolve-Path (Join-Path $PSScriptRoot "..")).Path "local-pg.log"

if (-not (Test-Path $pgBin)) {
  throw "PostgreSQL 16 binaries were not found at $pgBin"
}

if (-not (Test-Path $dataDir)) {
  & "$pgBin\initdb.exe" -D $dataDir -A trust -U postgres
}

& "$pgBin\pg_ctl.exe" -D $dataDir -l $logFile -o "-p 55432" start

# Create databases if they do not already exist.
& "$pgBin\createdb.exe" -h localhost -p 55432 -U postgres careerpods 2>$null
& "$pgBin\createdb.exe" -h localhost -p 55432 -U postgres careerpods_test 2>$null

Write-Output "Local PostgreSQL is available on localhost:55432"
