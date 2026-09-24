#!/bin/sh
# Restore PostgreSQL from a gzipped dump produced by backup.sh or the admin "Backup database" button.
#
#   ./docker/restore.sh backups/wedding-db-2026-12-05T03-00-00Z.sql.gz
#
# The dump includes DROP statements (--clean), so this REPLACES the current data.
set -e
cd "$(dirname "$0")/.."
# shellcheck disable=SC1091
[ -f .env ] && . ./.env
FILE="$1"
[ -f "${FILE}" ] || { echo "Usage: $0 <backup.sql.gz>"; exit 1; }

printf "This will overwrite the database with %s. Type 'restore' to continue: " "${FILE}"
read -r answer
[ "${answer}" = "restore" ] || { echo "Aborted."; exit 1; }

COMPOSE="docker compose -f docker-compose.prod.yml"
$COMPOSE stop app
gunzip -c "${FILE}" | $COMPOSE exec -T db psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER:-wedding}" -d "${POSTGRES_DB:-wedding}"
$COMPOSE start app
echo "✓ Restore complete."
