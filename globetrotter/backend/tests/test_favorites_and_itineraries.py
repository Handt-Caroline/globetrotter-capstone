# =============================================================================
# tests/test_favorites_and_itineraries.py
#
# These endpoints all require login, so nearly every test here uses the
# `registered_user` fixture from conftest.py to get an auth header.
#
# The favourites tests exist because of a real bug: the heart button used
# to call the API but never showed whether a place was already saved, and
# the For You screen kept likes only in memory so they vanished on refresh.
# Tests like these are how you stop a fixed bug from coming back.
# =============================================================================


def test_favorites_start_empty(client, registered_user):
    """A new account has saved nothing yet."""
    response = client.get("/favorites", headers=registered_user["headers"])

    assert response.status_code == 200
    assert response.json() == []


def test_favorites_require_login(client):
    """Favourites are personal, so an anonymous visitor gets refused."""
    response = client.get("/favorites")

    assert response.status_code in (401, 403)


def test_adding_a_favorite_then_reading_it_back(client, registered_user):
    """The core 'like' flow the heart button performs."""
    destination = client.get("/destinations").json()[0]

    add = client.post(f"/favorites/{destination['id']}", headers=registered_user["headers"])
    assert add.status_code == 204  # 204 = success, nothing to send back

    favorites = client.get("/favorites", headers=registered_user["headers"]).json()
    assert len(favorites) == 1
    # The API returns FULL destination objects, not just ids, because the
    # Favourites screen needs the name, rating and photo to draw a card.
    assert favorites[0]["name"] == destination["name"]
    assert "price_range" in favorites[0]


def test_liking_the_same_place_twice_does_not_duplicate_it(client, registered_user):
    """Double-tapping the heart must not create two entries."""
    destination_id = client.get("/destinations").json()[0]["id"]

    client.post(f"/favorites/{destination_id}", headers=registered_user["headers"])
    client.post(f"/favorites/{destination_id}", headers=registered_user["headers"])

    assert len(client.get("/favorites", headers=registered_user["headers"]).json()) == 1


def test_unliking_removes_it(client, registered_user):
    """Tapping a filled heart takes the place back out."""
    destination_id = client.get("/destinations").json()[0]["id"]
    client.post(f"/favorites/{destination_id}", headers=registered_user["headers"])

    client.delete(f"/favorites/{destination_id}", headers=registered_user["headers"])

    assert client.get("/favorites", headers=registered_user["headers"]).json() == []


def test_cannot_favorite_something_that_does_not_exist(client, registered_user):
    """Guards against a typo or a stale id from an old bookmark."""
    response = client.post("/favorites/dest_imaginary", headers=registered_user["headers"])

    assert response.status_code == 404


def test_two_users_have_separate_favorites(client, registered_user):
    """PRIVACY: one user must never see another user's saved places.

    This is the sort of bug that is invisible with one test account and
    embarrassing in a demo, which is exactly why it deserves a test.
    """
    destination_id = client.get("/destinations").json()[0]["id"]
    client.post(f"/favorites/{destination_id}", headers=registered_user["headers"])

    # A second, completely separate account.
    other = client.post(
        "/auth/register",
        json={"name": "Other Person", "email": "other@example.cm", "password": "SuperSecret123"},
    ).json()
    other_headers = {"Authorization": f"Bearer {other['access_token']}"}

    assert client.get("/favorites", headers=other_headers).json() == []


# ----------------------------- itineraries ---------------------------------


def test_creating_an_itinerary(client, registered_user):
    """'Add to Itinerary' on the site page hits this endpoint."""
    destination = client.get("/destinations").json()[0]

    response = client.post(
        "/itineraries",
        headers=registered_user["headers"],
        json={
            "title": "My Yaounde day",
            "date": "2026-09-20",
            "stops": [{"destination_id": destination["id"], "order": 0}],
        },
    )

    assert response.status_code in (200, 201)
    assert response.json()["title"] == "My Yaounde day"


def test_listing_my_itineraries(client, registered_user):
    """After creating one, it must appear in the user's list."""
    destination_id = client.get("/destinations").json()[0]["id"]
    client.post(
        "/itineraries",
        headers=registered_user["headers"],
        json={
            "title": "Trip A",
            "date": "2026-09-21",
            "stops": [{"destination_id": destination_id, "order": 0}],
        },
    )

    itineraries = client.get("/itineraries", headers=registered_user["headers"]).json()

    assert len(itineraries) == 1
    assert itineraries[0]["title"] == "Trip A"


def test_itineraries_are_private_to_their_owner(client, registered_user):
    """Same privacy rule as favourites, for trip plans."""
    destination_id = client.get("/destinations").json()[0]["id"]
    client.post(
        "/itineraries",
        headers=registered_user["headers"],
        json={"title": "Private trip", "date": "2026-09-22",
              "stops": [{"destination_id": destination_id, "order": 0}]},
    )

    other = client.post(
        "/auth/register",
        json={"name": "Nosy", "email": "nosy@example.cm", "password": "SuperSecret123"},
    ).json()
    other_headers = {"Authorization": f"Bearer {other['access_token']}"}

    assert client.get("/itineraries", headers=other_headers).json() == []
