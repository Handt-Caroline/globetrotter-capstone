# =============================================================================
# proxy.py  -  API GATEWAY's core trick: forwarding one HTTP request to
# whichever backend service actually owns that data.
#
# WHAT AN API GATEWAY ACTUALLY DOES
# ------------------------------------
# The frontend is only ever told about ONE address (this Gateway, port
# 8000 - see docker-compose.yml). It has no idea User Service, Itinerary
# Service and Recommendation Service even exist, let alone which port each
# one listens on. Every request the browser makes lands here first, and
# this file's job is: look at the URL path, decide which real service
# should answer it, forward the request there almost unchanged (same
# method, same headers - crucially the JWT in "Authorization" - same
# body), and hand back exactly what that service replied with.
#
# This is "dumb" on purpose: the Gateway does not decode JWTs, does not
# know what a preference or a destination IS - it only routes bytes. All
# the actual business logic stays inside the services that own the data,
# which is the whole point of a Gateway (it should be replaceable/rebuild­
# able without touching business logic, and vice versa).
#
# WHY THIS ISN'T A "REAL" PRODUCTION GATEWAY
# ---------------------------------------------
# Real deployments often use a dedicated gateway product (Kong, NGINX,
# Traefik, AWS API Gateway...) instead of hand-rolled Python. We build our
# own here because the assignment's whole point is to demonstrate the
# ROUTING CONCEPT - and a from-scratch FastAPI proxy is far easier for a
# classmate or your lecturer to read line-by-line than an NGINX config
# file full of unfamiliar directives.
# =============================================================================

import httpx
from fastapi import FastAPI, Request, Response

ALL_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"]

# WHY THIS CLIENT LIVES ON app.state AND NOT A MODULE-LEVEL VARIABLE
# ---------------------------------------------------------------------
# A single shared httpx.AsyncClient (reused across every proxied request,
# instead of opening a fresh TCP connection each time) is the right idea -
# but a module-level `_http_client = httpx.AsyncClient()` gets created
# exactly ONCE, the first time this file is imported, and closed forever
# by the app's shutdown handler. That's fine for `uvicorn app.main:app`
# running once - but every FastAPI TestClient(app) used in the test suite
# fires that same shutdown handler when its `with` block exits, which
# would permanently kill the one shared client after the FIRST test and
# break every test after it with "client has been closed". Storing the
# client on `request.app.state` instead means it's created fresh in a
# startup handler and closed in a shutdown handler EACH time the app's
# lifespan runs - correct for one long-running server AND for a test
# suite that starts/stops the app many times.
def get_http_client(request: Request) -> httpx.AsyncClient:
    return request.app.state.http_client


# Headers that describe THIS hop of the connection (host, content-length,
# etc.) and must NOT be blindly copied onto the request we send to the
# real service, or the response we send back to the browser - httpx/
# Starlette compute the correct ones for the new hop automatically.
_HOP_BY_HOP_REQUEST_HEADERS = {"host", "content-length"}
_HOP_BY_HOP_RESPONSE_HEADERS = {"content-length", "transfer-encoding", "connection"}


async def proxy_request(request: Request, target_base_url: str, target_path: str) -> Response:
    """Forward `request` to `{target_base_url}{target_path}` and return
    whatever that service answered, as-is."""
    url = f"{target_base_url}{target_path}"

    forward_headers = {
        key: value
        for key, value in request.headers.items()
        if key.lower() not in _HOP_BY_HOP_REQUEST_HEADERS
    }

    body = await request.body()

    # request.query_params is Starlette's own QueryParams type; converting
    # to a plain list of (key, value) pairs keeps this working regardless
    # of exactly which object type httpx expects for `params`, and
    # preserves a query string with a repeated key (e.g. ?ids=a&ids=b).
    query_pairs = list(request.query_params.multi_items())

    client = get_http_client(request)
    upstream_response = await client.request(
        request.method,
        url,
        headers=forward_headers,
        params=query_pairs,
        content=body,
    )

    response_headers = {
        key: value
        for key, value in upstream_response.headers.items()
        if key.lower() not in _HOP_BY_HOP_RESPONSE_HEADERS
    }

    return Response(
        content=upstream_response.content,
        status_code=upstream_response.status_code,
        headers=response_headers,
        media_type=upstream_response.headers.get("content-type"),
    )


def register_proxy(app: FastAPI, prefix: str, target_base_url_fn, methods: list[str] | None = None) -> None:
    """Registers TWO routes that both forward to `target_base_url_fn()`:

      - the bare prefix itself, e.g. GET /destinations
      - the prefix plus anything after it, e.g. GET /destinations/{id},
        POST /destinations/media, PUT /destinations/{id}

    `target_base_url_fn` is a function (not a plain string) so the actual
    URL is looked up fresh on every request - that's what lets tests point
    this Gateway at a different set of running services just by changing
    an environment variable, with no code change (see tests/conftest.py).
    """
    methods = methods or ALL_METHODS

    async def handle_bare(request: Request) -> Response:
        return await proxy_request(request, target_base_url_fn(), prefix)

    async def handle_sub(path: str, request: Request) -> Response:
        return await proxy_request(request, target_base_url_fn(), f"{prefix}/{path}")

    app.add_api_route(prefix, handle_bare, methods=methods, include_in_schema=False)
    app.add_api_route(f"{prefix}/{{path:path}}", handle_sub, methods=methods, include_in_schema=False)
