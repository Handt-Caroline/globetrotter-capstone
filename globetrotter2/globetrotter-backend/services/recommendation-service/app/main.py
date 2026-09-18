# =============================================================================
# main.py  -  RECOMMENDATION SERVICE entry point
#
# THIS SERVICE OWNS NO DATA. NO storage.py. NO data/ FOLDER. That's not an
# oversight - it's the requirement: "Recommendation Service - owns no data,
# reads from User + Itinerary Services over HTTP". Every request below
# calls out to the other two services over real HTTP (see app/clients.py)
# and computes an answer from what comes back. If both of those services
# were down, this service could not produce a single recommendation - which
# is the honest, visible cost of NOT owning your own copy of the data. That
# trade-off (freshness vs. resilience) is exactly what the course is trying
# to teach with this exercise.
#
# Run it directly (for local dev, no Docker):
#   cd services/recommendation-service
#   pip install -r requirements.txt
#   uvicorn app.main:app --reload --port 8003
#
# It needs to know where to find the other two services - see the
# USER_SERVICE_URL / ITINERARY_SERVICE_URL environment variables read in
# app/clients.py. Defaults assume you're running all three services
# locally on their standard ports (8001, 8002).
# =============================================================================

import httpx
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import metrics
from app.clients import fetch_destinations, fetch_preferences
from app.constants import INTEREST_LABEL_TO_CATEGORY
from app.deps import require_auth

app = FastAPI(
    title="GlobeTrotter - Recommendation Service",
    description="Owns no data. Reads user preferences from User Service and the "
    "destination catalogue from Itinerary Service, both over HTTP, to score "
    "destinations. Phase 2 microservice.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.middleware("http")(metrics.metrics_middleware)

# One shared HTTP client for the whole service's lifetime, reused across
# requests (creating a new TCP connection per call would be wasteful).
# `Depends(get_http_client)` is what lets tests below swap this out for a
# client that talks to in-memory copies of the other two services instead
# of real ones - see tests/conftest.py.
_http_client = httpx.Client(timeout=5.0)


def get_http_client() -> httpx.Client:
    return _http_client


@app.get("/recommendations")
def get_recommendations(
    authorization: str = Depends(require_auth),
    client: httpx.Client = Depends(get_http_client),
):
    """
    Same scoring algorithm as the Phase 1 monolith's recommendations router
    (not real ML - a simple, explainable point system, which is fine for a
    class project and easy to describe in a demo):

      +2 points  if the destination's category matches one of the user's
                 chosen interests
      +1 point   if the destination is highly rated (4.3 or above)
      +0.5 point per 0.1 of rating, as a small tie-breaker

    The difference from Phase 1: "the user's chosen interests" and "the
    destination catalogue" no longer live in this process's own memory -
    both come from a live HTTP call to another service, made just above.
    """
    prefs = fetch_preferences(client, authorization)
    destinations = fetch_destinations(client)

    liked_categories = set()
    if prefs:
        liked_categories = {
            INTEREST_LABEL_TO_CATEGORY[label]
            for label in prefs["interests"]
            if label in INTEREST_LABEL_TO_CATEGORY
        }

    scored = []
    for dest in destinations:
        score = 0.0
        reasons = []

        if dest["category"] in liked_categories:
            score += 2.0
            reasons.append("matches one of your interests")

        if dest["rating"] >= 4.3:
            score += 1.0
            reasons.append("highly rated by other travellers")

        score += dest["rating"] / 10

        if not reasons:
            reasons.append("popular in Yaoundé")

        match_score = round(min(score / 3.5, 1.0) * 100)

        scored.append({**dest, "match_score": match_score, "reason": ", ".join(reasons).capitalize()})

    scored.sort(key=lambda d: d["match_score"], reverse=True)
    return scored[:10]


@app.get("/metrics")
def get_metrics():
    return metrics.snapshot()


@app.post("/metrics/reset")
def reset_metrics():
    metrics.reset()
    return {"status": "reset"}


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "recommendation-service", "phase": "Phase 2 - Microservices"}
