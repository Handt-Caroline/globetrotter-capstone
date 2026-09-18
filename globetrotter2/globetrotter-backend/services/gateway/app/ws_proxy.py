# =============================================================================
# ws_proxy.py  -  PROXYING A WEBSOCKET CONNECTION
#
# proxy.py's proxy_request() handles ordinary HTTP: one request in, one
# response out, done. A WebSocket is a single connection that stays open
# and carries many messages in BOTH directions for as long as the chat
# screen is open - there's no single "request" to forward. So instead,
# this file:
#
#   1. Accepts the browser's connection to the Gateway.
#   2. Opens a SECOND, separate WebSocket connection from the Gateway to
#      Chat Service, forwarding the same "?token=..." query string Chat
#      Service needs to identify who's connecting (see chat-service/app/
#      ws.py's module docstring for why the token is a query param).
#   3. Pumps every message the browser sends onward to Chat Service, and
#      every message Chat Service sends back onward to the browser - in
#      both directions, at the same time - until either side disconnects.
#
# The browser only ever sees ws://<gateway>/ws/<room_id> - it has no idea
# Chat Service exists on a different port/container. That's the same
# "frontend only talks to the Gateway" rule as every REST call, just
# applied to a WebSocket instead.
# =============================================================================

import asyncio

import websockets
from fastapi import WebSocket
from starlette.websockets import WebSocketDisconnect


def _as_ws_url(http_base_url: str) -> str:
    """Chat Service's own base URL is configured the same way every other
    service's is - as an http:// URL (see main.py's chat_service_url()).
    A WebSocket connection needs a ws:// URL instead; the host and port
    are identical, only the scheme changes."""
    if http_base_url.startswith("https://"):
        return "wss://" + http_base_url[len("https://") :]
    if http_base_url.startswith("http://"):
        return "ws://" + http_base_url[len("http://") :]
    return http_base_url  # already ws(s):// or something unexpected - pass through


async def proxy_websocket(client_ws: WebSocket, target_base_url: str, target_path: str) -> None:
    # THE ORDER HERE MATTERS - a real bug lived in getting it backwards.
    #
    # `query_params` is available the moment the connection request comes
    # in, before accepting it (same as on an HTTP Request) - so the
    # upstream connection to Chat Service is opened FIRST, and only once
    # THAT succeeds do we accept the browser's connection.
    #
    # Doing it the other way around (accept the browser first, connect
    # upstream after) opens a real race: the browser's `new WebSocket()`
    # resolves as soon as the GATEWAY accepts it, which is BEFORE Chat
    # Service has necessarily registered this connection for broadcasts
    # (see chat-service/app/connections.py). A second person joining the
    # same room right as a first message arrives could have their own
    # connection "open" from the browser's point of view while still
    # invisible to Chat Service's broadcast list for a few milliseconds -
    # long enough, under real conditions, to silently miss that message.
    # Connecting upstream before accepting the client closes that window:
    # by the time the browser sees "connected", Chat Service has already
    # run connections.add() for it (ws.py does that synchronously, with no
    # `await` in between, right after its own accept() completes).
    token = client_ws.query_params.get("token", "")
    upstream_url = f"{_as_ws_url(target_base_url)}{target_path}?token={token}"

    try:
        upstream = await websockets.connect(upstream_url)
    except Exception:
        # Chat Service rejected the handshake (bad token, unknown room,
        # not a member - see chat-service/app/ws.py) or isn't reachable at
        # all. Reject the browser's connection too, cleanly, instead of
        # accepting it and then immediately hanging up.
        await client_ws.close(code=1011)
        return

    await client_ws.accept()

    async def pump_client_to_upstream() -> None:
        while True:
            data = await client_ws.receive_text()
            await upstream.send(data)

    async def pump_upstream_to_client() -> None:
        async for message in upstream:
            await client_ws.send_text(message)

    forward_task = asyncio.create_task(pump_client_to_upstream())
    backward_task = asyncio.create_task(pump_upstream_to_client())

    try:
        # Whichever direction closes first (the browser navigated away, or
        # Chat Service dropped the connection) ends the whole proxy - the
        # other direction would otherwise sit there awaiting input forever.
        await asyncio.wait({forward_task, backward_task}, return_when=asyncio.FIRST_COMPLETED)
    except WebSocketDisconnect:
        pass
    finally:
        forward_task.cancel()
        backward_task.cancel()
        await upstream.close()
        try:
            await client_ws.close()
        except Exception:
            pass  # already closed on one side or the other
