#!/bin/sh
set -eu

db_host="${DB_HOST:-${MYSQLHOST:-}}"
db_port="${DB_PORT:-${MYSQLPORT:-3306}}"
db_user="${DB_USER:-${MYSQLUSER:-}}"
db_password="${DB_PASSWORD:-${MYSQLPASSWORD:-}}"
db_name="${DB_NAME:-${MYSQLDATABASE:-}}"

missing=""
[ -n "$db_host" ] || missing="$missing MYSQLHOST"
[ -n "$db_user" ] || missing="$missing MYSQLUSER"
[ -n "$db_password" ] || missing="$missing MYSQLPASSWORD"
[ -n "$db_name" ] || missing="$missing MYSQLDATABASE"
if [ -n "$missing" ]; then
  echo "Faltan variables MySQL en el servicio Gastro Suite:$missing" >&2
  echo "Agregalas como referencias del servicio MySQL en Railway > Gastro Suite > Variables." >&2
  exit 1
fi

case "$db_name" in
  *[!A-Za-z0-9_]*) echo "El nombre de la base de datos contiene caracteres no permitidos." >&2; exit 1 ;;
esac

export MYSQL_PWD="$db_password"
mysql_args="--protocol=TCP --host=$db_host --port=$db_port --user=$db_user --default-character-set=utf8mb4"

echo "Pre-Deploy: esperando MySQL en $db_host:$db_port..."
attempt=0
until mysql $mysql_args --execute="SELECT 1" >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 60 ]; then
    echo "No fue posible conectar con MySQL despues de 120 segundos." >&2
    echo "Revisa que las cinco variables MYSQL esten creadas como referencias en el servicio Gastro Suite." >&2
    exit 1
  fi
  sleep 2
done

database_exists="$(mysql $mysql_args --batch --skip-column-names --execute="SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name='$db_name';")"
if [ "$database_exists" = "0" ]; then
  mysql $mysql_args --execute="CREATE DATABASE \`$db_name\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"
fi

run_migration() {
  sed -e '/^CREATE DATABASE IF NOT EXISTS gastro_suite /d' -e "s/^USE gastro_suite;/USE \`$db_name\`;/" "$1" | mysql $mysql_args
}

table_count="$(mysql $mysql_args --batch --skip-column-names --execute="SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$db_name' AND table_type='BASE TABLE';")"
if [ "$table_count" = "0" ]; then
  echo "Pre-Deploy: creando el esquema inicial..."
  for migration in 001_core.sql 002_orders_payments.sql 003_operations.sql 004_seed_and_procedures.sql; do
    echo "Ejecutando $migration"
    run_migration "/app/database/mysql/$migration"
  done
else
  echo "Pre-Deploy: esquema existente detectado ($table_count tablas)."
fi

mysql $mysql_args --execute="CREATE TABLE IF NOT EXISTS \`$db_name\`.schema_migrations (migration VARCHAR(190) PRIMARY KEY, applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)) ENGINE=InnoDB;"
for migration_name in 005_migrate_demo_data.sql 006_pos_business_rules.sql 007_delivery_state_integrity.sql; do
  applied="$(mysql $mysql_args --batch --skip-column-names --execute="SELECT COUNT(*) FROM \`$db_name\`.schema_migrations WHERE migration='$migration_name';")"
  if [ "$applied" = "0" ]; then
    echo "Pre-Deploy: ejecutando $migration_name..."
    run_migration "/app/database/mysql/$migration_name"
    mysql $mysql_args --execute="INSERT INTO \`$db_name\`.schema_migrations(migration) VALUES('$migration_name');"
  fi
done

unset MYSQL_PWD
echo "Pre-Deploy: migraciones terminadas correctamente."
