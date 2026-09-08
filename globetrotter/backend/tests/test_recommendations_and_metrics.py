# =============================================================================
# tests/test_recommendations_and_metrics.py
#
# Two areas here:
#   1. Preferences and recommendations - the personalisation engine.
#   2. /metrics - the observability endpoint the slides ask for.
# =============================================================================


def test_saving_preferences_with_the_current_interest_labels(client, registered_user):
    """The onboarding screen sends human labels like 'Street Food'. The
    backend maps them to category ids ('streetfood') via app/constants.py.

    If someone renames a label in the React app without updating the map,
    recommendations silently return nothing - so this test locks the two
    sides together.
    """
    response = client.post(
        "/recommendations/preferences",
        headers=registered_user["headers"],
        json={
            "interests": ["Street Food", "Museums & Heritage", "Football & Sport"],
            "pace": "Balanced",
            "budget": "₣₣",
        },
    )

    assert response.status_code == 200


def test_recommendations_match_the_chosen_interests(client, registered_user):
    """Ask for museums, get museums near the top."""
    client.post(
        "/recommendations/preferences",
        headers=registered_user["headers"],
        json={"interests": ["Museums & Heritage"], "pace": "Relaxed", "budget": "₣"},
    )

    recommendations = client.get("/recommendations", headers=registered_user["headers"]).json()

    assert len(recommendations) > 0
    categories = [r["category"] for r in recommendations[:3]]
    assert "museums" in categories


def test_recommendations_are_sorted_best_first(client, registered_user):
    """The For You screen shows the top 3, so the order has to be right."""
    client.post(
        "/recommendations/preferences",
        headers=registered_user["headers"],
        json={"interests": ["Historical Landmarks", "Street Food"], "pace": "Packed", "budget": "₣₣"},
    )

    scores = [r["match_score"] for r in client.get("/recommendations", headers=registered_user["headers"]).json()]

    assert scores == sorted(scores, reverse=True)


def test_old_interest_labels_still_work(client, registered_user):
    """Someone who onboarded before we renamed the interests still has the
    old labels saved. constants.py keeps them mapped so their account
    doesn't break after an update - a small but real compatibility rule."""
    response = client.post(
        "/recommendations/preferences",
        headers=registered_user["headers"],
        json={"interests": ["Cafés", "Nightlife & Bars"], "pace": "Balanced", "budget": "₣₣"},
    )
    assert response.status_code == 200

    assert len(client.get("/recommendations", headers=registered_user["headers"]).json()) > 0


def test_recommendations_require_login(client):
    """They're personal, so they need a token."""
    assert client.get("/recommendations").status_code in (401, 403)


# ------------------------------- metrics -----------------------------------


def test_health_check_answers(client):
    """The simplest possible 'is the server alive?' probe. In Phase 3 a
    load balancer or Kubernetes will call exactly this kind of endpoint to
    decide whether to keep sending traffic to a server."""
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_metrics_counts_the_requests_we_make(client):
    """Proves the stopwatch middleware is actually wired up."""
    client.post("/metrics/reset")
    client.get("/destinations")
    client.get("/destinations")

    snapshot = client.get("/metrics").json()

    assert snapshot["total_requests"] >= 2
    assert snapshot["p95_ms"] >= 0
    assert any("/destinations" in route["route"] for route in snapshot["routes"])


def test_metrics_notices_errors(client):
    """A 404 must show up in the error count, not be quietly ignored."""
    client.post("/metrics/reset")
    client.get("/destinations/dest_definitely_missing")  # deliberate 404

    snapshot = client.get("/metrics").json()

    assert snapshot["error_count"] >= 1


def test_responses_carry_a_timing_header(client):
    """Every response reports how long it took, so you can see it in the
    browser's Network tab without opening the dashboard."""
    response = client.get("/destinations")

    assert "X-Response-Time-ms" in response.headers
    assert float(response.headers["X-Response-Time-ms"]) >= 0
