# =============================================================================
# deps.py
#
# A "dependency" that any protected route can request. FastAPI will run
# this automatically before the route's own code, pull the JWT out of the
# Authorization header, and hand back the matching user record. If the
# token is missing/invalid, it raises a 401 error before our route code
# ever runs -- so every protected route stays short and doesn't repeat
# this logic itself.
# =============================================================================

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.security import decode_access_token
from app.storage import read_db

# HTTPBearer reads the "Authorization: Bearer <token>" header for us.
# auto_error=True means it returns a 401 automatically if the header
# is missing entirely.
bearer_scheme = HTTPBearer(auto_error=True)


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)) -> dict:
    token = credentials.credentials  # the raw JWT string, without "Bearer "
    user_id = decode_access_token(token)
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    db = read_db()
    user = next((u for u in db["users"] if u["id"] == user_id), None)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User no longer exists")

    return user
