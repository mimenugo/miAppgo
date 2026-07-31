# Gastro Suite

PWA y punto de venta para pedidos para llevar y entrega a domicilio. Esta versión usa una API Node.js y MySQL como fuente persistente; ya no depende de colecciones demo en `localStorage`.

## Inicio rápido en Windows

1. Verifica que Laragon esté instalado en `C:\laragon`.
2. Haz doble clic en `iniciar-gastro-suite.bat`.
3. Abre `http://localhost:4174`.

El iniciador levanta MySQL si es necesario, instala las dependencias faltantes, ejecuta las migraciones, inicia la API en `http://localhost:3001` y la PWA en `http://localhost:4174`.

También puede ejecutarse desde PowerShell:

```powershell
PowerShell -ExecutionPolicy Bypass -File .\start-local.ps1
```

Para omitir `npm install` en una sesión posterior:

```powershell
PowerShell -ExecutionPolicy Bypass -File .\start-local.ps1 -SkipInstall
```

## Usuarios iniciales

Todos usan temporalmente la contraseña `Cambio123!`:

| Área | Correo |
|---|---|
| Administración | `admin@gastrosuite.local` |
| Caja | `caja@gastrosuite.local` |
| Cocina | `cocina@gastrosuite.local` |
| Barra | `barra@gastrosuite.local` |
| Repartidor | `repartidor@gastrosuite.local` |

Estas credenciales son solo para pruebas locales y deben reemplazarse antes de publicar un entorno productivo.

## Instalación manual de base de datos

En PowerShell no se admite la redirección `mysql ... < archivo.sql`. Usa el instalador incluido:

```powershell
PowerShell -ExecutionPolicy Bypass -File .\database\mysql\install.ps1
```

El instalador es idempotente: crea el esquema base una sola vez y registra las migraciones aplicadas en `schema_migrations`.

## Desarrollo manual

Terminal 1:

```powershell
cd server
npm.cmd install
npm.cmd run dev
```

Terminal 2:

```powershell
npm.cmd install
npm.cmd run dev -- --port 4174
```

## Arquitectura

- Frontend/PWA: React 19 + Vite.
- API: Node.js + Express, autenticación JWT y autorización por roles.
- Base de datos: MySQL 8 con claves foráneas, auditoría y migraciones versionadas.
- Mapas: Leaflet y OpenStreetMap; navegación externa compatible con Google Maps.
- Persistencia: productos, clientes, pedidos, caja, configuración, cocina y reparto se consultan y actualizan mediante `/api`.

Los archivos locales `server/.env`, credenciales, cargas y respaldos no deben publicarse. Para producción configura un secreto JWT robusto, un usuario MySQL restringido, HTTPS, almacenamiento de archivos y respaldos automáticos.
