# =============================================================================
# tests/test_recommendations_scoring.py  -  RECOMMENDATION SERVICE
#
# Tests the SCORING ALGORITHM in isolation, by monkeypatching
# app.clients.fetch_preferences / fetch_destinations so no network call
# happens at all. This is deliberately the FAST, no-moving-parts test - it
# proves the math is right regardless of whether User/Itinerary Service can
# actually run on this machine.
#
# For proof that the HTTP calls to the other two services genuinely work,
# see test_inter_service_integration.py instead.
# =============================================================================

from app import clients
from app.main import app, get_http_client


def _fake_client_returning(client, monkeypatch, prefs, destinations):
    """Swap out the two functions that talk to other services with ones
    that just return canned data - the route under test never notices."""
    monkeypatch.setattr("app.main.fetch_preferences", lambda http_client, auth: prefs)
    monkeypatch.setattr("app.main.fetch_destinations", lambda http_client: destinations)


def _auth_header():
    # require_auth() only checks the token decodes - the fake fetch_* above
    # never actually asks User/Itinerary Service what's behind it, so any
    # validly-signed token works here.
    import uuid
    from datetime import datetime, timedelta, timezone

    import jwt

    from app.security import JWT_ALGORITHM, JWT_SECRET

    token = jwt.encode(
        {"sub": uuid.uuid4().hex[:12], "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
        JWT_SECRET,
        algorithm=JWT_ALGORITHM,
    )
    return {"Authorization": f"Bearer {token}"}


_SAMPLE_DESTINATIONS = [
    {"id": "d1", "name": "Museum of Civilisations", "category": "museums", "rating": 4.6},
    {"id": "d2", "name": "Marché Mfoundi", "category": "streetfood", "rating": 4.0},
    {"id": "d3", "name": "Mont Febe", "category": "nature", "rating": 4.4},
]


def test_recommendations_require_a_valid_token(client):
    response = client.get("/recommendations")
    assert response.status_code in (401, 422)  # 422: FastAPI's own missing-header error


def test_a_forged_token_is_rejected(client):
    response = client.get("/recommendations", headers={"Authorization": "Bearer not.a.real.token"})
    assert response.status_code == 401


def test_no_saved_preferences_still_returns_popular_places(client, monkeypatch):
    """Mirrors the monolith's behaviour: no preferences and no rating high
    enough for the "highly rated" bonus (>= 4.3) -> falls back to the
    "popular in Yaoundé" reason instead of an error."""
    unrated_destinations = [
        {"id": "u1", "name": "Quiet Café", "category": "cafe", "rating": 4.0},
        {"id": "u2", "name": "Local Market", "category": "shopping", "rating": 3.8},
    ]
    _fake_client_returning(client, monkeypatch, prefs=None, destinations=unrated_destinations)

    response = client.get("/recommendations", headers=_auth_header())
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 2
    assert all("popular in yaound" in item["reason"].lower() for item in body)


def test_matching_an_interest_scores_higher_than_not_matching(client, monkeypatch):
    prefs = {"interests": ["Museums & Heritage"], "pace": "Balanced", "budget": "₣₣"}
    _fake_client_returning(client, monkeypatch, prefs=prefs, destinations=_SAMPLE_DESTINATIONS)

    response = client.get("/recommendations", headers=_auth_header())
    body = response.json()

    by_id = {item["id"]: item for item in body}
    # "Museums & Heritage" maps to category "museums" (see app/constants.py)
    assert by_id["d1"]["match_score"] > by_id["d2"]["match_score"]
    assert "matches one of your interests" in by_id["d1"]["reason"].lower()


def test_results_are_sorted_best_match_first(client, monkeypatch):
    prefs = {"interests": ["Nature & Parks"], "pace": "Relaxed", "budget": "₣"}
    _fake_client_returning(client, monkeypatch, prefs=prefs, destinations=_SAMPLE_DESTINATIONS)

    response = client.get("/recommendations", headers=_auth_header())
    scores = [item["match_score"] for item in response.json()]
    assert scores == sorted(scores, reverse=True)


def test_at_most_ten_results_even_with_a_bigger_catalogue(client, monkeypatch):
    many_destinations = [
        {"id": f"d{i}", "name": f"Place {i}", "category": "cafe", "rating": 4.0} for i in range(25)
    ]
    _fake_client_returning(client, monkeypatch, prefs=None, destinations=many_destinations)

    response = client.get("/recommendations", headers=_auth_header())
    assert len(response.json()) == 10
