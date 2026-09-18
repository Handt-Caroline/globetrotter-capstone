# =============================================================================
# deps.py  -  CHAT SERVICE
#
# get_current_user works for ordinary HTTP routes (reads the standard
# "Authorization: Bearer ..." header via FastAPI's HTTPBearer). WebSocket
# connections can't easily send custom headers from browser JavaScript
# (`new WebSocket(url)` takes no headers argument), so the frontend passes
# the same JWT as a query string instead - decode_ws_token() below handles
# that second case. Same token, same secret, just read from a different
# place depending on which kind of connection it is.
# =============================================================================

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.security import decode_access_token

bearer_scheme = HTTPBearer(auto_error=True)


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)) -> dict:
    claims = decode_access_token(credentials.credentials)
    if not claims:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    return {"id": claims["user_id"], "role": claims["role"]}


def get_current_user_optional(authorization: str | None = None) -> dict | None:
    """Used where a public room can be read without logging in, but a
    logged-in caller should still be recognised (e.g. so their own
    messages could one day be highlighted). Returns None instead of
    raising when there's no/invalid token."""
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    claims = decode_access_token(authorization.split(" ", 1)[1].strip())
    if not claims:
        return None
    return {"id": claims["user_id"], "role": claims["role"]}


def decode_ws_token(token: str | None) -> dict | None:
    """Same idea as get_current_user, for a WebSocket's query-string token
    instead of a header. Returns None (never raises) - the WS route
    decides what to do (usually: close the connection with a clear code)."""
    if not token:
        return None
    claims = decode_access_token(token)
    if not claims:
        return None
    return {"id": claims["user_id"], "role": claims["role"]}
