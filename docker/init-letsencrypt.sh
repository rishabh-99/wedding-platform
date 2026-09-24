#!/bin/sh
# Obtain the first real Let's Encrypt certificate (run once on the server).
#
#   ./docker/init-letsencrypt.sh
#
# Requires DOMAIN and LETSENCRYPT_EMAIL in .env, DNS pointing at this server,
# and the production stack running (nginx starts with a temporary certificate).
set -e
cd "$(dirname "$0")/.."

[ -f .env ] || { echo "Missing .env"; exit 1; }
# shellcheck disable=SC1091
. ./.env
: "${DOMAIN:?Set DOMAIN in .env}"
: "${LETSENCRYPT_EMAIL:?Set LETSENCRYPT_EMAIL in .env}"

COMPOSE="docker compose -f docker-compose.prod.yml"
DOMAINS="-d ${DOMAIN}"
if [ "${INCLUDE_WWW:-true}" = "true" ]; then DOMAINS="${DOMAINS} -d www.${DOMAIN}"; fi
STAGING_FLAG=""
if [ "${LETSENCRYPT_STAGING:-false}" = "true" ]; then STAGING_FLAG="--staging"; fi

echo "▸ Making sure nginx is running…"
$COMPOSE up -d nginx

echo "▸ Removing the temporary certificate…"
$COMPOSE run --rm --entrypoint "sh -c 'rm -rf /etc/letsencrypt/live/${DOMAIN} /etc/letsencrypt/archive/${DOMAIN} /etc/letsencrypt/renewal/${DOMAIN}.conf'" certbot

echo "▸ Requesting a certificate for ${DOMAIN}…"
$COMPOSE run --rm --entrypoint "certbot certonly --webroot -w /var/www/certbot ${STAGING_FLAG} ${DOMAINS} --email ${LETSENCRYPT_EMAIL} --agree-tos --no-eff-email --rsa-key-size 4096 --non-interactive" certbot

echo "▸ Reloading nginx…"
$COMPOSE exec nginx nginx -s reload
echo "✓ HTTPS is ready: https://${DOMAIN}"
