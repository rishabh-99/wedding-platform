#!/bin/sh
# Nightly PostgreSQL backup (run from the EC2 host's cron).
#
#   0 3 * * *  /home/ubuntu/wedding-platform/docker/backup.sh >> /var/log/wedding-backup.log 2>&1
#
# Writes a gzipped dump to ./backups and, if BACKUP_S3_URI is set in .env
# (e.g. s3://my-wedding-backups/db), copies it to S3 with the AWS CLI.
# Keeps the last $BACKUP_KEEP_DAYS days locally.
set -e
cd "$(dirname "$0")/.."
# shellcheck disable=SC1091
[ -f .env ] && . ./.env

STAMP=$(date -u +%Y-%m-%dT%H-%M-%SZ)
mkdir -p backups
FILE="backups/wedding-db-${STAMP}.sql.gz"

docker compose -f docker-compose.prod.yml exec -T db \
  pg_dump -U "${POSTGRES_USER:-wedding}" -d "${POSTGRES_DB:-wedding}" --no-owner --no-privileges --clean --if-exists \
  | gzip -9 > "${FILE}"

SIZE=$(wc -c < "${FILE}")
if [ "${SIZE}" -lt 1000 ]; then
  echo "✗ Backup looks too small (${SIZE} bytes) — check the database" >&2
  exit 1
fi
echo "✓ ${FILE} (${SIZE} bytes)"

if [ -n "${BACKUP_S3_URI}" ]; then
  aws s3 cp "${FILE}" "${BACKUP_S3_URI}/$(basename "${FILE}")" --storage-class STANDARD_IA
  echo "✓ uploaded to ${BACKUP_S3_URI}"
fi

find backups -name 'wedding-db-*.sql.gz' -mtime +"${BACKUP_KEEP_DAYS:-30}" -delete
