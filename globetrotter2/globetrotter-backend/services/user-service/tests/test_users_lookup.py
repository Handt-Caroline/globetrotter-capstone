# =============================================================================
# tests/test_users_lookup.py  -  USER SERVICE
#
# GET /users/{id} and GET /users?ids=... are the endpoints OTHER services
# call over HTTP to resolve a user id into a display name (Chat Service uses
# this to label messages and group members - see chat-service/app/main.py's
# calls to USER_SERVICE_URL). These tests cover the contract those other
# services depend on: no auth required, never leaks email or password_hash.
# =============================================================================


def test_get_single_user_returns_id_and_name_only(client, registered_user):
    me = client.get("/auth/me", headers=registered_user["headers"]).json()

    response = client.get(f"/users/{me['id']}")

    assert response.status_code == 200
    assert response.json() == {"id": me["id"], "name": registered_user["name"]}


def test_get_single_user_needs_no_login(client, registered_user):
    """Other services calling this shouldn't have to juggle a token."""
    me = client.get("/auth/me", headers=registered_user["headers"]).json()

    response = client.get(f"/users/{me['id']}")  # no Authorization header at all

    assert response.status_code == 200


def test_unknown_user_id_is_a_404(client):
    response = client.get("/users/does-not-exist")
    assert response.status_code == 404


def test_batch_lookup_returns_only_known_ids(client, registered_user):
    me = client.get("/auth/me", headers=registered_user["headers"]).json()

    response = client.get(f"/users?ids={me['id']},nonexistent-id")

    assert response.status_code == 200
    body = response.json()
    assert body == [{"id": me["id"], "name": registered_user["name"]}]


def test_lookup_never_leaks_email_or_password_hash(client, registered_user):
    me = client.get("/auth/me", headers=registered_user["headers"]).json()

    response = client.get(f"/users/{me['id']}").json()

    assert "email" not in response
    assert "password_hash" not in response


# ---------------------------------------------------------------------------
# SEARCH - lets the Chat Service frontend's "start a new chat" screen find
# someone by name instead of needing their exact id.
# ---------------------------------------------------------------------------
def test_search_matches_a_substring_case_insensitively(client):
    client.post(
        "/auth/register",
        json={"name": "Handy Caroline", "email": "handy_search@example.cm", "password": "SuperSecret123"},
    )

    response = client.get("/users/search?q=caroline")
    assert response.status_code == 200
    names = [u["name"] for u in response.json()]
    assert "Handy Caroline" in names


def test_search_needs_no_login(client):
    response = client.get("/users/search?q=anything")
    assert response.status_code == 200


def test_search_with_no_matches_returns_an_empty_list(client):
    response = client.get("/users/search?q=zzzznobodyhasthisnamezzzz")
    assert response.json() == []


def test_search_respects_the_limit(client):
    for i in range(5):
        client.post(
            "/auth/register",
            json={"name": f"Search Target {i}", "email": f"search_target_{i}@example.cm", "password": "SuperSecret123"},
        )

    response = client.get("/users/search?q=Search Target&limit=2")
    assert len(response.json()) == 2


def test_search_never_leaks_email_or_password_hash(client):
    client.post(
        "/auth/register",
        json={"name": "Private Person", "email": "private@example.cm", "password": "SuperSecret123"},
    )
    results = client.get("/users/search?q=Private").json()
    assert results
    assert "email" not in results[0]
    assert "password_hash" not in results[0]


def test_search_does_not_treat_the_word_search_as_a_user_id(client):
    """Regression guard: /users/search must be matched by the search route,
    not swallowed by GET /users/{user_id} treating "search" as an id."""
    response = client.get("/users/search?q=x")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
