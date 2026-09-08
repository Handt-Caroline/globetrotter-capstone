# =============================================================================
# routers/auth.py
#
# Implements exactly the 3 auth calls your frontend already makes
# (see api/client.js):
#   POST /auth/register  -> api.register(name, email, password)
#   POST /auth/login     -> api.login(email, password)
#   GET  /auth/me         -> api.getMe()
# =============================================================================

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator

from app.deps import get_current_user
from app.security import create_access_token, hash_password, verify_password
from app.storage import new_id, read_db, update_db

router = APIRouter(prefix="/auth", tags=["auth"])


# --- Request/response "shapes". FastAPI uses these to validate incoming
# JSON automatically -- e.g. it will reject a register call with no email
# before our function body even runs. ---
#
# NOTE: We use a plain `str` for email + a small custom check below, instead
# of pydantic's built-in `EmailStr`. EmailStr needs an extra package
# (email-validator) installed - keeping this to plain `str` means one less
# thing that can go wrong when a classmate sets this project up for the
# first time.
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
    """Strips the password hash out before sending a user back to the
    frontend -- we never want to leak that, even hashed."""
    return {"id": user["id"], "name": user["name"], "email": user["email"]}


@router.post("/register", response_model=TokenResponse)
def register(payload: RegisterRequest):
    db = read_db()

    # Reject duplicate emails
    if any(u["email"].lower() == payload.email.lower() for u in db["users"]):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    new_user = {
        "id": new_id(),
        "name": payload.name,
        "email": payload.email,
        "password_hash": hash_password(payload.password),
    }

    def _create(db):
        db["users"].append(new_user)
        return new_user

    update_db(_create)

    token = create_access_token(new_user["id"])
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest):
    db = read_db()
    user = next((u for u in db["users"] if u["email"].lower() == payload.email.lower()), None)

    # Same error message whether the email doesn't exist or the password is
    # wrong -- this avoids telling attackers which emails are registered.
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    token = create_access_token(user["id"])
    return TokenResponse(access_token=token)


@router.get("/me")
def get_me(current_user: dict = Depends(get_current_user)):
    return _public_user(current_user)
