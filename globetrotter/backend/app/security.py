# =============================================================================
# security.py
#
# Everything related to "proving who you are":
#   1. Turning a plain-text password into something safe to store (hashing)
#   2. Checking a password attempt against that stored hash
#   3. Creating a JWT ("JSON Web Token") when someone logs in
#   4. Reading a JWT back out to figure out which user is making a request
#
# We are NOT using an external password-hashing library (like bcrypt) here
# on purpose -- installing bcrypt requires compiling native code, which can
# fail in some school lab environments. Instead we use Python's built-in
# `hashlib`, which ships with every Python install. It is not as strong as
# bcrypt, but it is perfectly fine for a class project.
# =============================================================================

import hashlib
import hmac
import os
import time
from datetime import datetime, timedelta, timezone

import jwt  # this is the "pyjwt" package

# -----------------------------------------------------------------------------
# Secret key used to "sign" our JWTs. Signing means: nobody can forge a token
# unless they also know this secret. In a REAL production app, this would
# come from an environment variable, never hard-coded. For a class project,
# a hard-coded value is fine.
# -----------------------------------------------------------------------------
JWT_SECRET = os.environ.get("GLOBETROTTER_JWT_SECRET", "change-this-secret-for-real-projects")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 24 * 7  # tokens stay valid for 7 days


# -----------------------------------------------------------------------------
# PASSWORD HASHING
# -----------------------------------------------------------------------------
def hash_password(plain_password: str) -> str:
    """
    Turns a plain password like "mypassword123" into a scrambled string that
    is safe to store in our JSON file. We use PBKDF2 (a standard, slow hashing
    algorithm designed to resist brute-force attacks) with a random "salt"
    so that two users with the same password don't get the same hash.
    """
    salt = os.urandom(16)  # 16 random bytes, different every time
    # 100_000 rounds makes brute-forcing slow on purpose.
    digest = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt, 100_000)
    # We store salt + hash together, separated by a "$", so we can verify later.
    return f"{salt.hex()}${digest.hex()}"


def verify_password(plain_password: str, stored_hash: str) -> bool:
    """
    Re-does the same hashing steps with the SAME salt that was stored, and
    checks whether the result matches. If it matches, the password is correct.
    """
    try:
        salt_hex, digest_hex = stored_hash.split("$")
    except ValueError:
        return False
    salt = bytes.fromhex(salt_hex)
    expected_digest = bytes.fromhex(digest_hex)
    actual_digest = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt, 100_000)
    # hmac.compare_digest avoids leaking timing information to attackers.
    return hmac.compare_digest(expected_digest, actual_digest)


# -----------------------------------------------------------------------------
# JWT (JSON WEB TOKEN)
# -----------------------------------------------------------------------------
def create_access_token(user_id: str) -> str:
    """
    Creates a signed token that encodes "this is user X, and this token
    expires at time Y". The frontend stores this token and sends it back
    on every request that needs to know who the user is (see api/client.js
    -> `Authorization: Bearer <token>`).
    """
    expire_at = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS)
    payload = {"sub": user_id, "exp": expire_at}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> str | None:
    """
    Reads a token and returns the user_id inside it ("sub" = "subject").
    Returns None if the token is invalid, tampered with, or expired.
    """
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload.get("sub")
    except jwt.PyJWTError:
        return None
