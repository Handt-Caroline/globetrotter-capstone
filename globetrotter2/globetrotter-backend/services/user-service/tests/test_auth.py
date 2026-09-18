# =============================================================================
# tests/test_auth.py  -  USER SERVICE
#
# Ported straight from the Phase 1 monolith's backend/tests/test_auth.py -
# these rules didn't change when auth moved into its own service, so the
# tests that protect them shouldn't either.
# =============================================================================


def test_register_returns_a_token(client):
    response = client.post(
        "/auth/register",
        json={"name": "Handy Caroline", "email": "new@example.cm", "password": "SuperSecret123"},
    )

    assert response.status_code == 200
    body = response.json()
    assert "access_token" in body
    assert len(body["access_token"]) > 20


def test_cannot_register_the_same_email_twice(client):
    payload = {"name": "First", "email": "taken@example.cm", "password": "SuperSecret123"}
    client.post("/auth/register", json=payload)

    second_attempt = client.post("/auth/register", json=payload)

    assert second_attempt.status_code == 400


def test_login_works_with_correct_credentials(client, registered_user):
    response = client.post(
        "/auth/login",
        json={"email": registered_user["email"], "password": registered_user["password"]},
    )

    assert response.status_code == 200
    assert "access_token" in response.json()


def test_login_is_case_insensitive_about_email(client, registered_user):
    response = client.post(
        "/auth/login",
        json={"email": registered_user["email"].upper(), "password": registered_user["password"]},
    )

    assert response.status_code == 200


def test_login_fails_with_a_wrong_password(client, registered_user):
    response = client.post(
        "/auth/login",
        json={"email": registered_user["email"], "password": "definitely-not-it"},
    )

    assert response.status_code == 401


def test_wrong_password_and_unknown_email_give_the_same_message(client, registered_user):
    wrong_password = client.post(
        "/auth/login", json={"email": registered_user["email"], "password": "nope"}
    )
    unknown_email = client.post(
        "/auth/login", json={"email": "nobody@example.cm", "password": "nope"}
    )

    assert wrong_password.status_code == unknown_email.status_code == 401
    assert wrong_password.json()["detail"] == unknown_email.json()["detail"]


def test_me_returns_the_logged_in_user(client, registered_user):
    response = client.get("/auth/me", headers=registered_user["headers"])

    assert response.status_code == 200
    assert response.json()["email"] == registered_user["email"].lower()


def test_me_never_leaks_the_password_hash(client, registered_user):
    body = client.get("/auth/me", headers=registered_user["headers"]).json()

    assert "password_hash" not in body
    assert "password" not in body


def test_me_requires_a_token(client):
    response = client.get("/auth/me")

    assert response.status_code in (401, 403)


def test_a_made_up_token_is_rejected(client):
    response = client.get("/auth/me", headers={"Authorization": "Bearer not.a.real.token"})

    assert response.status_code == 401
