# =============================================================================
# tests/test_routing.py  -  API GATEWAY
#
# Proves the Gateway's one job: send each request to the correct real
# service, unchanged (including the Authorization header), and hand back
# whatever that service said. Every test here talks ONLY to the Gateway's
# TestClient (`client`) - never directly to a service - exactly like the
# frontend is supposed to. See tests/conftest.py for how the 3 real
# services get started.
# =============================================================================

import httpx


def test_gateway_health_check_needs_no_backend_services(client):
    """The Gateway's own /health is answered by the Gateway itself, not
    proxied anywhere - it should work even to just confirm the process
    is alive."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["service"] == "api-gateway"


def test_register_and_login_are_routed_to_user_service(client):
    """POST /auth/register through the GATEWAY must behave exactly like
    calling User Service directly - the frontend never knows the
    difference."""
    register = client.post(
        "/auth/register",
        json={"name": "Gateway Tester", "email": "gwtest@example.cm", "password": "SuperSecret123"},
    )
    assert register.status_code == 200, register.text
    assert "access_token" in register.json()

    login = client.post("/auth/login", json={"email": "gwtest@example.cm", "password": "SuperSecret123"})
    assert login.status_code == 200


def test_the_authorization_header_really_reaches_the_backend_service(client, registered_user):
    """If the Gateway silently dropped the Authorization header while
    proxying, this would come back 401 instead of 200."""
    response = client.get("/auth/me", headers=registered_user["headers"])
    assert response.status_code == 200
    assert response.json()["email"] == registered_user["email"]


def test_destinations_are_routed_to_itinerary_service(client):
    response = client.get("/destinations")
    assert response.status_code == 200
    assert len(response.json()) >= 20  # the seeded catalogue


def test_favorites_and_itineraries_are_routed_to_itinerary_service(client, registered_user):
    destination = client.get("/destinations").json()[0]

    add = client.post(f"/favorites/{destination['id']}", headers=registered_user["headers"])
    assert add.status_code == 204

    favorites = client.get("/favorites", headers=registered_user["headers"]).json()
    assert favorites[0]["id"] == destination["id"]

    created = client.post(
        "/itineraries",
        headers=registered_user["headers"],
        json={"title": "Gateway trip", "date": "2026-09-20", "stops": []},
    )
    assert created.status_code in (200, 201)


def test_recommendations_preferences_is_secretly_rewritten_to_user_service(client, registered_user, live_services):
    """The frontend calls /recommendations/preferences (unchanged since
    Phase 1) but the DATA has to land in User Service, since preferences
    are user data - see app/main.py's recommendations_sub(). We prove the
    rewrite really happened by reading the value back directly from User
    Service, bypassing the Gateway entirely."""
    saved = client.post(
        "/recommendations/preferences",
        headers=registered_user["headers"],
        json={"interests": ["Street Food"], "pace": "Balanced", "budget": "₣₣"},
    )
    assert saved.status_code == 200

    direct_from_user_service = httpx.get(
        f"{live_services['user_url']}/preferences", headers=registered_user["headers"], timeout=5.0
    )
    assert direct_from_user_service.status_code == 200
    assert direct_from_user_service.json()["interests"] == ["Street Food"]

    read_back_through_gateway = client.get("/recommendations/preferences", headers=registered_user["headers"])
    assert read_back_through_gateway.status_code == 200
    assert read_back_through_gateway.json()["interests"] == ["Street Food"]


def test_bare_recommendations_is_routed_to_recommendation_service(client, registered_user):
    """Bare GET /recommendations (no /preferences suffix) must go to
    Recommendation Service instead, which in turn calls User + Itinerary
    Service over its OWN HTTP calls - fully exercising the chain:
    browser -> Gateway -> Recommendation Service -> User/Itinerary Service."""
    client.post(
        "/recommendations/preferences",
        headers=registered_user["headers"],
        json={"interests": ["Museums & Heritage"], "pace": "Balanced", "budget": "₣₣"},
    )

    response = client.get("/recommendations", headers=registered_user["headers"])
    assert response.status_code == 200
    body = response.json()
    assert len(body) > 0
    assert "match_score" in body[0]


def test_an_unmatched_path_falls_through_to_the_frontend_catch_all(client):
    """A browser route like /login isn't any API prefix, so it must not
    404 - it should fall through to the SPA catch-all (index.html if
    frontend/dist was built, or the friendly "not built yet" JSON note
    otherwise - see the bottom of app/main.py)."""
    response = client.get("/login")
    assert response.status_code == 200
