FROM node:22-bookworm-slim AS frontend
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.js ./
COPY public ./public
COPY src ./src
RUN npm run build

FROM node:22-bookworm-slim AS production
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update \
  && apt-get install -y --no-install-recommends default-mysql-client ca-certificates gosu \
  && rm -rf /var/lib/apt/lists/*
COPY server/package.json server/package-lock.json ./server/
RUN npm ci --omit=dev --prefix server
COPY server ./server
COPY database ./database
COPY railway-start.sh ./railway-start.sh
COPY --from=frontend /app/dist ./dist
RUN mkdir -p /app/server/uploads && chown -R node:node /app
EXPOSE 3001
CMD ["sh", "railway-start.sh"]
