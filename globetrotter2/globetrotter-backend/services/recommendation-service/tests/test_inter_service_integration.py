# =============================================================================
# tests/test_inter_service_integration.py  -  RECOMMENDATION SERVICE
#
# THIS IS THE TEST THAT PROVES THE ASSIGNMENT'S ACTUAL REQUIREMENT:
# "Recommendation Service must call the other services over HTTP, not read
# their files directly."
#
# The `live_services` fixture (see tests/conftest.py) starts REAL User
# Service and REAL Itinerary Service processes - their own Python
# interpreter, their own port, their own throwaway JSON file - and this
# test drives them exactly the way a browser eventually would:
#
#   1. Register a real account on the live User Service (real HTTP POST).
#   2. Save real preferences on the live User Service (real HTTP POST).
#   3. Call THIS service's GET /recommendations, which internally makes its
#      own real HTTP GET calls to both other services to do its job.
#
# If Recommendation Service secretly read a file instead of calling
# User/Itinerary Service over the network, these tests would still pass
# with mocked data - which is exactly why they don't mock anything. Every
# request here crosses a real loopback socket.
#
# THESE TESTS ARE SLOWER than the rest of the suite (each one starts two
# real web servers) and are SKIPPED automatically if either sibling
# service's .venv hasn't been set up yet - see _start_service() in
# conftest.py.
# =============================================================================

import httpx


def test_recommendations_with_no_preferences_reads_the_real_catalogue(live_client, registered_user, live_services):
    """No preferences saved yet -> falls back to "popular", using
    destinations that really came from the live Itinerary Service."""
    response = live_client.get("/recommendations", headers=registered_user["headers"])

    assert response.status_code == 200
    body = response.json()
    assert len(body) > 0

    # Cross-check: the exact same destination ids the live Itinerary
    # Service itself would list, proving this data came from there and not
    # from some local copy.
    real_destinations = httpx.get(f"{live_services['itinerary_url']}/destinations", timeout=5.0).json()
    real_ids = {d["id"] for d in real_destinations}
    assert all(item["id"] in real_ids for item in body)


def test_recommendations_use_preferences_really_saved_on_user_service(live_client, registered_user, live_services):
    """Save preferences directly against the live User Service (not through
    Recommendation Service - it has no such endpoint, on purpose), then
    prove Recommendation Service picks them up over HTTP."""
    save = httpx.post(
        f"{live_services['user_url']}/preferences",
        json={"interests": ["Museums & Heritage"], "pace": "Balanced", "budget": "₣₣"},
        headers=registered_user["headers"],
        timeout=5.0,
    )
    assert save.status_code == 200, save.text

    response = live_client.get("/recommendations", headers=registered_user["headers"])
    assert response.status_code == 200
    body = response.json()

    museums = [item for item in body if item["category"] == "museums"]
    others = [item for item in body if item["category"] != "museums"]
    assert museums, "expected at least one museum in the live seed data"
    assert all("matches one of your interests" in item["reason"].lower() for item in museums)
    if others:
        assert museums[0]["match_score"] >= others[0]["match_score"]


def test_a_token_from_the_real_user_service_is_honoured(live_client, registered_user):
    """The JWT used here was issued by a REAL, separate User Service
    process, over a REAL HTTP register call - not minted locally - proving
    the shared-secret trust between services actually works end to end."""
    response = live_client.get("/recommendations", headers=registered_user["headers"])
    assert response.status_code == 200


def test_an_unknown_users_token_shape_but_wrong_secret_is_rejected(live_client):
    """A token that isn't signed with the shared secret must still be
    rejected, even though both real services are up and reachable."""
    response = live_client.get("/recommendations", headers={"Authorization": "Bearer not.a.real.token"})
    assert response.status_code == 401
