param(
  [string]$User = 'root',
  [switch]$PromptPassword
)

$ErrorActionPreference = 'Stop'
$mysqlExecutable = Get-ChildItem -Path 'C:\laragon\bin\mysql' -Recurse -Filter 'mysql.exe' -ErrorAction SilentlyContinue |
  Sort-Object FullName -Descending |
  Select-Object -First 1 -ExpandProperty FullName

if (-not $mysqlExecutable) {
  throw 'No se encontró mysql.exe dentro de C:\laragon\bin\mysql.'
}

$scripts = @(
  '001_core.sql',
  '002_orders_payments.sql',
  '003_operations.sql',
  '004_seed_and_procedures.sql'
)

Write-Host "MySQL: $mysqlExecutable" -ForegroundColor Cyan
Write-Host 'Instalando la base de datos gastro_suite...' -ForegroundColor Cyan
$connectionArguments = @('-u', $User, '--default-character-set=utf8mb4')
if ($PromptPassword) { $connectionArguments += '-p' }

$checkArguments = @($connectionArguments) + @('--batch', '--skip-column-names', "--execute=SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='gastro_suite' AND table_type='BASE TABLE';")
$existingTables = & $mysqlExecutable @checkArguments
if ($LASTEXITCODE -ne 0) {
  throw 'No fue posible conectar con MySQL. Verifica que el servicio esté iniciado y que las credenciales sean correctas.'
}
if ([int]$existingTables -gt 0) {
  Write-Host "La base gastro_suite ya está instalada ($existingTables tablas). No se realizaron cambios." -ForegroundColor Green
  exit 0
}

foreach ($script in $scripts) {
  $scriptPath = (Join-Path $PSScriptRoot $script).Replace('\', '/')
  $arguments = @($connectionArguments)
  $arguments += "--execute=source $scriptPath"

  Write-Host "Ejecutando $script..." -ForegroundColor Yellow
  & $mysqlExecutable @arguments
  if ($LASTEXITCODE -ne 0) {
    throw "MySQL devolvió un error al ejecutar $script."
  }
}

$validationArguments = @($connectionArguments) + @('--batch', '--skip-column-names', "--execute=SELECT CONCAT('Base creada: ', SCHEMA_NAME) FROM information_schema.schemata WHERE schema_name='gastro_suite'; SELECT CONCAT('Tablas: ', COUNT(*)) FROM information_schema.tables WHERE table_schema='gastro_suite' AND table_type='BASE TABLE';")
& $mysqlExecutable @validationArguments
if ($LASTEXITCODE -ne 0) {
  throw 'La instalación terminó, pero no fue posible ejecutar la validación final.'
}

Write-Host 'Instalación completada correctamente.' -ForegroundColor Green
