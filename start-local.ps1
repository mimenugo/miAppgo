param([switch]$SkipInstall)

$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
$mysqlRoot = Get-ChildItem 'C:\laragon\bin\mysql' -Directory | Sort-Object Name -Descending | Select-Object -First 1
$mysqlServer = Join-Path $mysqlRoot.FullName 'bin\mysqld.exe'
$mysqlConfig = Join-Path $mysqlRoot.FullName 'my.ini'

function Test-LocalPort([int]$Port) {
  return $null -ne (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
}

Write-Host 'Gastro Suite - inicio local' -ForegroundColor Cyan

if (-not (Test-LocalPort 3306)) {
  if (-not (Test-Path $mysqlServer)) { throw 'No se encontró mysqld.exe en C:\laragon\bin\mysql.' }
  Write-Host 'Iniciando MySQL de Laragon...' -ForegroundColor Yellow
  Start-Process -FilePath $mysqlServer -ArgumentList "--defaults-file=$mysqlConfig" -WindowStyle Hidden
  for ($attempt = 0; $attempt -lt 20 -and -not (Test-LocalPort 3306); $attempt++) { Start-Sleep -Milliseconds 500 }
  if (-not (Test-LocalPort 3306)) { throw 'MySQL no inició. Abre Laragon, inicia MySQL y vuelve a ejecutar este archivo.' }
} else {
  Write-Host 'MySQL ya está activo.' -ForegroundColor DarkGreen
}

if (-not $SkipInstall) {
  if (-not (Test-Path (Join-Path $projectRoot 'node_modules'))) {
    Write-Host 'Instalando dependencias del frontend...' -ForegroundColor Yellow
    & npm.cmd install --prefix $projectRoot
  }
  if (-not (Test-Path (Join-Path $projectRoot 'server\node_modules'))) {
    Write-Host 'Instalando dependencias del backend...' -ForegroundColor Yellow
    & npm.cmd install --prefix (Join-Path $projectRoot 'server')
  }
}

$serverEnv = Join-Path $projectRoot 'server\.env'
if (-not (Test-Path $serverEnv)) {
  Copy-Item (Join-Path $projectRoot 'server\.env.example') $serverEnv
  Write-Host 'Se creó server\.env con valores locales. Revísalo antes de usar producción.' -ForegroundColor Yellow
}

& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $projectRoot 'database\mysql\install.ps1')

if (-not (Test-LocalPort 3001)) {
  Write-Host 'Iniciando API en http://localhost:3001 ...' -ForegroundColor Yellow
  Start-Process -FilePath node.exe -ArgumentList 'index.js' -WorkingDirectory (Join-Path $projectRoot 'server') -WindowStyle Hidden
}
if (-not (Test-LocalPort 4174)) {
  Write-Host 'Iniciando PWA en http://localhost:4174 ...' -ForegroundColor Yellow
  Start-Process -FilePath npm.cmd -ArgumentList 'run','dev','--','--host','0.0.0.0','--port','4174' -WorkingDirectory $projectRoot -WindowStyle Hidden
}

for ($attempt = 0; $attempt -lt 20 -and (-not (Test-LocalPort 3001) -or -not (Test-LocalPort 4174)); $attempt++) { Start-Sleep -Milliseconds 500 }
if (-not (Test-LocalPort 3001)) { throw 'La API no pudo iniciar en el puerto 3001.' }
if (-not (Test-LocalPort 4174)) { throw 'La PWA no pudo iniciar en el puerto 4174.' }

Write-Host ''
Write-Host 'Sistema listo: http://localhost:4174' -ForegroundColor Green
Write-Host 'API:           http://localhost:3001/api/health' -ForegroundColor Green
Write-Host 'Acceso inicial: admin@gastrosuite.local / Cambio123!' -ForegroundColor Cyan
