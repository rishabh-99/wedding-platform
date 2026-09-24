#!/bin/sh
# Obtain the first real Let's Encrypt certificate (run once on the server).
#
#   ./docker/init-letsencrypt.sh
#
# Requires DOMAIN in .env, DNS pointing at this server, and the production stack running
# (nginx starts with a temporary certificate). LETSENCRYPT_EMAIL is optional: without it the
# certificate still works and renews automatically; you just won't get expiry-warning emails.
set -e
cd "$(dirname "$0")/.."

[ -f .env ] || { echo "Missing .env"; exit 1; }
# Read one KEY from .env without executing the file as shell code
# (values such as `EMAIL_FROM=Wedding <no-reply@…>` would otherwise break the script).
env_get() { grep -E "^$1=" .env 2>/dev/null | tail -n 1 | cut -d= -f2- | tr -d '\r' | sed -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'$/\1/"; }
DOMAIN="$(env_get DOMAIN)"
LETSENCRYPT_EMAIL="$(env_get LETSENCRYPT_EMAIL)"
INCLUDE_WWW="$(env_get INCLUDE_WWW)"
LETSENCRYPT_STAGING="$(env_get LETSENCRYPT_STAGING)"
: "${DOMAIN:?Set DOMAIN in .env}"

if [ -n "${LETSENCRYPT_EMAIL}" ]; then
  EMAIL_ARG="--email ${LETSENCRYPT_EMAIL} --no-eff-email"
else
  echo "▸ No LETSENCRYPT_EMAIL set — registering without an email (renewal is still automatic)."
  EMAIL_ARG="--register-unsafely-without-email"
fi

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
$COMPOSE run --rm --entrypoint "certbot certonly --webroot -w /var/www/certbot ${STAGING_FLAG} ${DOMAINS} ${EMAIL_ARG} --agree-tos --rsa-key-size 4096 --non-interactive" certbot

echo "▸ Reloading nginx…"
$COMPOSE exec nginx nginx -s reload
echo "✓ HTTPS is ready: https://${DOMAIN}"
