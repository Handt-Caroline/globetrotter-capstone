# =============================================================================
# security.py  -  ITINERARY SERVICE
#
# Unlike User Service, this service can only READ tokens, not create them -
# only User Service issues JWTs, at login. This file exists purely so
# get_current_user() (see deps.py) can check "is this a real, unexpired
# token, and whose user id is inside it?" without ever calling User Service
# over the network to ask.
#
# HOW THAT WORKS WITHOUT A NETWORK CALL
# ---------------------------------------
# A JWT is signed with a secret (GLOBETROTTER_JWT_SECRET) that every service
# in this project shares via the same environment variable (see
# docker-compose.yml). Because the signature can only have been produced by
# someone who knows that secret, any service that also knows the secret can
# verify a token is genuine on its own, entirely offline. This is the whole
# point of using JWTs for microservices: verification is "stateless" - it
# doesn't require asking the service that issued the token whether it's
# still good.
#
# THE TRADE-OFF, STATED HONESTLY
# --------------------------------
# Because this service never asks "does this user id still exist?", a user
# deleted from User Service would still be able to use itineraries/
# favorites/destinations with their existing token until it expires (up to
# 7 days). A production system would either use much shorter-lived tokens,
# or maintain a revocation list. For a class project this trade-off is
# fine and worth naming rather than hiding.
# =============================================================================

import os

import jwt  # "pyjwt" package

JWT_SECRET = os.environ.get("GLOBETROTTER_JWT_SECRET", "change-this-secret-for-real-projects")
JWT_ALGORITHM = "HS256"


def decode_access_token(token: str) -> dict | None:
    """Reads a token and returns {"user_id":..., "role":...}, or None if
    the token is invalid, tampered with, or expired.

    `role` ("user" or "admin") travels INSIDE the token itself, set by
    User Service at login (see user-service/app/security.py's
    create_access_token) - that's what lets this service decide "is this
    caller allowed to edit destinations directly?" without ever calling
    User Service to ask. Same stateless-JWT reasoning as the user id
    itself, and the same trade-off: a promotion/demotion only takes effect
    on that user's NEXT login, not immediately.
    """
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    return {"user_id": user_id, "role": payload.get("role", "user")}
