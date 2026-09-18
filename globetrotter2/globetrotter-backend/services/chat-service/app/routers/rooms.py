# =============================================================================
# routers/rooms.py  -  REST side of the Chat Service
#
#   GET    /rooms                        -> your rooms (direct + group),
#                                            plus the shared public room
#   POST   /rooms/direct                 -> get-or-create a 1-on-1 room
#   POST   /rooms/group                  -> create a group room (<=100)
#   GET    /rooms/{id}                   -> one room's detail
#   POST   /rooms/{id}/members           -> add someone to a GROUP room
#   GET    /rooms/{id}/messages          -> history (public room: no login
#                                            needed to read, same rule the
#                                            Phase 1 Global Chat used)
#   POST   /rooms/{id}/messages          -> post one (login always needed)
#   DELETE /rooms/{id}/messages/{msg_id} -> remove your own message, or any
#                                            message if you're an admin
#   POST   /rooms/{id}/call/start        -> broadcast "a call started here"
#                                            (see app/chatlogic.py's
#                                            start_call - no audio/video
#                                            happens in this service)
#
# The actual real-time delivery is the WebSocket route in ws.py - these
# REST routes exist for room/membership management, loading history when
# a chat screen first opens, and as a working fallback for any client not
# using the WebSocket.
# =============================================================================

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from pydantic import BaseModel, Field

from app import chatlogic
from app.deps import get_current_user, get_current_user_optional
from app.storage import MAX_GROUP_MEMBERS, new_id, read_db, update_db
from app.user_lookup import fetch_user_names

router = APIRouter(prefix="/rooms", tags=["rooms"])


class CreateDirectRoomRequest(BaseModel):
    other_user_id: str


class CreateGroupRoomRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    member_ids: list[str] = Field(default_factory=list)


class AddMemberRequest(BaseModel):
    user_id: str


class PostMessageRequest(BaseModel):
    text: str = Field(min_length=1, max_length=1000)


def _public_room(room: dict, viewer_id: str, names_by_id: dict) -> dict:
    return {
        "id": room["id"],
        "type": room["type"],
        "name": chatlogic.room_display_name(room, viewer_id, names_by_id),
        "member_count": None if room["type"] == "public" else len(room["members"]),
    }


@router.get("")
async def list_my_rooms(current_user: dict = Depends(get_current_user)):
    db = read_db()
    mine = [r for r in db["rooms"] if r["type"] == "public" or current_user["id"] in r["members"]]

    # Resolve every direct room's OTHER member's name in one batch call,
    # not one call per room - see user_lookup.py.
    other_ids = {m for r in mine if r["type"] == "direct" for m in r["members"] if m != current_user["id"]}
    names_by_id = await fetch_user_names(list(other_ids))

    rooms_out = [_public_room(r, current_user["id"], names_by_id) for r in mine]

    # Most-recently-active room first, so the list reads like a real chat
    # app's - the last message in each room decides its position.
    last_message_at = {}
    for message in db["messages"]:
        last_message_at[message["room_id"]] = message["created_at"]
    rooms_out.sort(key=lambda r: last_message_at.get(r["id"], ""), reverse=True)

    return rooms_out


@router.post("/direct", status_code=status.HTTP_201_CREATED)
async def create_or_get_direct_room(payload: CreateDirectRoomRequest, current_user: dict = Depends(get_current_user)):
    other_id = payload.other_user_id
    if other_id == current_user["id"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Can't start a chat with yourself")

    names = await fetch_user_names([other_id])
    if other_id not in names:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="That user doesn't exist")

    db = read_db()
    wanted = {current_user["id"], other_id}
    existing = next((r for r in db["rooms"] if r["type"] == "direct" and set(r["members"]) == wanted), None)
    if existing:
        return _public_room(existing, current_user["id"], names)

    room = {
        "id": new_id(),
        "type": "direct",
        "name": None,
        "members": [current_user["id"], other_id],
        "created_by": current_user["id"],
        "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }

    def _create(db):
        db["rooms"].append(room)

    update_db(_create)
    return _public_room(room, current_user["id"], names)


@router.post("/group", status_code=status.HTTP_201_CREATED)
async def create_group_room(payload: CreateGroupRoomRequest, current_user: dict = Depends(get_current_user)):
    members = {current_user["id"], *payload.member_ids}
    if len(members) > MAX_GROUP_MEMBERS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A group can have at most {MAX_GROUP_MEMBERS} members",
        )

    other_ids = members - {current_user["id"]}
    found_names = await fetch_user_names(list(other_ids))
    missing = other_ids - set(found_names)
    if missing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Unknown user id(s): {', '.join(sorted(missing))}"
        )

    room = {
        "id": new_id(),
        "type": "group",
        "name": payload.name.strip(),
        "members": list(members),
        "created_by": current_user["id"],
        "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }

    def _create(db):
        db["rooms"].append(room)

    update_db(_create)
    return _public_room(room, current_user["id"], found_names)


@router.get("/{room_id}")
async def get_room(room_id: str, current_user: dict = Depends(get_current_user)):
    db = read_db()
    room = chatlogic.find_room(db, room_id)
    if not room or not chatlogic.is_member(room, current_user["id"]):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")

    names_by_id = await fetch_user_names(room["members"])
    return {
        **_public_room(room, current_user["id"], names_by_id),
        "members": [{"id": m, "name": names_by_id.get(m, "Traveller")} for m in room["members"]],
    }


@router.post("/{room_id}/members", status_code=status.HTTP_201_CREATED)
async def add_member(room_id: str, payload: AddMemberRequest, current_user: dict = Depends(get_current_user)):
    db = read_db()
    room = chatlogic.find_room(db, room_id)
    if not room or not chatlogic.is_member(room, current_user["id"]):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")
    if room["type"] != "group":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only group rooms have addable members")
    if len(room["members"]) >= MAX_GROUP_MEMBERS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"This group is already at the {MAX_GROUP_MEMBERS}-member limit",
        )
    if payload.user_id not in await fetch_user_names([payload.user_id]):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="That user doesn't exist")

    def _add(db):
        stored_room = chatlogic.find_room(db, room_id)
        if payload.user_id not in stored_room["members"]:
            stored_room["members"].append(payload.user_id)
        return stored_room

    updated = update_db(_add)
    return _public_room(updated, current_user["id"], await fetch_user_names(updated["members"]))


@router.get("/{room_id}/messages")
def read_messages(
    room_id: str,
    since: str | None = Query(default=None, description="Return only messages after this message id"),
    limit: int = Query(default=100, ge=1, le=200),
    authorization: str | None = Header(default=None),
):
    """The public room can be read with no login (same rule the Phase 1
    monolith's Global Chat used); every other room needs you to actually
    be a member. Because that decision depends on the ROOM (which we only
    know once we've looked it up), auth is checked here manually with
    get_current_user_optional instead of a Depends() that would always
    demand a token."""
    db = read_db()
    room = chatlogic.find_room(db, room_id)
    if not room:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")

    if room["type"] != "public":
        current_user = get_current_user_optional(authorization)
        if not current_user or not chatlogic.is_member(room, current_user["id"]):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="You're not in this room")

    messages = [m for m in db["messages"] if m["room_id"] == room_id]
    if since:
        for index, message in enumerate(messages):
            if message["id"] == since:
                return messages[index + 1 :]
    return messages[-limit:]


@router.post("/{room_id}/messages", status_code=status.HTTP_201_CREATED)
async def post_message(room_id: str, payload: PostMessageRequest, current_user: dict = Depends(get_current_user)):
    db = read_db()
    room = chatlogic.find_room(db, room_id)
    if not room:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")
    if not chatlogic.is_member(room, current_user["id"]):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You're not in this room")

    return await chatlogic.post_message(room_id, current_user["id"], payload.text.strip())


@router.delete("/{room_id}/messages/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_message(room_id: str, message_id: str, current_user: dict = Depends(get_current_user)):
    db = read_db()
    message = next((m for m in db["messages"] if m["id"] == message_id and m["room_id"] == room_id), None)
    if not message:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
    if message["user_id"] != current_user["id"] and current_user["role"] != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only delete your own message")

    def _delete(db):
        db["messages"] = [m for m in db["messages"] if m["id"] != message_id]

    update_db(_delete)
    return None


@router.post("/{room_id}/call/start")
async def start_call(room_id: str, current_user: dict = Depends(get_current_user)):
    db = read_db()
    room = chatlogic.find_room(db, room_id)
    if not room or not chatlogic.is_member(room, current_user["id"]):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")

    jitsi_room = await chatlogic.start_call(room_id, current_user["id"])
    return {"jitsi_room": jitsi_room}
