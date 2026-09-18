# =============================================================================
# security.py  -  CHAT SERVICE
#
# Same decode-only role as itinerary-service/app/security.py: only User
# Service creates a JWT (at login), this service just reads one to find
# out who's connecting - over a normal HTTP request OR a WebSocket
# handshake, both carry the same token. See that file's comments for the
# full explanation of stateless JWT verification and its trade-offs.
# =============================================================================

import os

import jwt  # "pyjwt" package

JWT_SECRET = os.environ.get("GLOBETROTTER_JWT_SECRET", "change-this-secret-for-real-projects")
JWT_ALGORITHM = "HS256"


def decode_access_token(token: str) -> dict | None:
    """Returns {"user_id":..., "role":...} or None if the token is
    invalid, tampered with, or expired."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    return {"user_id": user_id, "role": payload.get("role", "user")}
