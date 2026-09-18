# =============================================================================
# connections.py  -  WHO'S CONNECTED, RIGHT NOW, TO WHICH ROOM
#
# WHY THIS IS IN-MEMORY (NOT IN storage.py's JSON FILE)
# ---------------------------------------------------------
# An open WebSocket connection is not a fact that outlives this process -
# if the server restarts, every connection drops and every browser
# reconnects anyway. So unlike rooms and messages (which must survive a
# restart), "which sockets are open right now" only ever needs to live in
# memory, for as long as this one process runs.
#
# THE HONEST LIMIT OF THIS APPROACH
# ------------------------------------
# This dict lives in ONE process's memory. If Chat Service ever ran as
# more than one instance behind a load balancer, a message sent to a
# connection on instance A would never reach a member connected to
# instance B - you'd need a shared pub/sub (e.g. Redis) for that. The
# assignment explicitly puts load balancing and caching infrastructure
# like that in a LATER phase, so a single Chat Service process (as this
# project runs it - see docker-compose.yml) is the right scope here, and
# this limitation is worth stating plainly rather than glossing over.
# =============================================================================

from collections import defaultdict

from fastapi import WebSocket

# room_id -> the set of live WebSocket connections currently in that room.
_room_sockets: dict[str, set[WebSocket]] = defaultdict(set)


def add(room_id: str, websocket: WebSocket) -> None:
    _room_sockets[room_id].add(websocket)


def remove(room_id: str, websocket: WebSocket) -> None:
    _room_sockets[room_id].discard(websocket)
    if not _room_sockets[room_id]:
        del _room_sockets[room_id]


def count(room_id: str) -> int:
    return len(_room_sockets.get(room_id, ()))


async def broadcast(room_id: str, payload: dict) -> None:
    """Sends `payload` as JSON to every socket currently connected to
    `room_id`. A socket that fails to receive it (already gone, but we
    haven't cleaned it up yet) is dropped instead of blowing up the whole
    broadcast for everyone else."""
    dead = []
    for socket in list(_room_sockets.get(room_id, ())):
        try:
            await socket.send_json(payload)
        except Exception:
            dead.append(socket)
    for socket in dead:
        remove(room_id, socket)
