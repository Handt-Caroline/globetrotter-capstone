# =============================================================================
# security.py  -  API GATEWAY
#
# The Gateway is supposed to be "dumb" (see proxy.py's module docstring) -
# it forwards the Authorization header, it doesn't interpret it. This file
# is the ONE deliberate exception: GET/POST /metrics reveals internal
# request timings, which the roles feature says should be admin-only (see
# main.py's get_metrics). Checking "is this caller an admin" is still just
# reading a claim off an already-signed token - it is NOT business logic
# about users, destinations, or anything a real service owns - so it's a
# reasonable, minimal thing for a gateway to gate on directly, the same way
# a real API gateway product (Kong, AWS API Gateway, ...) commonly does
# authentication/authorization at the edge.
# =============================================================================

import os

import jwt  # "pyjwt" package
from fastapi import Header, HTTPException, status

JWT_SECRET = os.environ.get("GLOBETROTTER_JWT_SECRET", "change-this-secret-for-real-projects")
JWT_ALGORITHM = "HS256"


def require_admin(authorization: str = Header(...)) -> None:
    if not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authorization header")

    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    if payload.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
