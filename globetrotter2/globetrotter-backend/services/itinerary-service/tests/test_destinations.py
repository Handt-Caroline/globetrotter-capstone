# =============================================================================
# tests/test_destinations.py  -  browsing destinations (no login needed)
#
# Ported from the Phase 1 monolith's backend/tests/test_destinations.py -
# unchanged, since browsing rules didn't change when this moved into its
# own service.
# =============================================================================

from app.seed import SEED_DESTINATIONS


def test_listing_destinations_returns_the_seeded_data(client):
    response = client.get("/destinations")

    assert response.status_code == 200
    destinations = response.json()
    assert len(destinations) >= 20


def test_every_destination_has_the_fields_the_ui_needs(client):
    required_fields = [
        "id", "name", "category", "description", "history",
        "getting_there", "what_to_expect", "tips",
        "rating", "price_level", "price_range",
        "latitude", "longitude", "neighbourhood",
    ]

    for destination in client.get("/destinations").json():
        for field in required_fields:
            assert field in destination, f"{destination.get('name')} is missing '{field}'"


def test_prices_are_shown_in_fcfa():
    for destination in SEED_DESTINATIONS:
        price = destination["price_range"]
        assert "$" not in price
        assert "FCFA" in price or "Free" in price


def test_the_history_is_substantial():
    for destination in SEED_DESTINATIONS:
        assert len(destination["history"]) > 400, f"{destination['name']} has a thin history"


def test_coordinates_are_actually_in_the_yaounde_region():
    for destination in SEED_DESTINATIONS:
        assert 3.0 < destination["latitude"] < 5.0, destination["name"]
        assert 10.5 < destination["longitude"] < 12.5, destination["name"]


def test_filtering_by_category(client):
    response = client.get("/destinations", params={"category": "museums"})

    assert response.status_code == 200
    results = response.json()
    assert len(results) > 0
    assert all(d["category"] == "museums" for d in results)


def test_search_ignores_capital_letters(client):
    lower = client.get("/destinations", params={"search": "musée"}).json()
    upper = client.get("/destinations", params={"search": "MUSÉE"}).json()

    assert len(lower) > 0
    assert len(lower) == len(upper)


def test_categories_endpoint_lists_what_exists(client):
    categories = client.get("/destinations/categories").json()

    assert "museums" in categories
    assert "streetfood" in categories
    assert len(categories) == len(set(categories))


def test_fetching_one_destination_by_id(client):
    first = client.get("/destinations").json()[0]

    response = client.get(f"/destinations/{first['id']}")

    assert response.status_code == 200
    assert response.json()["name"] == first["name"]


def test_unknown_destination_id_returns_404(client):
    response = client.get("/destinations/dest_does_not_exist")

    assert response.status_code == 404
