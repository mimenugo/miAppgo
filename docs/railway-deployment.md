# Despliegue de Gastro Suite en Railway

Esta configuración publica la PWA y la API en un único servicio HTTPS y utiliza un servicio MySQL separado dentro del mismo proyecto de Railway.

## 1. Crear MySQL

En el proyecto de Railway:

1. Pulsa **+ New**.
2. Selecciona **Database** y después **MySQL**.
3. Espera hasta que el servicio indique que está activo.

No ejecutes manualmente los archivos SQL. Railway ejecuta `railway-migrate.sh` en la fase Pre-Deploy; las migraciones que ya estén registradas no se repiten. Si falta una referencia MySQL, el despliegue se detendrá en esta fase con el nombre de la variable faltante, antes del healthcheck.

## 2. Configurar el servicio conectado a GitHub

Selecciona el servicio creado desde el repositorio `mimenugo/miAppgo` y confirma:

- Rama temporal: `codex/database-migration`.
- Builder: Railway detectará `railway.json` y usará el `Dockerfile`.
- Health check: `/api/health`.

En **Variables**, agrega referencias a las variables del servicio MySQL. Si el servicio se llama `MySQL`, los valores son:

```text
MYSQLHOST=${{MySQL.MYSQLHOST}}
MYSQLPORT=${{MySQL.MYSQLPORT}}
MYSQLUSER=${{MySQL.MYSQLUSER}}
MYSQLPASSWORD=${{MySQL.MYSQLPASSWORD}}
MYSQLDATABASE=${{MySQL.MYSQLDATABASE}}
JWT_SECRET=coloca-aqui-un-valor-largo-aleatorio
JWT_EXPIRES_IN=8h
STRIPE_TEST_RESTRICTED_KEY=rk_test_...
STRIPE_TEST_WEBHOOK_SECRET=whsec_...
# Agrega estas dos únicamente al activar producción:
STRIPE_LIVE_RESTRICTED_KEY=rk_live_...
STRIPE_LIVE_WEBHOOK_SECRET=whsec_...
```

No copies estas variables a GitHub ni las guardes en archivos del repositorio. Si Railway asignó otro nombre al servicio MySQL, sustituye `MySQL` por ese nombre en las referencias.

En Stripe registra el webhook HTTPS `https://TU-DOMINIO.up.railway.app/api/webhooks/stripe` y habilita el evento `checkout.session.completed`. Conserva primero el ambiente de pruebas en Configuración > Pagos en línea.

## 3. Persistir imágenes

En el servicio de Gastro Suite agrega un volumen con el punto de montaje:

```text
/app/server/uploads
```

Esto evita perder logotipos e imágenes de productos al volver a desplegar. Para varias instancias o mayor volumen conviene migrar después a un bucket compatible con S3.

## 4. Generar el dominio

En **Settings > Networking** pulsa **Generate Domain**. Railway asignará una dirección HTTPS. No es necesario configurar `FRONTEND_ORIGIN` cuando la PWA y la API utilizan ese mismo dominio.

## 5. Validar

Comprueba las siguientes rutas:

```text
https://TU-DOMINIO.railway.app/api/health
https://TU-DOMINIO.railway.app/
```

El endpoint de salud debe responder con `ok: true` y `database` debe mostrar el nombre de la base conectada.

Para comprobar también la conexión con MySQL utiliza:

```text
https://TU-DOMINIO.railway.app/api/readiness
```

Acceso inicial de pruebas:

```text
admin@gastrosuite.local
Cambio123!
```

Cambia las contraseñas iniciales antes de recibir pedidos reales.

## 6. Publicación definitiva

Después de validar la rama temporal:

1. Publica la rama local `codex/pos-business-rules` y crea una solicitud de cambio hacia `main`.
2. Cambia la rama desplegada por Railway a `main`.
3. Activa respaldos del servicio MySQL.
4. Configura alertas de consumo y errores.
5. Conecta el dominio definitivo del restaurante.
