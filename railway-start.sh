#!/bin/sh
set -eu

echo "Iniciando servidor web en 0.0.0.0:${PORT:-3001}..."
mkdir -p /app/server/uploads
chown -R node:node /app/server/uploads
exec gosu node node server/index.js
