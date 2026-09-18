# =============================================================================
# main.py  -  API GATEWAY entry point
#
# THE SINGLE FRONT DOOR
# -----------------------
# This is the ONLY address the frontend ever talks to (see docker-compose.yml
# - it's the only service that publishes a port to the outside world). Every
# other service (User, Itinerary, Recommendation, and later Chat) is only
# reachable from inside the Docker network - not from your browser directly.
# That is what "the frontend should only ever talk to the Gateway" means in
# practice, and it's enforced by Compose network config, not just convention.
#
# HOW A REQUEST'S PATH DECIDES WHERE IT GOES
# ---------------------------------------------
#   /auth/*                      -> User Service          (register/login/me)
#   /preferences, /recommendations/preferences  -> User Service (see below)
#   /recommendations             -> Recommendation Service
#   /destinations/*, /favorites/*, /itineraries/*, /routing/*, /media/*
#                                 -> Itinerary Service
#   anything else (e.g. /login, /site/42, /)
#                                 -> the built React app (frontend/dist)
#
# THE ONE DELIBERATE PATH REWRITE
# -----------------------------------
# The frontend calls GET/POST "/recommendations/preferences" (that hasn't
# changed since Phase 1 - see frontend/src/api/client.js). But preferences
# are USER data now, stored in User Service, not Recommendation Service
# (which owns no data at all - see recommendation-service/app/main.py).
# Rewriting that one path is a completely normal Gateway job: hide a
# backend reorganisation from the client that doesn't need to know about
# it. The frontend needed ZERO code changes for this.
#
# Run it directly (for local dev, no Docker - the other 3 services must
# already be running on their default ports for this to actually work):
#   cd services/gateway
#   pip install -r requirements.txt
#   uvicorn app.main:app --reload --port 8000
# =============================================================================

import os
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
from fastapi import Depends, FastAPI, HTTPException, Request, Response, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app import metrics
from app.proxy import proxy_request, register_proxy
from app.security import require_admin
from app.ws_proxy import proxy_websocket


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Created once when the app starts, reused for every proxied request,
    # closed when the app stops - see app/proxy.py's get_http_client() for
    # why this lives on app.state instead of a module-level variable.
    app.state.http_client = httpx.AsyncClient(timeout=30.0)
    yield
    await app.state.http_client.aclose()


app = FastAPI(
    title="GlobeTrotter - API Gateway",
    description="Single entry point. Routes every request to the microservice that "
    "actually owns the data, and serves the built React app. Phase 2.",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.middleware("http")(metrics.metrics_middleware)


# -----------------------------------------------------------------------------
# WHERE THE OTHER SERVICES ARE
#
# Read at request time (not import time) via these tiny functions, so
# tests can point the Gateway at a different set of running services just
# by setting an environment variable - see tests/conftest.py.
# -----------------------------------------------------------------------------
def user_service_url() -> str:
    return os.environ.get("USER_SERVICE_URL", "http://localhost:8001")


def itinerary_service_url() -> str:
    return os.environ.get("ITINERARY_SERVICE_URL", "http://localhost:8002")


def recommendation_service_url() -> str:
    return os.environ.get("RECOMMENDATION_SERVICE_URL", "http://localhost:8003")


def chat_service_url() -> str:
    return os.environ.get("CHAT_SERVICE_URL", "http://localhost:8004")


# -----------------------------------------------------------------------------
# ROUTING TABLE
# -----------------------------------------------------------------------------
register_proxy(app, "/auth", user_service_url)
register_proxy(app, "/preferences", user_service_url)  # direct access, handy for testing
register_proxy(app, "/users", user_service_url)  # the public {id -> name} lookup

register_proxy(app, "/destinations", itinerary_service_url)
register_proxy(app, "/favorites", itinerary_service_url)
register_proxy(app, "/itineraries", itinerary_service_url)
register_proxy(app, "/routing", itinerary_service_url)
register_proxy(app, "/media", itinerary_service_url)
register_proxy(app, "/assistant", itinerary_service_url)  # the free keyword-search "AI"

register_proxy(app, "/rooms", chat_service_url)  # room/membership management, message history


# -----------------------------------------------------------------------------
# THE CHAT WEBSOCKET
#
# Everything above is a normal HTTP request/response - proxy_request()
# forwards it and hands back whatever the real service said. A WebSocket
# is a different kind of connection (one long-lived pipe, not a single
# request), so it needs its own kind of proxy - see app/ws_proxy.py for
# how a single client connection maps onto a single outbound connection
# to Chat Service, with messages pumped both ways until either side
# closes. This is still "the frontend only ever talks to the Gateway" -
# the browser's WebSocket URL is ws://<gateway>/ws/<room_id>, never
# ws://<chat-service>/... directly.
# -----------------------------------------------------------------------------
@app.websocket("/ws/{room_id}")
async def chat_websocket_proxy(websocket: WebSocket, room_id: str):
    await proxy_websocket(websocket, chat_service_url(), f"/ws/{room_id}")


# /recommendations needs custom handling because ONE sub-path
# ("/recommendations/preferences") actually belongs to a different
# service than the rest of the prefix. See the module docstring above.
@app.api_route("/recommendations", methods=["GET", "POST", "PUT", "PATCH", "DELETE"], include_in_schema=False)
async def recommendations_bare(request: Request) -> Response:
    return await proxy_request(request, recommendation_service_url(), "/recommendations")


@app.api_route(
    "/recommendations/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"], include_in_schema=False
)
async def recommendations_sub(path: str, request: Request) -> Response:
    if path == "preferences":
        return await proxy_request(request, user_service_url(), "/preferences")
    return await proxy_request(request, recommendation_service_url(), f"/recommendations/{path}")


@app.get("/metrics", dependencies=[Depends(require_admin)])
def get_metrics():
    """Reports the GATEWAY's own request timings (how long proxying took,
    per route) - not a combined dashboard for all 4 services. Each service
    has its own /metrics too (only reachable from inside Docker, not
    through this Gateway) - aggregating them into one view is exactly the
    kind of observability/tracing tooling the course explicitly scopes
    into a LATER phase, so we deliberately don't build it here.

    ADMIN ONLY as of the roles feature (see app/security.py) - a regular
    traveller's System Health screen should not be able to see this."""
    return metrics.snapshot()


@app.post("/metrics/reset", dependencies=[Depends(require_admin)])
def reset_metrics():
    metrics.reset()
    return {"status": "reset"}


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "api-gateway", "phase": "Phase 2 - Microservices"}


# =============================================================================
# SERVING THE REACT FRONTEND
#
# Identical idea to the Phase 1 monolith's main.py: if frontend/dist exists
# (built with `npm run build`), serve it from here, so the whole app is
# still just ONE url (http://localhost:8000) for a demo - no CORS to worry
# about, no second terminal needed. This block is registered LAST so it
# only catches paths none of the routes above already claimed.
#
# WHY THIS PATH CAN BE OVERRIDDEN BY AN ENV VAR
# -------------------------------------------------
# Running locally (no Docker), this file sits at services/gateway/app/
# main.py, four directories below frontend/dist, so the relative walk
# below finds it correctly. Inside the Gateway's Docker image (see its
# Dockerfile - a multi-stage build that compiles the frontend in a Node
# stage, then copies the result in), the built app doesn't live at that
# same relative depth. Rather than hardcode two different assumptions,
# FRONTEND_DIST is read from an env var when one is set - the Dockerfile
# sets it explicitly - and only falls back to the relative walk for local,
# non-Docker runs.
# =============================================================================
_env_frontend_dist = os.environ.get("FRONTEND_DIST")
FRONTEND_DIST = (
    Path(_env_frontend_dist)
    if _env_frontend_dist
    else Path(__file__).resolve().parent.parent.parent.parent / "frontend" / "dist"
)

API_PREFIXES = (
    "auth", "preferences", "users", "recommendations",
    "destinations", "favorites", "itineraries", "routing", "media", "assistant",
    "rooms", "metrics", "health", "docs", "openapi.json",
)

if FRONTEND_DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str):
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
            "service": "api-gateway",
            "phase": "Phase 2 - Microservices",
            "note": "Frontend not built yet. Run `npm install && npm run build` in the frontend/ folder.",
        }
