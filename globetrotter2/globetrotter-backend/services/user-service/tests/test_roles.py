# =============================================================================
# tests/test_roles.py  -  USER SERVICE
#
# Covers who becomes an admin (ADMIN_EMAILS, see routers/auth.py's
# _resolve_role) and that the role travels correctly through registration,
# login, and the JWT itself (which is what lets Itinerary Service check
# roles without calling back here - see itinerary-service/app/security.py).
# =============================================================================

import jwt as pyjwt

from app.security import JWT_ALGORITHM, JWT_SECRET


def _decode(token: str) -> dict:
    return pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])


def test_a_regular_registration_gets_the_user_role(client):
    response = client.post(
        "/auth/register",
        json={"name": "Regular Traveller", "email": "regular@example.cm", "password": "SuperSecret123"},
    )
    assert response.status_code == 200
    token = response.json()["access_token"]
    assert _decode(token)["role"] == "user"

    me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.json()["role"] == "user"


def test_an_email_listed_in_admin_emails_registers_as_admin(client, monkeypatch):
    monkeypatch.setenv("ADMIN_EMAILS", "boss@example.cm, other@example.cm")

    response = client.post(
        "/auth/register",
        json={"name": "The Boss", "email": "boss@example.cm", "password": "SuperSecret123"},
    )
    token = response.json()["access_token"]
    assert _decode(token)["role"] == "admin"


def test_admin_emails_is_case_insensitive_and_comma_separated(client, monkeypatch):
    monkeypatch.setenv("ADMIN_EMAILS", "Boss@Example.CM")

    response = client.post(
        "/auth/register",
        json={"name": "The Boss", "email": "boss@example.cm", "password": "SuperSecret123"},
    )
    assert _decode(response.json()["access_token"])["role"] == "admin"


def test_role_is_reconciled_against_admin_emails_on_every_login(client, monkeypatch):
    """Adding/removing someone from ADMIN_EMAILS takes effect on their
    NEXT login - no manual data migration needed."""
    register = client.post(
        "/auth/register",
        json={"name": "Promotable", "email": "promoteme@example.cm", "password": "SuperSecret123"},
    )
    assert _decode(register.json()["access_token"])["role"] == "user"

    # Now they get added to the admin list...
    monkeypatch.setenv("ADMIN_EMAILS", "promoteme@example.cm")
    login = client.post(
        "/auth/login", json={"email": "promoteme@example.cm", "password": "SuperSecret123"}
    )
    assert _decode(login.json()["access_token"])["role"] == "admin"

    # ...and removed again.
    monkeypatch.setenv("ADMIN_EMAILS", "")
    second_login = client.post(
        "/auth/login", json={"email": "promoteme@example.cm", "password": "SuperSecret123"}
    )
    assert _decode(second_login.json()["access_token"])["role"] == "user"


def test_a_token_minted_before_roles_existed_defaults_to_user(client):
    """decode_access_token() must not crash on an old-shaped token that has
    no "role" claim at all - it should treat it as a regular user."""
    old_style_token = pyjwt.encode({"sub": "some-legacy-user-id"}, JWT_SECRET, algorithm=JWT_ALGORITHM)
    # This old token has no "exp", which our own decode doesn't require -
    # PyJWT only rejects expiry if the claim is present and in the past.
    response = client.get("/auth/me", headers={"Authorization": f"Bearer {old_style_token}"})
    # The user id in it doesn't exist in this test's fresh database, so we
    # only care that it does NOT crash with an unhandled exception - a
    # clean 401 ("user no longer exists") is the correct, safe outcome.
    assert response.status_code == 401
