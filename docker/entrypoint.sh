#!/bin/sh
# Container start-up: apply migrations, seed an empty database, then start the app.
set -e

cd /app/backend

if [ "${NODE_ENV:-development}" != "production" ]; then
  # The schema is bind-mounted in development — keep the Prisma client in sync with it.
  npx --no-install prisma generate --schema prisma/schema.prisma >/dev/null
fi

echo "▸ Applying database migrations…"
attempt=1
until npx --no-install prisma migrate deploy --schema prisma/schema.prisma; do
  if [ "$attempt" -ge 20 ]; then
    echo "✗ Could not apply migrations after $attempt attempts — is the database reachable?" >&2
    exit 1
  fi
  attempt=$((attempt + 1))
  echo "  database not ready yet, retrying in 3s ($attempt/20)…"
  sleep 3
done

if [ "${SEED_ON_EMPTY:-true}" != "false" ]; then
  echo "▸ Seeding (skipped automatically if data already exists)…"
  if [ -f dist/seed.js ]; then
    node dist/seed.js
  else
    npx --no-install tsx prisma/seed.ts
  fi
fi

cd /app
echo "▸ Starting: $*"
exec "$@"
