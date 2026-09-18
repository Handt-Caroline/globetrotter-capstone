# =============================================================================
# ws.py  -  THE REAL-TIME SIDE: ws://.../ws/{room_id}?token=<JWT>
#
# WHY THE TOKEN IS A QUERY PARAMETER, NOT A HEADER
# ----------------------------------------------------
# Every other authenticated request in this project reads "Authorization:
# Bearer <token>". A browser's `new WebSocket(url)` constructor has no way
# to attach custom headers, though - it's a browser API limitation, not a
# choice we made. The standard workaround (used by pretty much every
# WebSocket-based chat app) is to put the token in the URL's query string
# instead: ws://host/ws/<room_id>?token=<jwt>. It's exactly as secure as a
# header would be here, since this whole project runs over plain HTTP/WS
# on localhost/one VM anyway (see the README for what a real deployment
# would add - TLS, i.e. wss://, at minimum).
#
# THE CONVERSATION, ONCE CONNECTED
# -------------------------------------
# The client can send two kinds of JSON frame:
#   {"type": "message", "text": "..."}   -> saved + broadcast to the room
#   {"type": "call_start"}               -> broadcasts "a call started
#                                            here, here's the Jitsi room"
#                                            to everyone else connected -
#                                            see chatlogic.start_call().
# Anything else (or invalid JSON) is just ignored - a class project chat
# doesn't need a strict wire protocol with error frames for malformed
# input, and silently ignoring garbage is safer than crashing the socket
# over one bad frame from one client.
# =============================================================================

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app import chatlogic, connections
from app.deps import decode_ws_token
from app.storage import read_db

router = APIRouter()


@router.websocket("/ws/{room_id}")
async def chat_websocket(websocket: WebSocket, room_id: str):
    token = websocket.query_params.get("token")
    claims = decode_ws_token(token)
    if not claims:
        await websocket.close(code=4401)  # 4401: custom "unauthorized" close code
        return

    db = read_db()
    room = chatlogic.find_room(db, room_id)
    if not room:
        await websocket.close(code=4404)
        return
    if not chatlogic.is_member(room, claims["id"]):
        await websocket.close(code=4403)
        return

    await websocket.accept()
    connections.add(room_id, websocket)

    try:
        while True:
            # A malformed frame (not valid JSON) must only skip THAT one
            # frame, not end the connection - so this inner try/except is
            # scoped to just the receive+parse, one loop iteration at a
            # time, with WebSocketDisconnect checked FIRST so a genuine
            # disconnect still ends the loop instead of being swallowed
            # and retried forever against an already-closed socket.
            try:
                frame = await websocket.receive_json()
            except WebSocketDisconnect:
                break
            except Exception:
                continue

            frame_type = frame.get("type")

            if frame_type == "message":
                text = str(frame.get("text", "")).strip()[:1000]
                if text:
                    await chatlogic.post_message(room_id, claims["id"], text)

            elif frame_type == "call_start":
                await chatlogic.start_call(room_id, claims["id"])

            # anything else: ignored, see the module docstring above
    finally:
        connections.remove(room_id, websocket)
