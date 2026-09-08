# =============================================================================
# tests/test_chat_and_routing.py
#
# Covers the two features added alongside the interface work:
#
#   - the GLOBAL CHAT (routers/chat.py): anyone can read it, only a logged-in
#     user can post, and `since` really does return only what's new - which is
#     the whole reason polling it every few seconds is cheap
#
#   - ROUTING (routers/routing.py): our proxy in front of OpenRouteService.
#     The tests here deliberately run with NO ORS_API_KEY set, because that is
#     the state anyone cloning this repo starts in. What we're proving is that
#     the app still returns a usable, correctly-shaped route in that case and
#     says plainly that it's an estimate, rather than erroring out.
#
#   - and GET /itineraries/{id}, which the new per-trip page depends on,
#     including that it will not hand one user another user's trip.
# =============================================================================

import uuid


# ---------------------------------------------------------------------------
# GLOBAL CHAT
# ---------------------------------------------------------------------------
def test_global_chat_starts_empty(client):
    response = client.get("/chat/global")
    assert response.status_code == 200
    assert response.json() == []


def test_posting_requires_login(client):
    response = client.post("/chat/global", json={"text": "Anyone near Mvolye?"})
    # No Authorization header at all -> HTTPBearer rejects it before our code.
    assert response.status_code == 403


def test_logged_in_user_can_post_and_everyone_can_read(client, registered_user):
    posted = client.post(
        "/chat/global",
        json={"text": "Is the Mfoundi market open today?"},
        headers=registered_user["headers"],
    )
    assert posted.status_code == 201, posted.text
    message = posted.json()

    # The message carries who said it, so the room can show a name.
    assert message["user_name"] == registered_user["name"]
    assert message["text"] == "Is the Mfoundi market open today?"
    assert message["id"] and message["created_at"]

    # Reading needs no login: you can see the room before you sign up.
    everyone_sees = client.get("/chat/global").json()
    assert [m["id"] for m in everyone_sees] == [message["id"]]


def test_empty_and_oversized_messages_are_rejected(client, registered_user):
    blank = client.post("/chat/global", json={"text": "   "}, headers=registered_user["headers"])
    assert blank.status_code == 400

    too_long = client.post(
        "/chat/global",
        json={"text": "x" * 501},
        headers=registered_user["headers"],
    )
    assert too_long.status_code == 422  # caught by the model's max_length


def test_since_returns_only_newer_messages(client, registered_user):
    first = client.post("/chat/global", json={"text": "first"}, headers=registered_user["headers"]).json()
    second = client.post("/chat/global", json={"text": "second"}, headers=registered_user["headers"]).json()

    # This is what the frontend's poll does: "anything after the last one I have?"
    after_first = client.get(f"/chat/global?since={first['id']}").json()
    assert [m["text"] for m in after_first] == ["second"]

    # Caught up -> the cheapest possible answer, an empty list.
    after_second = client.get(f"/chat/global?since={second['id']}").json()
    assert after_second == []


def test_unknown_since_id_falls_back_to_the_whole_room(client, registered_user):
    """If a client's last-seen message has been trimmed away, it must still
    get something sensible back rather than nothing at all."""
    client.post("/chat/global", json={"text": "hello"}, headers=registered_user["headers"])
    response = client.get(f"/chat/global?since={uuid.uuid4().hex}")
    assert [m["text"] for m in response.json()] == ["hello"]


# ---------------------------------------------------------------------------
# ROUTING
# ---------------------------------------------------------------------------
def test_routing_status_reports_whether_a_key_is_configured(client, monkeypatch):
    monkeypatch.delenv("ORS_API_KEY", raising=False)
    body = client.get("/routing/status").json()
    assert body["provider"] == "OpenRouteService"
    assert body["configured"] is False


def test_directions_fall_back_to_an_estimate_without_a_key(client, monkeypatch):
    """The important guarantee: no key must never mean a broken screen."""
    monkeypatch.delenv("ORS_API_KEY", raising=False)

    response = client.post(
        "/routing/directions",
        # Yaounde city centre -> a point a little to the east. [lng, lat].
        json={"coordinates": [[11.5167, 3.8667], [11.5300, 3.8700]], "profile": "driving-car"},
    )
    assert response.status_code == 200
    route = response.json()

    # It says what it is instead of passing a guess off as a measurement.
    assert route["source"] == "estimate"
    assert "estimate" in route["note"].lower()

    # And it is still a usable route: real numbers and a drawable line, in
    # Leaflet's [lat, lng] order (note the flip from the request above).
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

    # Latitude and longitude the wrong way round is the classic mistake, and
    # 187 is not a valid longitude - better to say so than to ask ORS.
    out_of_range = client.post(
        "/routing/directions",
        json={"coordinates": [[187.0, 3.8], [11.6, 3.9]]},
    )
    assert out_of_range.status_code == 400

    one_point = client.post("/routing/directions", json={"coordinates": [[11.5, 3.8]]})
    assert one_point.status_code == 422  # the model needs at least two


# ---------------------------------------------------------------------------
# ONE ITINERARY - what the new per-trip page fetches
# ---------------------------------------------------------------------------
def test_get_one_itinerary_includes_each_stop_s_destination(client, registered_user):
    destinations = client.get("/destinations").json()
    first, second = destinations[0], destinations[1]

    created = client.post(
        "/itineraries",
        json={
            "title": "Saturday highlights",
            "date": "2026-09-12",
            # Deliberately out of order, to prove the detail route sorts them.
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
    # The page needs names and coordinates to draw a route, so they come
    # attached rather than as bare ids.
    assert trip["stops"][0]["destination"]["name"] == first["name"]
    assert trip["stops"][0]["destination"]["latitude"] == first["latitude"]


def test_one_users_itinerary_is_not_visible_to_another(client, registered_user):
    created = client.post(
        "/itineraries",
        json={"title": "Private trip", "date": "2026-09-12", "stops": []},
        headers=registered_user["headers"],
    ).json()

    other = client.post(
        "/auth/register",
        json={"name": "Someone Else", "email": f"other_{uuid.uuid4().hex[:8]}@example.cm", "password": "SuperSecret123"},
    ).json()
    other_headers = {"Authorization": f"Bearer {other['access_token']}"}

    response = client.get(f"/itineraries/{created['id']}", headers=other_headers)
    # 404, not 403: we don't confirm that someone else's itinerary id is real.
    assert response.status_code == 404
