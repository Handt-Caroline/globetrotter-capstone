# =============================================================================
# tests/test_google_signin.py  -  USER SERVICE
#
# These tests never talk to real Google servers - they monkeypatch
# app.routers.auth.verify_google_id_token, the one function that actually
# calls out to Google's key-verification library (see app/google_auth.py).
# That's the correct boundary to mock at: everything AFTER "we know this
# email is real" (find-or-create the account, issue our JWT, resolve the
# role) is our own code and gets exercised for real.
# =============================================================================

import jwt as pyjwt

from app.security import JWT_ALGORITHM, JWT_SECRET


def _mock_google(monkeypatch, email: str, name: str):
    monkeypatch.setattr(
        "app.routers.auth.verify_google_id_token", lambda token: (email, name)
    )


def _decode(token: str) -> dict:
    return pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])


def test_first_time_google_sign_in_creates_an_account(client, monkeypatch):
    _mock_google(monkeypatch, "newcomer@gmail.com", "New Comer")

    response = client.post("/auth/google", json={"id_token": "whatever-google-gave-the-browser"})
    assert response.status_code == 200
    token = response.json()["access_token"]
    assert _decode(token)["role"] == "user"

    me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.json()["name"] == "New Comer"
    assert me.json()["email"] == "newcomer@gmail.com"


def test_signing_in_with_google_again_reuses_the_same_account(client, monkeypatch):
    _mock_google(monkeypatch, "returning@gmail.com", "Returning Person")

    first = client.post("/auth/google", json={"id_token": "token-1"})
    second = client.post("/auth/google", json={"id_token": "token-2"})

    first_id = _decode(first.json()["access_token"])["sub"]
    second_id = _decode(second.json()["access_token"])["sub"]
    assert first_id == second_id


def test_google_account_email_matches_an_admin_email(client, monkeypatch):
    monkeypatch.setenv("ADMIN_EMAILS", "boss@gmail.com")
    _mock_google(monkeypatch, "boss@gmail.com", "The Boss")

    response = client.post("/auth/google", json={"id_token": "whatever"})
    assert _decode(response.json()["access_token"])["role"] == "admin"


def test_google_and_password_accounts_with_the_same_email_are_one_account(client, monkeypatch):
    """If someone registered with email+password first, then later signs
    in with Google using the same address, it should be recognised as the
    same person, not a duplicate account."""
    register = client.post(
        "/auth/register",
        json={"name": "Original Signup", "email": "same@example.cm", "password": "SuperSecret123"},
    )
    original_id = _decode(register.json()["access_token"])["sub"]

    _mock_google(monkeypatch, "same@example.cm", "Google Version Of Name")
    google_response = client.post("/auth/google", json={"id_token": "whatever"})
    google_id = _decode(google_response.json()["access_token"])["sub"]

    assert original_id == google_id


def test_a_google_only_account_cannot_be_logged_into_with_a_guessed_password(client, monkeypatch):
    """A Google-created account has no real password - a random one is
    hashed as a placeholder so this simply fails like any wrong password,
    rather than crashing or silently allowing anything in."""
    _mock_google(monkeypatch, "googleonly@example.cm", "Google Only")
    client.post("/auth/google", json={"id_token": "whatever"})

    response = client.post(
        "/auth/login", json={"email": "googleonly@example.cm", "password": "password123"}
    )
    assert response.status_code == 401


def test_a_forged_or_expired_google_token_is_rejected(client, monkeypatch):
    def _raise(token):
        from fastapi import HTTPException

        raise HTTPException(status_code=401, detail="Invalid Google token: fake failure")

    monkeypatch.setattr("app.routers.auth.verify_google_id_token", _raise)

    response = client.post("/auth/google", json={"id_token": "not-a-real-token"})
    assert response.status_code == 401


def test_google_sign_in_without_a_configured_client_id_gives_a_clear_error(client):
    """When GOOGLE_CLIENT_ID isn't set (the default for a fresh clone
    before anyone's plugged in their own OAuth Client ID), this must fail
    with a clear, honest message - not a confusing crash."""
    response = client.post("/auth/google", json={"id_token": "anything"})
    assert response.status_code == 503
    assert "GOOGLE_CLIENT_ID" in response.json()["detail"]
