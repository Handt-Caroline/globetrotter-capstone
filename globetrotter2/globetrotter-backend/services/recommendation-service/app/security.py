# =============================================================================
# security.py  -  RECOMMENDATION SERVICE
#
# Same decode-only role as itinerary-service/app/security.py: this service
# never creates a JWT (only User Service does), it just needs to check
# "is the caller's token real?" before doing any work. See that file's
# comments for the full explanation of stateless JWT verification.
# =============================================================================

import os

import jwt  # "pyjwt" package

JWT_SECRET = os.environ.get("GLOBETROTTER_JWT_SECRET", "change-this-secret-for-real-projects")
JWT_ALGORITHM = "HS256"


def decode_access_token(token: str) -> str | None:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload.get("sub")
    except jwt.PyJWTError:
        return None
