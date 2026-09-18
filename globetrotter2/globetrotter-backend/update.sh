#!/usr/bin/env bash
# update.sh - pull latest backend code and restart the systemd services.
#
# ASSUMPTIONS (edit the variables below if yours differ):
#   - This script lives at the root of your cloned backend repo on the VPS
#     (e.g. /opt/globetrotter-backend or wherever you clone it).
#   - Each service runs as its own systemd unit, named
#     "globetrotter-<service>.service" (see SERVICES below). If you named
#     them differently, edit the SERVICES array to match.
#   - Each service still has its own .venv/ on the VPS (created once via
#     the "Run it without Docker" steps in README.md) - this script
#     reinstalls into that same .venv after pulling, it does not create it.
#
# If you're actually running this via Docker Compose instead of systemd,
# see the DOCKER COMPOSE section commented out at the bottom - use that
# instead of the SERVICES loop.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

SERVICES=(user-service itinerary-service recommendation-service chat-service gateway)

echo "==> Pulling latest code..."
git pull

for svc in "${SERVICES[@]}"; do
  echo "==> Updating dependencies: $svc"
  "$ROOT/services/$svc/.venv/bin/pip" install -q -r "$ROOT/services/$svc/requirements.txt"

  unit="globetrotter-${svc}.service"
  echo "==> Restarting $unit"
  sudo systemctl restart "$unit"
done

echo ""
echo "==> Done. Checking status:"
for svc in "${SERVICES[@]}"; do
  sudo systemctl is-active "globetrotter-${svc}.service" | sed "s/^/  globetrotter-${svc}.service: /"
done

# -----------------------------------------------------------------------
# DOCKER COMPOSE ALTERNATIVE - if you're running this repo via
# `docker compose up` instead of systemd units per service, comment out
# the SERVICES loop above and use this instead:
#
#   git pull
#   docker compose pull        # only does anything for the Jitsi images
#   docker compose up --build -d
#   docker compose ps
# -----------------------------------------------------------------------
