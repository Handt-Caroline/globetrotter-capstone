# =============================================================================
# chatlogic.py  -  shared by the REST routes AND the WebSocket route
#
# WHY THIS IS ITS OWN FILE
# ---------------------------
# A message can arrive two ways: POST /rooms/{id}/messages (a plain HTTP
# call - handy for testing, or a client that isn't using WebSockets), or a
# {"type":"message"} frame sent over an already-open WebSocket (what the
# real frontend does, for instant delivery). Both need to do the EXACT
# SAME THING once the text is in hand: save it, then push it to everyone
# currently connected to that room. Keeping that logic in one place means
# routers/rooms.py and ws.py can't quietly drift into two different
# behaviours for what is supposed to be one feature.
# =============================================================================

from datetime import datetime, timezone

from starlette.concurrency import run_in_threadpool

from app import connections
from app.storage import MAX_GROUP_MEMBERS, new_id, read_db, update_db
from app.user_lookup import fetch_user_names


def find_room(db: dict, room_id: str) -> dict | None:
    return next((r for r in db["rooms"] if r["id"] == room_id), None)


def is_member(room: dict, user_id: str) -> bool:
    return room["type"] == "public" or user_id in room["members"]


def room_display_name(room: dict, viewer_id: str, names_by_id: dict) -> str:
    """Group/public rooms already have a name. A 1-on-1 room doesn't - its
    "name", from any one viewer's point of view, is simply the OTHER
    person's name (resolved via User Service - see user_lookup.py)."""
    if room["name"]:
        return room["name"]
    other_id = next((m for m in room["members"] if m != viewer_id), None)
    return names_by_id.get(other_id, "Direct message")


async def post_message(room_id: str, user_id: str, text: str) -> dict:
    """Persists a message and broadcasts it to every live connection in
    the room. Returns the full stored message record. Callers (both the
    REST route and the WS route) are responsible for checking the room
    exists and the sender is actually a member BEFORE calling this.

    Both `fetch_user_names` (a real network call to User Service) and
    `update_db` (synchronous file I/O behind a lock - see storage.py) are
    genuinely blocking work. This function is on the hot path for every
    single chat message, awaited directly from the WebSocket receive loop
    (ws.py) - see user_lookup.py's module docstring for what went wrong
    the one time this blocked the event loop instead of yielding to it.
    `update_db` doesn't have an async version of its own (it's shared with
    every plain HTTP route in this service, which FastAPI already runs off
    the event loop in a threadpool), so it's pushed into a worker thread
    here explicitly with run_in_threadpool instead.
    """
    names = await fetch_user_names([user_id])
    message = {
        "id": new_id(),
        "room_id": room_id,
        "user_id": user_id,
        "user_name": names.get(user_id, "Traveller"),
        "text": text,
        "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }

    def _save(db):
        db["messages"].append(message)

    await run_in_threadpool(update_db, _save)
    await connections.broadcast(room_id, {"type": "message", "message": message})
    return message


async def start_call(room_id: str, started_by: str) -> str:
    """Generates a fresh Jitsi room name and tells everyone currently
    connected to this chat room that a call has started, so their client
    can open/join that Jitsi room. THIS SERVICE NEVER TOUCHES AUDIO OR
    VIDEO ITSELF - it only ever broadcasts this one small signal; the
    actual call happens entirely inside Jitsi Meet (self-hosted via
    Docker - see docker-compose.yml), which the frontend embeds/links to.
    A random suffix keeps different calls in the same chat room from
    colliding if one call starts right after another ends."""
    jitsi_room = f"globetrotter-{room_id}-{new_id()}"
    await connections.broadcast(
        room_id, {"type": "call_started", "jitsi_room": jitsi_room, "started_by": started_by}
    )
    return jitsi_room
