# =============================================================================
# tests/test_preferences.py  -  USER SERVICE
#
# Preferences moved here from the monolith's recommendations router (they're
# data ABOUT a user, so they belong with the users table). These tests cover
# the storage rules; recommendation-service/tests covers the SCORING that
# uses this data over HTTP.
# =============================================================================


def test_no_preferences_saved_yet_is_a_404(client, registered_user):
    response = client.get("/preferences", headers=registered_user["headers"])
    assert response.status_code == 404


def test_save_and_read_back_preferences(client, registered_user):
    payload = {"interests": ["Street Food", "Nature & Parks"], "pace": "Balanced", "budget": "₣₣"}

    saved = client.post("/preferences", json=payload, headers=registered_user["headers"])
    assert saved.status_code == 200
    assert saved.json() == payload

    fetched = client.get("/preferences", headers=registered_user["headers"])
    assert fetched.status_code == 200
    assert fetched.json() == payload


def test_preferences_require_login(client):
    response = client.get("/preferences")
    assert response.status_code in (401, 403)

    response = client.post(
        "/preferences",
        json={"interests": [], "pace": "Balanced", "budget": "₣"},
    )
    assert response.status_code in (401, 403)


def test_preferences_are_private_per_user(client, registered_user):
    """One user's saved interests must never leak into another user's GET."""
    client.post(
        "/preferences",
        json={"interests": ["Cafés"], "pace": "Relaxed", "budget": "₣"},
        headers=registered_user["headers"],
    )

    other = client.post(
        "/auth/register",
        json={"name": "Someone Else", "email": "someone_else@example.cm", "password": "AnotherSecret1"},
    )
    other_headers = {"Authorization": f"Bearer {other.json()['access_token']}"}

    response = client.get("/preferences", headers=other_headers)
    assert response.status_code == 404
