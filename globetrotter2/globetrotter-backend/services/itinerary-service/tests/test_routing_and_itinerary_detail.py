# =============================================================================
# tests/test_routing_and_itinerary_detail.py  -  ITINERARY SERVICE
#
# The routing half of the monolith's old test_chat_and_routing.py (the chat
# half moved to chat-service/tests - see that folder), plus the
# GET /itineraries/{id} tests, which the per-trip page depends on.
# =============================================================================

from tests.conftest import auth_headers


# ---------------------------------------------------------------------------
# ROUTING
# ---------------------------------------------------------------------------
def test_routing_status_reports_whether_a_key_is_configured(client, monkeypatch):
    monkeypatch.delenv("ORS_API_KEY", raising=False)
    body = client.get("/routing/status").json()
    assert body["provider"] == "OpenRouteService"
    assert body["configured"] is False


def test_directions_fall_back_to_an_estimate_without_a_key(client, monkeypatch):
    monkeypatch.delenv("ORS_API_KEY", raising=False)

    response = client.post(
        "/routing/directions",
        json={"coordinates": [[11.5167, 3.8667], [11.5300, 3.8700]], "profile": "driving-car"},
    )
    assert response.status_code == 200
    route = response.json()

    assert route["source"] == "estimate"
    assert "estimate" in route["note"].lower()
    assert route["distance_m"] > 0
    assert route["duration_s"] > 0
    assert route["geometry"] == [[3.8667, 11.5167], [3.8700, 11.5300]]


def test_walking_is_slower_than_driving_over_the_same_ground(client, monkeypatch):
    monkeypatch.delenv("ORS_API_KEY", raising=False)
    payload = {"coordinates": [[11.5167, 3.8667], [11.5600, 3.8900]]}

    driving = client.post("/routing/directions", json={**payload, "profile": "driving-car"}).json()
    walking = client.post("/routing/directions", json={**payload, "profile": "foot-walking"}).json()

    assert walking["duration_s"] > driving["duration_s"]


def test_directions_reject_bad_input(client):
    unknown_profile = client.post(
        "/routing/directions",
        json={"coordinates": [[11.5, 3.8], [11.6, 3.9]], "profile": "teleport"},
    )
    assert unknown_profile.status_code == 400

    out_of_range = client.post(
        "/routing/directions",
        json={"coordinates": [[187.0, 3.8], [11.6, 3.9]]},
    )
    assert out_of_range.status_code == 400

    one_point = client.post("/routing/directions", json={"coordinates": [[11.5, 3.8]]})
    assert one_point.status_code == 422


# ---------------------------------------------------------------------------
# ONE ITINERARY
# ---------------------------------------------------------------------------
def test_get_one_itinerary_includes_each_stop_s_destination(client, registered_user):
    destinations = client.get("/destinations").json()
    first, second = destinations[0], destinations[1]

    created = client.post(
        "/itineraries",
        json={
            "title": "Saturday highlights",
            "date": "2026-09-12",
            "stops": [
                {"destination_id": second["id"], "order": 1},
                {"destination_id": first["id"], "order": 0},
            ],
        },
        headers=registered_user["headers"],
    ).json()

    response = client.get(f"/itineraries/{created['id']}", headers=registered_user["headers"])
    assert response.status_code == 200
    trip = response.json()

    assert trip["title"] == "Saturday highlights"
    assert [s["order"] for s in trip["stops"]] == [0, 1]
    assert trip["stops"][0]["destination"]["name"] == first["name"]
    assert trip["stops"][0]["destination"]["latitude"] == first["latitude"]


def test_one_users_itinerary_is_not_visible_to_another(client, registered_user):
    created = client.post(
        "/itineraries",
        json={"title": "Private trip", "date": "2026-09-12", "stops": []},
        headers=registered_user["headers"],
    ).json()

    other_headers = auth_headers()

    response = client.get(f"/itineraries/{created['id']}", headers=other_headers)
    assert response.status_code == 404
