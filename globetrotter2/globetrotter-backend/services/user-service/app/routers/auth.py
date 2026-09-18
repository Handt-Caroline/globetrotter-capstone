# =============================================================================
# routers/auth.py  -  USER SERVICE
#
# POST /auth/register  -> create an account, returns a JWT
# POST /auth/login      -> check credentials, returns a JWT
# POST /auth/google     -> sign in (or silently register) with a Google
#                          account instead, returns the SAME kind of JWT
# GET  /auth/me         -> who does this token belong to?
#
# The first, second and fourth are word-for-word the same endpoints the
# Phase 1 monolith exposed at the same paths, so the API Gateway can route
# "/auth/*" straight through to this service with no path rewriting, and
# the frontend needed ZERO code changes for login/register/me to keep
# working. /auth/google is new (see app/google_auth.py for how a Google
# token is actually verified) but returns the exact same {access_token}
# shape, so nothing downstream of login needs to know or care which way
# someone signed in.
# =============================================================================

import os

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator

from app.deps import get_current_user
from app.google_auth import verify_google_id_token
from app.security import create_access_token, hash_password, verify_password
from app.storage import new_id, read_db, update_db

router = APIRouter(prefix="/auth", tags=["auth"])


# -----------------------------------------------------------------------------
# WHO'S AN ADMIN?
#
# For a class project, the simplest honest answer is: whoever's email is
# listed in the ADMIN_EMAILS environment variable (comma-separated - see
# docker-compose.yml). No separate "promote to admin" endpoint, no manual
# editing of user_db.json needed - just add an email to that one setting
# and the NEXT time that person registers or logs in, they become an
# admin. Removing an email from the list demotes them back to a regular
# user on their next login, the same way. This is deliberately simple:
# a real product would have an actual admin-management UI instead of an
# environment variable.
# -----------------------------------------------------------------------------
def _resolve_role(email: str) -> str:
    admin_emails = {
        e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "").split(",") if e.strip()
    }
    return "admin" if email.lower() in admin_emails else "user"


def _looks_like_email(value: str) -> str:
    if "@" not in value or "." not in value.split("@")[-1]:
        raise ValueError("Please enter a valid email address")
    return value


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return _looks_like_email(value)


class LoginRequest(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return _looks_like_email(value)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


def _public_user(user: dict) -> dict:
    """Never send the password hash back to a client, even hashed."""
    return {"id": user["id"], "name": user["name"], "email": user["email"], "role": user.get("role", "user")}


@router.post("/register", response_model=TokenResponse)
def register(payload: RegisterRequest):
    db = read_db()

    if any(u["email"].lower() == payload.email.lower() for u in db["users"]):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    role = _resolve_role(payload.email)
    new_user = {
        "id": new_id(),
        "name": payload.name,
        "email": payload.email,
        "password_hash": hash_password(payload.password),
        "role": role,
    }

    def _create(db):
        db["users"].append(new_user)
        return new_user

    update_db(_create)

    token = create_access_token(new_user["id"], role)
    return TokenResponse(access_token=token)


def _issue_token_for(user: dict) -> str:
    """Shared by password login AND Google sign-in: re-check ADMIN_EMAILS
    on every sign-in (so adding/removing someone from that setting takes
    effect next time, without any manual data migration), then mint a
    token carrying whatever role that resolved to."""
    role = _resolve_role(user["email"])
    if user.get("role") != role:
        def _update_role(db):
            for stored in db["users"]:
                if stored["id"] == user["id"]:
                    stored["role"] = role

        update_db(_update_role)

    return create_access_token(user["id"], role)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest):
    db = read_db()
    user = next((u for u in db["users"] if u["email"].lower() == payload.email.lower()), None)

    # Same error whether the email doesn't exist or the password is wrong,
    # so we don't tell an attacker which emails are registered.
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    return TokenResponse(access_token=_issue_token_for(user))


class GoogleSignInRequest(BaseModel):
    id_token: str


@router.post("/google", response_model=TokenResponse)
def google_sign_in(payload: GoogleSignInRequest):
    """The frontend already did the actual Google sign-in (see the
    "Sign in with Google" button on Login.jsx) and just hands us the ID
    token Google gave it. We verify it's real (app/google_auth.py), then
    either find the matching account by email or - since this is someone's
    FIRST time using Google to sign in here - quietly create one. Either
    way we hand back our own JWT, exactly like /login does, so the rest
    of the app never needs to know someone came in through Google."""
    email, name = verify_google_id_token(payload.id_token)

    db = read_db()
    user = next((u for u in db["users"] if u["email"].lower() == email.lower()), None)

    if not user:
        user = {
            "id": new_id(),
            "name": name,
            "email": email,
            # A Google account never sets a password here. Hashing a
            # random, un-guessable placeholder (instead of leaving this
            # None) means email/password login for this account just
            # fails verify_password() normally - no special-casing needed
            # anywhere else that reads password_hash.
            "password_hash": hash_password(new_id() + new_id()),
            "role": _resolve_role(email),
        }

        def _create(db):
            db["users"].append(user)

        update_db(_create)

    return TokenResponse(access_token=_issue_token_for(user))


@router.get("/me")
def get_me(current_user: dict = Depends(get_current_user)):
    return _public_user(current_user)
