# syntax=docker/dockerfile:1.6
#
# Multi-stage build for the wedding platform.
#   target "dev"   — used by docker-compose.yml (hot reload, all dev deps)
#   target "app"   — production Node API (+ SPA shell with OG meta tags)
#   target "nginx" — production reverse proxy serving the static frontend
#
ARG NODE_VERSION=20

# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS base
ENV NPM_CONFIG_UPDATE_NOTIFIER=false NPM_CONFIG_FUND=false NPM_CONFIG_AUDIT=false
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Runtime tools: pg_dump 16 (matches the Postgres 16 server) for backups,
# ffprobe/ffmpeg for video validation + poster frames, tini as PID 1.
FROM base AS runtime-tools
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl gnupg \
 && install -d /usr/share/postgresql-common/pgdg \
 && curl -fsSL -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc \
 && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends postgresql-client-16 ffmpeg tini \
 && apt-get purge -y gnupg && apt-get autoremove -y \
 && rm -rf /var/lib/apt/lists/*

# ---------------------------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci

# ---------------------------------------------------------------------------
# Development image (docker compose up)
FROM runtime-tools AS dev
ENV NODE_ENV=development
# Includes nested workspace node_modules (non-hoisted deps), not just the root.
COPY --from=deps /app /app
COPY . .
RUN npx prisma generate --schema backend/prisma/schema.prisma
EXPOSE 3000 4000
ENTRYPOINT ["/usr/bin/tini", "--"]

# ---------------------------------------------------------------------------
FROM deps AS build
COPY . .
RUN npx prisma generate --schema backend/prisma/schema.prisma \
 && npm run build -w backend \
 && npm run build -w frontend

# ---------------------------------------------------------------------------
# Production API image
FROM runtime-tools AS app
ENV NODE_ENV=production \
    PORT=4000 \
    FRONTEND_DIST=/app/frontend/dist \
    LOCAL_STORAGE_DIR=/data/media
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --omit=dev --workspace backend --include-workspace-root=false \
 && npm cache clean --force
COPY backend/prisma backend/prisma
RUN npx prisma generate --schema backend/prisma/schema.prisma
COPY --from=build /app/backend/dist backend/dist
COPY --from=build /app/frontend/dist frontend/dist
COPY docker/entrypoint.sh docker/entrypoint.sh
RUN mkdir -p /data/media && chown -R node:node /data /app/backend
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/usr/bin/tini", "--", "sh", "/app/docker/entrypoint.sh"]
CMD ["node", "backend/dist/server.js"]

# ---------------------------------------------------------------------------
# Production reverse proxy with the static frontend baked in
FROM nginx:1.27-alpine AS nginx
RUN apk add --no-cache openssl
COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY nginx/templates/ /etc/nginx/templates/
COPY nginx/snippets/ /etc/nginx/snippets/
COPY nginx/10-ensure-cert.sh /docker-entrypoint.d/10-ensure-cert.sh
COPY nginx/40-reload-loop.sh /docker-entrypoint.d/40-reload-loop.sh
RUN chmod +x /docker-entrypoint.d/10-ensure-cert.sh /docker-entrypoint.d/40-reload-loop.sh
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80 443
