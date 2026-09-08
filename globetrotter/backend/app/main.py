# =============================================================================
# main.py
#
# This is the file you actually run. It:
#   1. Creates the FastAPI app
#   2. Turns on CORS (explained below - without this, the browser blocks
#      your frontend from talking to this backend!)
#   3. Registers every router (auth, destinations, recommendations,
#      itineraries, favorites) so their routes become part of the app
#
# Run it with:   uvicorn app.main:app --reload --port 8000
# (run that command from inside the globetrotter-backend/ folder)
# =============================================================================

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app import metrics, storage
from app.routers import (
    auth,
    chat,
    destinations,
    favorites,
    itineraries,
    recommendations,
    routing,
)

app = FastAPI(
    title="GlobeTrotter API",
    description="Phase 1 monolith backend for the GlobeTrotter Travel Assistant (CS4122 project).",
    version="1.0.0",
)

# -----------------------------------------------------------------------------
# CORS = Cross-Origin Resource Sharing.
#
# Your React app runs on http://localhost:5173 (Vite's dev server) and this
# API runs on http://localhost:8000 - two different "origins" as far as the
# browser is concerned. By default, browsers BLOCK a webpage from one origin
# from calling an API on another origin, to protect users from malicious
# sites. CORSMiddleware tells the browser "it's fine, localhost:5173 is
# allowed to call me".
#
# allow_origins=["*"] (any origin) is fine for a class project running
# locally. In a real product you'd list only your actual frontend's URL.
# -----------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Each router already knows its own URL prefix (e.g. "/auth", "/destinations"),
# set in the router files themselves - we just plug them all into the app.
app.include_router(auth.router)
app.include_router(destinations.router)
app.include_router(recommendations.router)
app.include_router(itineraries.router)
app.include_router(favorites.router)
# Proxies OpenRouteService for real street-following directions, keeping the
# API key on the server - see routers/routing.py.
app.include_router(routing.router)
# The global chat room every logged-in traveller shares.
app.include_router(chat.router)


# -----------------------------------------------------------------------------
# OBSERVABILITY
#
# `middleware("http")` registers a function that FastAPI runs around every
# request - see app/metrics.py for the full explanation. It is what makes
# GET /metrics below able to report how many requests we served and how
# slow they were.
# -----------------------------------------------------------------------------
app.middleware("http")(metrics.metrics_middleware)


@app.get("/metrics")
def get_metrics():
    """Live performance summary: request counts, average and p95 response
    times per endpoint, error rate and uptime.

    The Metrics screen in the React app reads this endpoint every few
    seconds to draw its dashboard. You can also just open
    http://localhost:8000/metrics in a browser to see the raw JSON."""
    return metrics.snapshot()


@app.post("/metrics/reset")
def reset_metrics():
    """Clear the collected numbers, so you can start a clean measurement
    (for example right before running scripts/load_test.py)."""
    metrics.reset()
    return {"status": "reset"}


@app.get("/health")
def health_check():
    """A simple endpoint to confirm the server is alive - visit
    http://localhost:8000/health in a browser and you should see this JSON."""
    return {"status": "ok", "service": "GlobeTrotter API", "phase": "Phase 1 - Monolith"}


@app.get("/media/{filename}")
def serve_media(filename: str):
    """Serves a photo/video that a traveller uploaded for one of their
    Locations. The files live in data/uploads/ (see storage.uploads_dir());
    the JSON records only store the "/media/<name>" URL."""
    # `filename` must be a bare name - reject anything with a path in it so
    # a request can't walk out of the uploads folder.
    if filename != Path(filename).name:
        raise HTTPException(status_code=404, detail="Not found")
    file_path = storage.uploads_dir() / filename
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="Not found")
    return FileResponse(file_path)


# =============================================================================
# Serving the React frontend from this same server
#
# The project is now one folder:
#
#   globetrotter/
#     backend/    <- you are here
#     frontend/   <- React app; `npm run build` puts its output in frontend/dist
#
# If frontend/dist exists, we serve it right here, so ONE command
# (uvicorn app.main:app --port 8000) gives you the whole app at
# http://localhost:8000 - no second terminal, no CORS to worry about.
#
# If it doesn't exist yet (you haven't built the frontend), nothing
# breaks: the API keeps working exactly as before and "/" just returns
# a short JSON note telling you what to do.
#
# Note this block is registered LAST on purpose. FastAPI matches routes
# in the order they were added, so /auth, /destinations, etc. are still
# handled by the routers above; only leftover paths reach the catch-all.
# =============================================================================
FRONTEND_DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"

# Paths that belong to the API. If someone requests one of these and no
# router matched, they get a real 404 instead of the HTML page.
API_PREFIXES = ("auth", "destinations", "recommendations", "itineraries", "favorites", "media", "routing", "chat", "metrics", "health", "docs", "openapi.json")

if FRONTEND_DIST.is_dir():
    # /assets/... holds the compiled JS + CSS that Vite generated.
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str):
        """Serves the React app.

        A single-page app does its own routing in the browser, so every
        unknown URL (e.g. /login, /site/123) must return index.html and
        let React Router take it from there. Real files that exist in
        the build (favicon.svg, icons.svg, ...) are served directly.
        """
        if full_path.split("/")[0] in API_PREFIXES:
            raise HTTPException(status_code=404, detail="Not found")

        candidate = FRONTEND_DIST / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)

        return FileResponse(FRONTEND_DIST / "index.html")

else:

    @app.get("/")
    def frontend_not_built():
        return {
            "status": "ok",
            "service": "GlobeTrotter API",
            "phase": "Phase 1 - Monolith",
            "note": "Frontend not built yet. Run `npm install && npm run build` in the frontend/ folder, then restart this server.",
        }
