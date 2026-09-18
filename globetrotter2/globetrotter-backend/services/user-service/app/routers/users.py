# =============================================================================
# routers/users.py  -  USER SERVICE
#
# GET /users/{user_id}     -> {id, name} for ONE user (404 if unknown)
# GET /users?ids=a,b,c     -> {id, name} for SEVERAL users at once
# GET /users/search?q=...  -> {id, name} for anyone whose name CONTAINS q
#                              (case-insensitive) - lets the Chat Service
#                              frontend's "start a new chat" screen find
#                              someone by typing their name, instead of
#                              needing to already know their exact id.
#
# WHO CALLS THIS, AND WHY IT EXISTS
# -----------------------------------
# This is an "internal" lookup other services use over HTTP because they do
# NOT have their own copy of the users table (only User Service does):
#
#   - Chat Service needs a display name to attach to every message, and a
#     name for every member of a group chat. Rather than trusting whatever
#     name the frontend sends with a message (which anyone could fake by
#     editing the request), Chat Service asks User Service "what is this
#     id's name?" and stamps that onto the message itself. This is exactly
#     the kind of "service A calls service B over REST" the assignment asks
#     for, just for the chat feature instead of recommendations.
#
# WHY NO AUTH ON THIS ONE
# ------------------------
# It only ever returns a name and an id - never an email or password hash -
# so there is nothing here worth protecting behind a login. Keeping it
# public also means Chat Service doesn't need to juggle whose JWT to send
# when resolving a group's member list.
# =============================================================================

from fastapi import APIRouter, HTTPException, Query, status

from app.storage import read_db

router = APIRouter(prefix="/users", tags=["users"])


def _public(user: dict) -> dict:
    return {"id": user["id"], "name": user["name"]}


@router.get("")
def list_users_by_ids(ids: str = Query(..., description="Comma-separated user ids")):
    """Batch lookup, e.g. GET /users?ids=abc123,def456 - used when Chat
    Service needs to show names for every member of a group at once,
    instead of making one request per member."""
    wanted = {i for i in ids.split(",") if i}
    db = read_db()
    return [_public(u) for u in db["users"] if u["id"] in wanted]


# NOTE: "/search" must be declared BEFORE "/{user_id}" below, otherwise
# FastAPI would treat "search" as someone's user id (same reasoning as
# "/categories" before "/{destination_id}" in destinations.py).
@router.get("/search")
def search_users(
    q: str = Query(min_length=1, max_length=100),
    limit: int = Query(default=20, ge=1, le=50),
):
    needle = q.strip().lower()
    if not needle:
        return []
    db = read_db()
    matches = [u for u in db["users"] if needle in u["name"].lower()]
    return [_public(u) for u in matches[:limit]]


@router.get("/{user_id}")
def get_user(user_id: str):
    db = read_db()
    user = next((u for u in db["users"] if u["id"] == user_id), None)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return _public(user)
