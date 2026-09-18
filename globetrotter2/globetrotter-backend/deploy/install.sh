#!/usr/bin/env bash
# deploy/install.sh - one-time VPS setup: venvs, systemd units, first start.
# Run this ONCE from the repo root on a fresh clone (e.g. /root/globetrotter-backend).
# For pulling new code later, use update.sh instead - this script is only for
# the very first deploy (or after adding/removing a service).

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [ ! -f .env ]; then
  echo "No .env found - copy .env.example to .env and fill it in first."
  exit 1
fi

echo "==> Setting up venvs..."
for svc in user-service itinerary-service recommendation-service chat-service gateway; do
  echo "  - $svc"
  (cd "services/$svc" && python3 -m venv .venv && ./.venv/bin/pip install -q -r requirements.txt)
done

echo "==> Installing systemd units..."
cp deploy/systemd/*.service /etc/systemd/system/
systemctl daemon-reload

echo "==> Enabling + starting services..."
for svc in user-service itinerary-service recommendation-service chat-service gateway; do
  systemctl enable --now "globetrotter-${svc}.service"
done

echo ""
echo "==> Status:"
systemctl is-active globetrotter-user-service globetrotter-itinerary-service \
  globetrotter-recommendation-service globetrotter-chat-service globetrotter-gateway

echo ""
echo "==> Open the firewall for whatever port your nginx (frontend repo) will use"
echo "    to reach this Gateway, if it's not already open:"
echo "      sudo ufw allow <port>/tcp && sudo ufw reload"
echo ""
echo "Done. Gateway is on 127.0.0.1:8105 - not publicly reachable by design;"
echo "put nginx (see the frontend repo's deploy/nginx config) in front of it."
