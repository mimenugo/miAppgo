param(
  [string]$User = 'root',
  [switch]$PromptPassword
)

$ErrorActionPreference = 'Stop'
$mysqlExecutable = Get-ChildItem -Path 'C:\laragon\bin\mysql' -Recurse -Filter 'mysql.exe' -ErrorAction SilentlyContinue |
  Sort-Object FullName -Descending |
  Select-Object -First 1 -ExpandProperty FullName

if (-not $mysqlExecutable) {
  throw 'No se encontro mysql.exe dentro de C:\laragon\bin\mysql.'
}

$baseScripts = @(
  '001_core.sql',
  '002_orders_payments.sql',
  '003_operations.sql',
  '004_seed_and_procedures.sql'
)
$incrementalMigrations = @(
  '005_migrate_demo_data.sql',
  '006_pos_business_rules.sql',
  '007_delivery_state_integrity.sql'
)

Write-Host "MySQL: $mysqlExecutable" -ForegroundColor Cyan
Write-Host 'Instalando la base de datos gastro_suite...' -ForegroundColor Cyan
$connectionArguments = @('-u', $User, '--default-character-set=utf8mb4')
if ($PromptPassword) { $connectionArguments += '-p' }

$checkArguments = @($connectionArguments) + @('--batch', '--skip-column-names', "--execute=SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='gastro_suite' AND table_type='BASE TABLE';")
$existingTables = & $mysqlExecutable @checkArguments
if ($LASTEXITCODE -ne 0) {
  throw 'No fue posible conectar con MySQL. Verifica que el servicio este iniciado y que las credenciales sean correctas.'
}
if ([int]$existingTables -eq 0) {
  foreach ($script in $baseScripts) {
    $scriptPath = (Join-Path $PSScriptRoot $script).Replace('\', '/')
    Write-Host "Ejecutando $script..." -ForegroundColor Yellow
    & $mysqlExecutable @connectionArguments "--execute=source $scriptPath"
    if ($LASTEXITCODE -ne 0) { throw "MySQL devolvio un error al ejecutar $script." }
  }
} else {
  Write-Host "Esquema base detectado ($existingTables tablas)." -ForegroundColor Cyan
}

$migrationTableSql = "CREATE TABLE IF NOT EXISTS gastro_suite.schema_migrations (migration VARCHAR(190) PRIMARY KEY, applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)) ENGINE=InnoDB;"
& $mysqlExecutable @connectionArguments "--execute=$migrationTableSql"
if ($LASTEXITCODE -ne 0) { throw 'No fue posible preparar el control de migraciones.' }

foreach ($migration in $incrementalMigrations) {
  $migrationCheckSql = "SELECT COUNT(*) FROM gastro_suite.schema_migrations WHERE migration='$migration';"
  $migrationApplied = & $mysqlExecutable @connectionArguments --batch --skip-column-names "--execute=$migrationCheckSql"
  if ([int]$migrationApplied -eq 0) {
    $migrationPath = (Join-Path $PSScriptRoot $migration).Replace('\', '/')
    Write-Host "Ejecutando $migration..." -ForegroundColor Yellow
    & $mysqlExecutable @connectionArguments "--execute=source $migrationPath"
    if ($LASTEXITCODE -ne 0) { throw "MySQL devolvio un error al ejecutar $migration." }
    & $mysqlExecutable @connectionArguments "--execute=INSERT INTO gastro_suite.schema_migrations(migration) VALUES('$migration');"
    if ($LASTEXITCODE -ne 0) { throw "No fue posible registrar $migration." }
  } else {
    Write-Host "$migration ya fue aplicada." -ForegroundColor Cyan
  }
}

$validationArguments = @($connectionArguments) + @('--batch', '--skip-column-names', "--execute=SELECT CONCAT('Base creada: ', SCHEMA_NAME) FROM information_schema.schemata WHERE schema_name='gastro_suite'; SELECT CONCAT('Tablas: ', COUNT(*)) FROM information_schema.tables WHERE table_schema='gastro_suite' AND table_type='BASE TABLE';")
& $mysqlExecutable @validationArguments
if ($LASTEXITCODE -ne 0) { throw 'La instalacion termino, pero no fue posible ejecutar la validacion final.' }

Write-Host 'Instalacion completada correctamente.' -ForegroundColor Green
