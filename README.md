# Fuego — Restaurante & Delivery PWA

MVP funcional para un restaurante con cuatro experiencias conectadas:

- **Cliente:** catálogo, filtros, carrito, datos de entrega y pago en efectivo o tarjeta.
- **Administrador:** nueva venta en caja, pedidos, producción, reparto, productos, clientes y reportes.
- **Producción:** recepción de comandas y avance de `Nuevo` a `En cocina` y `Listo`.
- **Repartidor:** pedidos asignados, contacto, navegación, cobro en efectivo y confirmación de entrega.

El estado se conserva en `localStorage`, por lo que las operaciones permanecen al recargar y se reflejan entre módulos en la misma instalación.

## Ejecutar

```bash
npm install
npm run dev
```

La aplicación se abre en `http://localhost:4174`.

## PWA

Incluye `manifest.webmanifest`, icono instalable y service worker con caché del shell. El service worker se registra en compilaciones de producción:

```bash
npm run build
npm run preview
```

## Arquitectura recomendada para producción

Este repositorio contiene un MVP operativo local. Para llevarlo a producción:

- API: Node.js con NestJS o Fastify.
- Base de datos: PostgreSQL + Prisma.
- Autenticación: JWT corto + refresh token seguro.
- Autorización: RBAC (`ADMIN`, `PRODUCTION`, `CUSTOMER`, `DRIVER`).
- Tiempo real: Socket.IO para estados de cocina y reparto.
- Mapas: Google Maps Platform o Mapbox.
- Pagos: Stripe Checkout/Payment Element.
- Archivos: almacenamiento compatible con S3.
- Notificaciones: Web Push y Firebase Cloud Messaging.

Los roles deben validarse siempre en el servidor; ocultar pantallas en React no constituye autorización.
