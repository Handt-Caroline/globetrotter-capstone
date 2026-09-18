#!/usr/bin/env bash
# deploy/install.sh - one-time VPS setup: build + nginx site.
# Run this ONCE from the repo root on a fresh clone
# (e.g. /var/www/globetrotter-frontend). For pulling new code later,
# use update.sh instead.

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> Installing dependencies and building..."
npm install
npm run build

echo "==> Installing nginx site..."
cp deploy/nginx/globetrotter-frontend /etc/nginx/sites-available/globetrotter-frontend
ln -sf /etc/nginx/sites-available/globetrotter-frontend /etc/nginx/sites-enabled/globetrotter-frontend
nginx -t
systemctl reload nginx

PORT=$(grep -m1 -oP 'listen \K[0-9]+' deploy/nginx/globetrotter-frontend)
echo ""
echo "==> Opening firewall for port $PORT..."
sudo ufw allow "${PORT}/tcp"
sudo ufw reload

echo ""
echo "Done. Check: curl -I http://127.0.0.1:${PORT}/"
echo "Then from OUTSIDE the VPS: curl -I http://<your-vps-ip>:${PORT}/"
echo "(If that still times out, check the VPS provider's own cloud firewall"
echo " in their control panel - ufw alone isn't always enough.)"
