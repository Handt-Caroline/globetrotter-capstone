# =============================================================================
# tests/test_destinations.py  -  browsing destinations (no login needed)
#
# These endpoints are public on purpose: you should be able to look around
# Yaounde before creating an account.
#
# Destinations are editable now (see test_destinations_crud.py), so the
# "content quality" checks below - substantial history, FCFA prices,
# coordinates near Yaounde - run against the SEED data itself rather than
# the live endpoint: a traveller is free to add a place with a one-line
# description, but the 28 the app ships with must still be a proper read.
# =============================================================================

from app.seed import SEED_DESTINATIONS


def test_listing_destinations_returns_the_seeded_data(client):
    """The app must never open on an empty screen - seed data guarantees
    there is always something to show on a fresh install."""
    response = client.get("/destinations")

    assert response.status_code == 200
    destinations = response.json()
    assert len(destinations) >= 20


def test_every_destination_has_the_fields_the_ui_needs(client):
    """If a field is missing the React app renders 'undefined' at the user.

    This test is a contract between backend and frontend: change the shape
    of the data and this test tells you immediately.
    """
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
    """Cameroon uses the CFA franc, so no dollar signs anywhere."""
    for destination in SEED_DESTINATIONS:
        price = destination["price_range"]
        assert "$" not in price
        # Either it's free, or the amount names the currency.
        assert "FCFA" in price or "Free" in price


def test_the_history_is_substantial():
    """The whole point of the app is storytelling, so a one-line blurb
    isn't good enough. Every seeded site needs a real read."""
    for destination in SEED_DESTINATIONS:
        assert len(destination["history"]) > 400, f"{destination['name']} has a thin history"


def test_coordinates_are_actually_in_the_yaounde_region():
    """A typo in a latitude would drop a pin in the ocean. Yaounde sits at
    roughly 3.87 N, 11.52 E, so we allow a generous box around it."""
    for destination in SEED_DESTINATIONS:
        assert 3.0 < destination["latitude"] < 5.0, destination["name"]
        assert 10.5 < destination["longitude"] < 12.5, destination["name"]


def test_filtering_by_category(client):
    """?category=museums must return only museums."""
    response = client.get("/destinations", params={"category": "museums"})

    assert response.status_code == 200
    results = response.json()
    assert len(results) > 0
    assert all(d["category"] == "museums" for d in results)


def test_search_ignores_capital_letters(client):
    """Users type however they like; search shouldn't punish them."""
    lower = client.get("/destinations", params={"search": "musée"}).json()
    upper = client.get("/destinations", params={"search": "MUSÉE"}).json()

    assert len(lower) > 0
    assert len(lower) == len(upper)


def test_categories_endpoint_lists_what_exists(client):
    """The frontend builds its filter chips from this list."""
    categories = client.get("/destinations/categories").json()

    assert "museums" in categories
    assert "streetfood" in categories
    # No duplicates - it should be a clean set of names.
    assert len(categories) == len(set(categories))


def test_fetching_one_destination_by_id(client):
    """Opening a place from the list must return that exact place."""
    first = client.get("/destinations").json()[0]

    response = client.get(f"/destinations/{first['id']}")

    assert response.status_code == 200
    assert response.json()["name"] == first["name"]


def test_unknown_destination_id_returns_404(client):
    """A wrong id must fail clearly rather than returning empty data."""
    response = client.get("/destinations/dest_does_not_exist")

    assert response.status_code == 404
