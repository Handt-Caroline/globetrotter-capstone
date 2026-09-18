# =============================================================================
# clients.py  -  RECOMMENDATION SERVICE
#
# THIS FILE IS THE WHOLE POINT OF THIS SERVICE.
#
# The assignment spec says Recommendation Service "owns no data - reads
# from User + Itinerary Services over HTTP". Concretely, that means: no
# storage.py, no data/ folder, no db.json anywhere in this service. Every
# fact it needs (a user's saved preferences, the list of destinations) is
# fetched fresh, over a real HTTP request, from whichever service actually
# owns that data.
#
# WHERE THE OTHER SERVICES LIVE
# --------------------------------
# In Docker Compose, service names double as hostnames on the compose
# network, so USER_SERVICE_URL becomes "http://user-service:8001". Running
# everything locally without Docker, it's "http://localhost:8001" instead -
# that's why these read from environment variables rather than being
# hardcoded: the same code works in both setups.
#
# WHY A DEPENDENCY-INJECTED httpx.Client, NOT A BARE MODULE-LEVEL CALL
# -----------------------------------------------------------------------
# main.py builds one shared httpx.Client at startup and passes it into
# these functions. That single line is also what makes the inter-service
# tests in tests/test_recommendations.py possible without three separate
# terminals running three real servers: the tests build a client that
# talks to in-memory copies of the real User/Itinerary FastAPI apps
# (httpx.ASGITransport) instead of real sockets, then hand THAT client to
# these exact same functions. Same code path, real HTTP request/response
# objects and status codes, no mocking of the actual logic.
# =============================================================================

import os

import httpx


def user_service_base_url() -> str:
    return os.environ.get("USER_SERVICE_URL", "http://localhost:8001")


def itinerary_service_base_url() -> str:
    return os.environ.get("ITINERARY_SERVICE_URL", "http://localhost:8002")


def fetch_preferences(client: httpx.Client, auth_header: str) -> dict | None:
    """Ask User Service for the caller's saved preferences.

    Returns None if the user hasn't saved any yet (User Service answers
    that with 404) - the recommendation algorithm treats "no preferences"
    as "just show popular places", same as the Phase 1 monolith did.
    """
    response = client.get(
        f"{user_service_base_url()}/preferences",
        headers={"Authorization": auth_header},
    )
    if response.status_code == 404:
        return None
    response.raise_for_status()
    return response.json()


def fetch_destinations(client: httpx.Client) -> list[dict]:
    """Ask Itinerary Service for the full destination catalogue. This
    endpoint is public (no login needed to browse), so no auth header."""
    response = client.get(f"{itinerary_service_base_url()}/destinations")
    response.raise_for_status()
    return response.json()
