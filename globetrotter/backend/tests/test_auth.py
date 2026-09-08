# =============================================================================
# tests/test_auth.py  -  registration, login and the JWT token
#
# HOW TO READ A TEST
# ------------------
# Every test follows the same three beats, often called Arrange-Act-Assert:
#
#   1. Arrange - set up whatever the test needs.
#   2. Act     - do the one thing you are testing.
#   3. Assert  - state what MUST be true. If it isn't, the test fails.
#
# A test name should read like a sentence describing the rule it protects,
# so that when it fails you already know what broke.
# =============================================================================


def test_register_returns_a_token(client):
    """A brand-new user can sign up and is logged in immediately."""
    response = client.post(
        "/auth/register",
        json={"name": "Handy Caroline", "email": "new@example.cm", "password": "SuperSecret123"},
    )

    assert response.status_code == 200
    body = response.json()
    # The token is what the frontend stores and sends on later requests.
    assert "access_token" in body
    assert len(body["access_token"]) > 20


def test_cannot_register_the_same_email_twice(client):
    """Emails must be unique, otherwise two people could own one account."""
    payload = {"name": "First", "email": "taken@example.cm", "password": "SuperSecret123"}
    client.post("/auth/register", json=payload)

    second_attempt = client.post("/auth/register", json=payload)

    assert second_attempt.status_code == 400


def test_login_works_with_correct_credentials(client, registered_user):
    """The happy path: right email, right password, you get a token."""
    response = client.post(
        "/auth/login",
        json={"email": registered_user["email"], "password": registered_user["password"]},
    )

    assert response.status_code == 200
    assert "access_token" in response.json()


def test_login_is_case_insensitive_about_email(client, registered_user):
    """Typing HANDY@Example.CM should still log you in - people's phones
    capitalise the first letter of an email all the time."""
    response = client.post(
        "/auth/login",
        json={"email": registered_user["email"].upper(), "password": registered_user["password"]},
    )

    assert response.status_code == 200


def test_login_fails_with_a_wrong_password(client, registered_user):
    """Wrong password must be rejected with 401 Unauthorized."""
    response = client.post(
        "/auth/login",
        json={"email": registered_user["email"], "password": "definitely-not-it"},
    )

    assert response.status_code == 401


def test_wrong_password_and_unknown_email_give_the_same_message(client, registered_user):
    """SECURITY: the error must not reveal whether an email is registered.

    If "unknown email" and "wrong password" produced different messages, an
    attacker could type emails one by one and learn which ones have accounts
    here - that's called user enumeration. Both replies must be identical.
    """
    wrong_password = client.post(
        "/auth/login", json={"email": registered_user["email"], "password": "nope"}
    )
    unknown_email = client.post(
        "/auth/login", json={"email": "nobody@example.cm", "password": "nope"}
    )

    assert wrong_password.status_code == unknown_email.status_code == 401
    assert wrong_password.json()["detail"] == unknown_email.json()["detail"]


def test_me_returns_the_logged_in_user(client, registered_user):
    """GET /auth/me tells the frontend who the token belongs to."""
    response = client.get("/auth/me", headers=registered_user["headers"])

    assert response.status_code == 200
    assert response.json()["email"] == registered_user["email"].lower()


def test_me_never_leaks_the_password_hash(client, registered_user):
    """Even the hashed password must never leave the server."""
    body = client.get("/auth/me", headers=registered_user["headers"]).json()

    assert "password_hash" not in body
    assert "password" not in body


def test_me_requires_a_token(client):
    """No token, no personal data."""
    response = client.get("/auth/me")

    assert response.status_code in (401, 403)


def test_a_made_up_token_is_rejected(client):
    """A forged token must not be accepted - this is the whole point of
    signing the JWT with a secret key."""
    response = client.get("/auth/me", headers={"Authorization": "Bearer not.a.real.token"})

    assert response.status_code == 401
