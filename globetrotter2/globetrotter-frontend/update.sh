#!/usr/bin/env bash
# update.sh - pull latest frontend code, rebuild, and reload nginx.
#
# ASSUMPTIONS (edit if yours differ):
#   - This script lives at the root of your cloned frontend repo on the
#     VPS, e.g. /var/www/globetrotter-frontend.
#   - Your nginx site config's `root` points at THIS repo's `dist/`
#     folder directly (e.g. `root /var/www/globetrotter-frontend/dist;`),
#     so rebuilding in place is enough - nothing needs to be copied
#     elsewhere. If your nginx root points somewhere else instead, set
#     DEPLOY_DIR below and the script will rsync dist/ there for you.
#   - If you use VITE_GOOGLE_CLIENT_ID / VITE_JITSI_URL, put them in a
#     `.env` file here (gitignored) - `npm run build` picks it up
#     automatically, nothing to change in this script.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

# Leave empty if nginx's root already points straight at this repo's
# dist/ folder. Set it (e.g. "/var/www/globetrotter") if nginx serves
# from a different path and you need the build copied there instead.
DEPLOY_DIR=""

echo "==> Pulling latest code..."
git pull

echo "==> Installing dependencies..."
npm install

echo "==> Building..."
npm run build

if [ -n "$DEPLOY_DIR" ]; then
  echo "==> Syncing dist/ to $DEPLOY_DIR"
  sudo rsync -a --delete "$ROOT/dist/" "$DEPLOY_DIR/"
fi

echo "==> Reloading nginx..."
sudo nginx -t
sudo systemctl reload nginx

echo "==> Done."
