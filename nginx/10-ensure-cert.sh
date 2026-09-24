#!/bin/sh
# If no Let's Encrypt certificate exists yet, create a short-lived self-signed one so
# nginx can start and answer ACME HTTP challenges. docker/init-letsencrypt.sh then
# obtains the real certificate and reloads nginx.
set -e
DOMAIN="${DOMAIN:-localhost}"
LIVE="/etc/letsencrypt/live/${DOMAIN}"
if [ ! -f "${LIVE}/fullchain.pem" ]; then
  echo "10-ensure-cert: no certificate for ${DOMAIN}; creating a temporary self-signed certificate"
  mkdir -p "${LIVE}"
  openssl req -x509 -nodes -newkey rsa:2048 -days 2 \
    -keyout "${LIVE}/privkey.pem" -out "${LIVE}/fullchain.pem" \
    -subj "/CN=${DOMAIN}" >/dev/null 2>&1
fi
mkdir -p /var/www/certbot
