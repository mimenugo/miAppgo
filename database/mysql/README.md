# Base de datos de Gastro Suite

Esquema relacional preparado para MySQL 8.0+. Estos archivos son independientes del frontend actual: no cambian su lógica ni conectan todavía la demostración local con MySQL.

## Instalación en Laragon

1. Inicia MySQL desde Laragon.
2. Abre una terminal en `C:\laragon\www\gastro-suite`.
3. En PowerShell, ejecuta el instalador incluido:

```powershell
PowerShell -ExecutionPolicy Bypass -File .\database\mysql\install.ps1
```

Si el usuario `root` tiene contraseña:

```powershell
PowerShell -ExecutionPolicy Bypass -File .\database\mysql\install.ps1 -PromptPassword
```

PowerShell no admite la sintaxis `mysql ... < archivo.sql`; el operador `<` produce `RedirectionNotSupported`. El instalador utiliza internamente el comando `source` de MySQL.

### Ejecución manual desde PowerShell

También puedes ejecutar cada archivo con la ruta completa de MySQL:

```powershell
$mysql = "C:\laragon\bin\mysql\mysql-8.4.3-winx64\bin\mysql.exe"
& $mysql -u root --default-character-set=utf8mb4 --execute="source C:/laragon/www/gastro-suite/database/mysql/001_core.sql"
& $mysql -u root --default-character-set=utf8mb4 --execute="source C:/laragon/www/gastro-suite/database/mysql/002_orders_payments.sql"
& $mysql -u root --default-character-set=utf8mb4 --execute="source C:/laragon/www/gastro-suite/database/mysql/003_operations.sql"
& $mysql -u root --default-character-set=utf8mb4 --execute="source C:/laragon/www/gastro-suite/database/mysql/004_seed_and_procedures.sql"
```

Agrega `-p` después de `root` cuando MySQL solicite contraseña.

## Dominios incluidos

- Negocio, sucursales, zona horaria y horarios.
- Usuarios, sesiones, roles y permisos por sucursal.
- Clientes, direcciones y consentimiento de privacidad.
- Productos, categorías, modificadores, inventario y áreas de preparación múltiples.
- Pedidos, partidas, personalizaciones y bitácora de estados.
- Comandas independientes para cocina, barra, bebidas y despacho.
- Pagos, transferencias, pasarelas, conciliación, eventos y reembolsos.
- Caja, movimientos, arqueos y aperturas de cajón.
- Repartidores, asignaciones, consentimiento y ubicación temporal.
- Impresoras, trabajos pendientes, errores y reimpresión.
- Notificaciones push, WhatsApp, correo y mensajes internos.
- Configuración general, auditoría y recepción idempotente de webhooks.

## Seguridad

- Las contraseñas se guardan únicamente como hash Argon2id o bcrypt.
- No existe ninguna tabla para almacenar números de tarjetas de clientes, CVV o fecha de vencimiento.
- `payment_gateway_configs.secret_reference` guarda solo el identificador de una credencial en una bóveda de secretos; nunca la llave privada.
- Los datos de la cuenta bancaria usan columnas cifradas y columnas `last4` para mostrarlos parcialmente ocultos.
- Los eventos de Stripe, Mercado Pago o PayPal deben verificar firma antes de marcar `signature_verified=1`.
- La API debe validar permisos, sucursal y propiedad del recurso en cada operación.

## Fechas y zona horaria

La conexión del backend debe operar en UTC (`SET time_zone = '+00:00'`). La zona oficial se guarda en `businesses.timezone`, inicialmente `America/Tijuana`. La API convierte las fechas al presentar información, imprimir tickets o calcular horarios programados.

## Reglas transaccionales incluidas

- `sp_change_order_status`: valida transiciones, bloquea el pedido, actualiza el estado y genera historial/auditoría en una transacción.
- `sp_reconcile_payment`: compara el monto esperado contra el recibido y registra `paid` o `difference`, responsable y auditoría.
- `v_order_payment_summary`: vista de conciliación por pedido.

## Siguiente etapa

La API segura incluida en `server/` consume este esquema. La PWA consulta catálogo, clientes, pedidos, operación, caja y configuración mediante `/api`; `localStorage` se conserva únicamente para recordar el área visual elegida, nunca como almacenamiento de información operativa.
