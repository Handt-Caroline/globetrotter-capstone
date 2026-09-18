# =============================================================================
# deps.py  -  ITINERARY SERVICE
#
# Lighter than User Service's version of this file: we only DECODE the
# token to get a user id out of it. We do NOT look the user up anywhere,
# because this service has no users table - that lives in User Service. See
# security.py in this same folder for the full reasoning.
#
# Every router in this service that needs to know "whose itinerary/favorite
# is this" depends on get_current_user() and reads current_user["id"] -
# same shape as the monolith used, just without "name"/"email" attached,
# since we simply don't have those here.
# =============================================================================

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.security import decode_access_token

bearer_scheme = HTTPBearer(auto_error=True)


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)) -> dict:
    token = credentials.credentials
    claims = decode_access_token(token)
    if not claims:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    return {"id": claims["user_id"], "role": claims["role"]}


def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    """Guards the destination-editing routes that regular travellers must
    no longer use directly (see routers/destinations.py and the new
    routers/destination_requests.py). Reads `role` straight off the
    already-decoded token - see app/security.py for why that's enough,
    without a lookup anywhere."""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user
