#!/bin/sh
# Reload nginx every 6 hours in the background so renewed Let's Encrypt
# certificates are picked up without a restart.
(
  while :; do
    sleep 21600
    nginx -s reload 2>/dev/null || true
  done
) &
