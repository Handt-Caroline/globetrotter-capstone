# =============================================================================
# deps.py  -  "who is making this request?"
#
# Same idea as the monolith's app/deps.py: a FastAPI dependency that reads
# the "Authorization: Bearer <token>" header, decodes the JWT, and looks the
# user up. Because User Service is the ONLY service that owns the users
# table, it is also the only service that can (and should) double-check the
# user still actually exists - see app/deps.py in itinerary-service/
# recommendation-service/chat-service for the lighter, "trust the token"
# version those services use instead.
# =============================================================================

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.security import decode_access_token
from app.storage import read_db

bearer_scheme = HTTPBearer(auto_error=True)


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)) -> dict:
    token = credentials.credentials
    claims = decode_access_token(token)
    if not claims:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    db = read_db()
    user = next((u for u in db["users"] if u["id"] == claims["user_id"]), None)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User no longer exists")

    return user


def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    """Same as get_current_user, but also rejects anyone whose CURRENT
    role (looked up fresh from the users table, not just the token) isn't
    "admin". Used to protect the few User Service endpoints that shouldn't
    exist for regular travellers (there are none yet, but Itinerary
    Service's admin-only routes use the token-only version of this same
    check - see itinerary-service/app/deps.py - since it has no users
    table to look the fresh role up in)."""
    if current_user.get("role", "user") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user
