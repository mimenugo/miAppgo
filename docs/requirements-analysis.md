# Análisis de requerimiento: evolución productiva de Gastro Suite

## Situación actual

La aplicación actual demuestra correctamente los principales recorridos visuales del restaurante y funciona como PWA estática. Los datos operativos se conservan en el navegador, por lo que cada dispositivo mantiene una copia independiente. Esta condición es adecuada para demostración, pero no para operar pedidos reales entre caja, cocina, administración, cliente y repartidor.

La lógica actual no fue modificada. Se agregó únicamente el diseño de la futura base MySQL y la documentación de arquitectura.

## Brecha entre demostración y producción

| Capacidad | Demostración actual | Requerimiento productivo |
|---|---|---|
| Persistencia | `localStorage` por navegador | MySQL central, transacciones y respaldos |
| Usuarios | Cambio de sesión demostrativo | Autenticación, hash de contraseña, sesiones, roles y permisos |
| Pedidos | Estado local | API central, historial, control de concurrencia y tiempo real |
| Cocina/barra | Tableros locales | Comandas por área, cola de impresión y sincronización |
| Pagos | Registro demostrativo | Pasarela, webhooks firmados, idempotencia y conciliación |
| Reparto | Ubicación del dispositivo | Asignación persistente, consentimiento, ubicación temporal y privacidad |
| PWA | Instalable | Caché controlada, push, manejo offline y sincronización segura |
| Operación | Un dispositivo | Sucursales, turnos, zonas, horarios y disponibilidad compartida |
| Auditoría | Limitada | Usuario, fecha, IP, valor anterior/nuevo y folio de solicitud |

## Arquitectura recomendada

- Frontend: conservar React/Vite/PWA y reemplazar gradualmente el almacenamiento local por servicios HTTP.
- Backend recomendado para el entorno existente: Laravel con PHP 8.3, porque Laragon ya proporciona PHP/MySQL y facilita colas, validación, autenticación y tareas programadas. NestJS también es viable si se prefiere TypeScript integral.
- Base de datos: MySQL 8.4 local y MySQL administrado o compatible en producción.
- Tiempo real: WebSockets mediante Laravel Reverb/Pusher, Socket.IO o servicio equivalente.
- Trabajos asíncronos: Redis y workers para notificaciones, webhooks e impresión.
- Mapas: Google Maps o Mapbox para geocodificación/rutas; OpenStreetMap puede conservarse para visualización básica.
- Pagos iniciales en México: Mercado Pago en ambiente de pruebas. Stripe Checkout Sessions o PayPal pueden añadirse detrás del mismo modelo de pagos.
- Impresión: agente local instalado en la red del restaurante que consulte `print_jobs`, imprima y confirme el resultado.

## Reglas funcionales críticas

1. Crear un pedido, sus partidas, pago inicial, historial y comandas dentro de una sola transacción.
2. No marcar un pago en línea como pagado por respuesta del navegador; confirmarlo mediante webhook firmado.
3. No marcar un pedido mixto como listo hasta que todas sus comandas estén en estado `ready`.
4. Exigir control de versión al actualizar pedidos para evitar que dos operadores sobrescriban cambios.
5. Registrar cada cambio de estado en `order_status_history` y cada operación sensible en `audit_logs`.
6. Mantener trabajos de impresión fallidos para reintento y notificar al operador.
7. Guardar ubicaciones solo durante asignaciones activas, con consentimiento y política de retención.
8. Nunca almacenar PAN, CVV o fecha de vencimiento de tarjetas.

## Modelo entregado

El esquema contiene 47 tablas, 89 relaciones foráneas, una vista de conciliación y dos procedimientos transaccionales. Sus grupos principales son:

- Identidad: `users`, `roles`, `permissions`, `user_roles`, `auth_sessions`.
- Clientes: `customers`, `customer_addresses`.
- Catálogo: `categories`, `products`, `modifier_groups`, `modifier_options`, `product_preparation_areas`.
- Pedidos: `orders`, `order_items`, `order_item_modifiers`, `order_status_history`.
- Producción: `preparation_areas`, `production_tickets`, `production_ticket_items`.
- Pagos: `payments`, `payment_events`, `payment_gateway_configs`, `bank_accounts`, `refunds`.
- Reparto: `drivers`, `delivery_assignments`, `driver_locations`, `delivery_zones`.
- Operación: `branches`, `business_hours`, `branch_closures`, `cash_register_shifts`, `cash_movements`.
- Infraestructura: `printers`, `print_jobs`, `notifications`, `push_subscriptions`, `webhook_inbox`.
- Gobierno: `app_settings`, `audit_logs`.

## Fases de implementación

### Fase 1: núcleo seguro

Backend, variables de entorno, migraciones, usuarios, roles, sesiones y API de catálogo. Resultado: administración centralizada y usuarios reales.

### Fase 2: pedidos y producción

Creación transaccional, estados, historial, comandas por área, WebSockets e impresión. Resultado: POS, PWA y cocina comparten los mismos pedidos.

### Fase 3: pagos y caja

Transferencias, conciliación, pasarela de pruebas, webhooks, turnos, movimientos y cortes. Resultado: cobros verificables y reportes consistentes.

### Fase 4: reparto y seguimiento

Zonas, asignaciones, mapa, consentimiento, ubicación temporal y notificaciones. Resultado: operación de última milla y seguimiento del cliente.

### Fase 5: producción y endurecimiento

Respaldos, monitoreo, pruebas de carga, restauración, auditoría, políticas de retención, privacidad y despliegue HTTPS.

## Criterios mínimos de salida a producción

- Pruebas automáticas de autorización y transiciones de estado.
- Webhooks idempotentes y con firma validada.
- Restauración comprobada desde un respaldo.
- Monitoreo y alertas de API, base de datos, colas e impresión.
- HTTPS, secretos fuera del repositorio y ambientes separados.
- Aviso de privacidad y consentimiento de ubicación.
- Prueba completa desde pedido hasta entrega y conciliación.

