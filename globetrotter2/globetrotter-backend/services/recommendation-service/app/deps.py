# =============================================================================
# deps.py  -  RECOMMENDATION SERVICE
#
# require_auth() checks the caller's JWT is valid (so we fail fast with a
# clean 401 instead of a confusing error later), and then hands back the
# EXACT "Authorization: Bearer ..." header string so main.py can forward it,
# unchanged, to User Service's GET /preferences. That forwarded header is
# what lets User Service know whose preferences to return, without this
# service ever needing its own copy of the users table.
# =============================================================================

from fastapi import Header, HTTPException, status

from app.security import decode_access_token


def require_auth(authorization: str = Header(...)) -> str:
    if not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authorization header")

    token = authorization.split(" ", 1)[1].strip()
    if not decode_access_token(token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    return authorization  # forward this exact header value to User Service
