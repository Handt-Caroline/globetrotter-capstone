# =============================================================================
# user_lookup.py  -  ASKING USER SERVICE "WHO IS THIS?", OVER REAL HTTP
#
# Chat Service owns rooms and messages, but NOT users - it has no users
# table of its own. Before creating a 1-on-1 or group room it needs to
# know the other member(s) actually exist, and to show names instead of
# raw ids it needs to know what those people are called. Both come from
# THE SAME public lookup Recommendation Service's inter-service calls use
# as their model (see recommendation-service/app/clients.py) - a real HTTP
# GET to User Service's GET /users?ids=... (see user-service/app/routers/
# users.py), never a shared file or a guess.
#
# WHY THIS MUST BE ASYNC (NOT A PLAIN, SYNCHRONOUS httpx.get())
# ------------------------------------------------------------------
# This function is called from `await`-ed, `async def` code: both the
# WebSocket receive loop (ws.py) and the REST message-posting route share
# app/chatlogic.py's post_message(), which is async so it can also
# `await connections.broadcast(...)`. A synchronous, blocking httpx.get()
# call made directly inside that async code would freeze this service's
# ENTIRE event loop for as long as the HTTP call takes - not just this one
# request, ALL of them, on every connection this process is handling.
#
# This bit us for real while building this feature: a synchronous
# fetch_user_names() here caused messages sent through the API Gateway's
# WebSocket proxy (see gateway/app/ws_proxy.py) to silently never arrive,
# while the exact same code worked when a client connected directly to
# this service - proxying added just enough extra async scheduling for
# the event-loop stall to actually manifest as a stuck connection. Using
# `httpx.AsyncClient` instead means the wait for User Service's response
# genuinely yields control back to the event loop, so other connections
# (and this one's own send/receive machinery) keep running normally while
# it waits.
# =============================================================================

import os

import httpx


def user_service_url() -> str:
    return os.environ.get("USER_SERVICE_URL", "http://localhost:8001")


async def fetch_user_names(user_ids: list[str]) -> dict[str, str]:
    """Returns {id: name} for whichever of `user_ids` really exist. Missing
    ids are simply absent from the result (the caller decides what that
    means - usually "reject this room, that id doesn't exist")."""
    ids = sorted({i for i in user_ids if i})
    if not ids:
        return {}
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{user_service_url()}/users", params={"ids": ",".join(ids)})
        response.raise_for_status()
    except httpx.HTTPError:
        return {}
    return {u["id"]: u["name"] for u in response.json()}
