# =============================================================================
# tests/test_favorites_and_itineraries.py  -  ITINERARY SERVICE
#
# Ported from the monolith. "A second user" now comes from auth_headers()
# (mints a token locally) instead of POST /auth/register, since that
# endpoint lives in User Service now - see tests/conftest.py.
# =============================================================================

from tests.conftest import auth_headers


def test_favorites_start_empty(client, registered_user):
    response = client.get("/favorites", headers=registered_user["headers"])

    assert response.status_code == 200
    assert response.json() == []


def test_favorites_require_login(client):
    response = client.get("/favorites")

    assert response.status_code in (401, 403)


def test_adding_a_favorite_then_reading_it_back(client, registered_user):
    destination = client.get("/destinations").json()[0]

    add = client.post(f"/favorites/{destination['id']}", headers=registered_user["headers"])
    assert add.status_code == 204

    favorites = client.get("/favorites", headers=registered_user["headers"]).json()
    assert len(favorites) == 1
    assert favorites[0]["name"] == destination["name"]
    assert "price_range" in favorites[0]


def test_liking_the_same_place_twice_does_not_duplicate_it(client, registered_user):
    destination_id = client.get("/destinations").json()[0]["id"]

    client.post(f"/favorites/{destination_id}", headers=registered_user["headers"])
    client.post(f"/favorites/{destination_id}", headers=registered_user["headers"])

    assert len(client.get("/favorites", headers=registered_user["headers"]).json()) == 1


def test_unliking_removes_it(client, registered_user):
    destination_id = client.get("/destinations").json()[0]["id"]
    client.post(f"/favorites/{destination_id}", headers=registered_user["headers"])

    client.delete(f"/favorites/{destination_id}", headers=registered_user["headers"])

    assert client.get("/favorites", headers=registered_user["headers"]).json() == []


def test_cannot_favorite_something_that_does_not_exist(client, registered_user):
    response = client.post("/favorites/dest_imaginary", headers=registered_user["headers"])

    assert response.status_code == 404


def test_two_users_have_separate_favorites(client, registered_user):
    destination_id = client.get("/destinations").json()[0]["id"]
    client.post(f"/favorites/{destination_id}", headers=registered_user["headers"])

    other_headers = auth_headers()  # a second, completely separate user

    assert client.get("/favorites", headers=other_headers).json() == []


# ----------------------------- itineraries ---------------------------------


def test_creating_an_itinerary(client, registered_user):
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
    destination_id = client.get("/destinations").json()[0]["id"]
    client.post(
        "/itineraries",
        headers=registered_user["headers"],
        json={"title": "Private trip", "date": "2026-09-22",
              "stops": [{"destination_id": destination_id, "order": 0}]},
    )

    other_headers = auth_headers()

    assert client.get("/itineraries", headers=other_headers).json() == []
