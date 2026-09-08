#!/usr/bin/env bash
# Starts the whole GlobeTrotter app (API + React screens) on http://localhost:8000
set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 1. Build the frontend every time.
#
# We used to only build if frontend/dist didn't exist yet. That's fast, but
# it means dropping your own photos/videos into frontend/src/assets/media/
# (see that folder's README) or editing any React file would NOT show up
# until you deleted frontend/dist by hand - confusing for anyone who isn't
# already comfortable with build tools. Rebuilding every run costs a few
# seconds and means "add a file, restart the app" always just works.
if ! command -v npm >/dev/null 2>&1; then
  if [ -d "$ROOT/frontend/dist" ]; then
    echo "==> npm not found - reusing the existing frontend/dist build (skipping rebuild)."
  else
    echo "npm is not installed. Install Node.js, or restore the frontend/dist folder."
    exit 1
  fi
else
  echo "==> Building the React app..."
  cd "$ROOT/frontend"
  npm install
  npm run build
fi

# 2. Python virtual environment for the backend.
cd "$ROOT/backend"
if [ ! -d ".venv" ]; then
  echo "==> Creating Python virtual environment..."
  python3 -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate

echo "==> Installing backend requirements..."
pip install -q -r requirements.txt
# requirements.txt is unchanged: the global chat and the routing proxy
# (app/routers/chat.py and routing.py) use only the Python standard library.

# 3. Optional configuration from backend/.env
#
# The backend reads plain environment variables (currently just ORS_API_KEY).
# `export` only lasts for the current shell, which is easy to lose. If
# backend/.env exists we load KEY=VALUE lines from it here so the key sticks
# between runs. Lines starting with # are ignored. Copy backend/.env.example
# to backend/.env to get started; .env is gitignored.
if [ -f "$ROOT/backend/.env" ]; then
  echo "==> Loading settings from backend/.env"
  set -a
  # shellcheck disable=SC1091
  . "$ROOT/backend/.env"
  set +a
fi

# 4. Note about real street routing.
#
# The map and each itinerary's page ask OpenRouteService for routes that
# follow actual streets. That needs a free API key. Without one the app still
# works - it falls back to a straight-line estimate, draws it dashed, and says
# on screen that it is an estimate - so this is a note, not an error.
if [ -z "${ORS_API_KEY:-}" ]; then
  echo ""
  echo "==> Note: ORS_API_KEY is not set, so routes will be straight-line estimates."
  echo "    For real street routing, get a free key at"
  echo "    https://openrouteservice.org/dev/#/signup then either:"
  echo "      export ORS_API_KEY=your_key_here      (this shell only)"
  echo "    or put  ORS_API_KEY=your_key_here  in backend/.env  (sticks)"
else
  echo "==> OpenRouteService key found - routes will follow real streets."
fi

# 5. Run it.
echo ""
echo "==> GlobeTrotter is starting on http://localhost:8000"
echo "    API docs: http://localhost:8000/docs   (Ctrl+C to stop)"
echo ""
exec uvicorn app.main:app --reload --port 8000
