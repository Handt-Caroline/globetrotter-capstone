# =============================================================================
# tests/test_chat_proxy.py  -  API GATEWAY
#
# Proves the Gateway correctly proxies BOTH kinds of chat traffic to the
# real, live Chat Service subprocess (see tests/conftest.py):
#   - ordinary REST calls (room creation) via app/proxy.py's generic
#     register_proxy("/rooms", ...)
#   - the WebSocket itself via app/ws_proxy.py - a genuinely different
#     mechanism (an outbound connection the Gateway opens and pumps
#     messages through, not a single request/response)
#
# The WebSocket test below makes a REAL network connection from this
# Gateway process out to the real Chat Service process - nothing here is
# mocked or run in-process.
# =============================================================================

import httpx


def test_creating_a_room_through_the_gateway_reaches_chat_service(client, registered_user, live_services):
    """Register a second real user directly against User Service, then
    prove the Gateway's /rooms/direct call really landed on Chat Service
    by reading the room back directly from Chat Service too."""
    other = httpx.post(
        f"{live_services['user_url']}/auth/register",
        json={"name": "Chat Partner", "email": "chatpartner@example.cm", "password": "SuperSecret123"},
        timeout=5.0,
    ).json()
    other_id = httpx.get(
        f"{live_services['user_url']}/auth/me",
        headers={"Authorization": f"Bearer {other['access_token']}"},
        timeout=5.0,
    ).json()["id"]

    created = client.post(
        "/rooms/direct", json={"other_user_id": other_id}, headers=registered_user["headers"]
    )
    assert created.status_code == 201
    room = created.json()
    assert room["name"] == "Chat Partner"

    # Read the SAME room back directly from Chat Service, bypassing the
    # Gateway, to prove the write really happened there.
    direct = httpx.get(
        f"{live_services['chat_url']}/rooms/{room['id']}",
        headers=registered_user["headers"],
        timeout=5.0,
    )
    assert direct.status_code == 200
    assert direct.json()["id"] == room["id"]


def test_the_chat_websocket_is_proxied_end_to_end(client, registered_user):
    """Opens a REAL WebSocket to the Gateway, which opens its OWN real
    WebSocket to Chat Service (see app/ws_proxy.py) and pumps messages
    both ways. Sending "hello" on one connection and receiving it on
    another proves the whole round trip actually works, not just that a
    handshake succeeded."""
    token = registered_user["headers"]["Authorization"].split(" ", 1)[1]

    with client.websocket_connect(f"/ws/global?token={token}") as ws_one:
        with client.websocket_connect(f"/ws/global?token={token}") as ws_two:
            ws_one.send_json({"type": "message", "text": "hello through the gateway"})

            received_one = ws_one.receive_json()
            received_two = ws_two.receive_json()

    assert received_one["type"] == "message"
    assert received_one["message"]["text"] == "hello through the gateway"
    assert received_two["message"]["text"] == "hello through the gateway"
