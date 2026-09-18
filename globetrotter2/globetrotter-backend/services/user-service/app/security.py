# =============================================================================
# security.py  -  USER SERVICE
#
# Identical job to the Phase 1 monolith's app/security.py: hash passwords,
# check passwords, create and read JWTs. See that file's comments for the
# full explanation of PBKDF2 vs bcrypt if you want the background.
#
# WHY THIS FILE IS DUPLICATED ACROSS SERVICES
# --------------------------------------------
# In a "real" microservices shop, this kind of shared code usually becomes
# its own small internal package that every service installs as a
# dependency. For a class project, that adds a publishing/versioning step
# that isn't worth it: instead, every service that needs to read a JWT
# (User, Itinerary, Recommendation, Chat) carries its OWN small copy of the
# "decode a token" logic. Only User Service can also CREATE tokens and hash
# passwords, because only User Service owns the users table.
#
# This is deliberate, not an oversight: each microservice should be able to
# be built, tested and deployed on its own, without importing code that
# lives inside a different service's folder. Copy-paste here buys
# independence. (If this were a bigger production system, the fix would be
# a published, versioned "auth" library - out of scope for this course.)
#
# WHY THE SECRET IS SHARED
# ------------------------
# All services read the SAME `GLOBETROTTER_JWT_SECRET` environment
# variable. That's what lets User Service create a token at login, and
# lets Itinerary/Recommendation/Chat Service verify that same token later,
# without ever calling User Service back to ask "is this token real?".
# This is a genuine simplification for the class project: a real system
# would rotate secrets, use asymmetric keys (so only User Service can SIGN
# and everyone else can only VERIFY), and hand out short-lived tokens.
# We use one shared symmetric secret and 7-day tokens instead, because it
# is far simpler to set up in Docker Compose and to explain in a report.
# =============================================================================

import hashlib
import hmac
import os
from datetime import datetime, timedelta, timezone

import jwt  # "pyjwt" package

JWT_SECRET = os.environ.get("GLOBETROTTER_JWT_SECRET", "change-this-secret-for-real-projects")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 24 * 7  # tokens stay valid for 7 days


# -----------------------------------------------------------------------------
# PASSWORD HASHING (only User Service ever does this - it's the only service
# that stores passwords)
# -----------------------------------------------------------------------------
def hash_password(plain_password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt, 100_000)
    return f"{salt.hex()}${digest.hex()}"


def verify_password(plain_password: str, stored_hash: str) -> bool:
    try:
        salt_hex, digest_hex = stored_hash.split("$")
    except ValueError:
        return False
    salt = bytes.fromhex(salt_hex)
    expected_digest = bytes.fromhex(digest_hex)
    actual_digest = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt, 100_000)
    return hmac.compare_digest(expected_digest, actual_digest)


# -----------------------------------------------------------------------------
# JWT (JSON WEB TOKEN)
# -----------------------------------------------------------------------------
def create_access_token(user_id: str, role: str = "user") -> str:
    """Creates a signed token carrying WHO (sub) and WHAT THEY'RE ALLOWED
    TO DO (role). Embedding role in the token itself (instead of only in
    the users table) is what lets Itinerary Service and the Gateway check
    "is this caller an admin?" purely by decoding the token - no network
    call back to User Service needed, same reasoning as everything else
    about stateless JWTs in this project (see app/deps.py).

    TRADE-OFF, STATED HONESTLY: if an admin is promoted or demoted (see
    _resolve_role() in routers/auth.py), that only takes effect the NEXT
    time they log in and get a fresh token - an already-issued token keeps
    whatever role it was signed with until it expires (up to 7 days). A
    production system would use much shorter-lived tokens for exactly
    this reason.
    """
    expire_at = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS)
    payload = {"sub": user_id, "role": role, "exp": expire_at}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict | None:
    """Reads a token and returns {"user_id":..., "role":...}, or None if
    the token is invalid, tampered with, or expired. `role` defaults to
    "user" for tokens minted before roles existed, so nothing breaks."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    return {"user_id": user_id, "role": payload.get("role", "user")}
