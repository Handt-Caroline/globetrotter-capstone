# =============================================================================
# tests/test_chat_proxy_race_condition.py  -  API GATEWAY
#
# Regresses a REAL bug found while manually verifying the chat feature:
# app/ws_proxy.py used to accept the browser's WebSocket connection BEFORE
# finishing its own outbound connection to Chat Service. That meant a
# client's `new WebSocket(url)` could resolve (the Gateway had accepted
# it) a few milliseconds before Chat Service had actually registered that
# connection for broadcasts (see chat-service/app/connections.py) - if a
# message arrived in that window, the newly-connected client silently
# never received it. No error anywhere; it just never showed up.
#
# THIS TEST USES REAL SOCKETS AGAINST A REAL, SEPARATELY-RUNNING GATEWAY
# PROCESS (see the `live_gateway` fixture) - NOT TestClient. TestClient's
# synchronous request/response bridging happens to add enough scheduling
# delay between operations that it never reproduced this race, even
# though the exact same buggy code was running underneath it - only real
# concurrent connections, with real network timing, exposed it. That's
# exactly why this one test is worth the extra subprocess.
# =============================================================================

import asyncio
import json

import httpx
import websockets


async def _two_person_broadcast_check(gateway_ws_url: str, gateway_http_url: str, user_service_url: str) -> None:
    async with httpx.AsyncClient() as client:
        alice = (
            await client.post(
                f"{gateway_http_url}/auth/register",
                json={"name": "Race Alice", "email": "race_alice@example.cm", "password": "SuperSecret123"},
            )
        ).json()
        bob = (
            await client.post(
                f"{gateway_http_url}/auth/register",
                json={"name": "Race Bob", "email": "race_bob@example.cm", "password": "SuperSecret123"},
            )
        ).json()
        alice_token = alice["access_token"]
        bob_token = bob["access_token"]
        bob_id = (
            await client.get(f"{gateway_http_url}/auth/me", headers={"Authorization": f"Bearer {bob_token}"})
        ).json()["id"]
        room = (
            await client.post(
                f"{gateway_http_url}/rooms/direct",
                json={"other_user_id": bob_id},
                headers={"Authorization": f"Bearer {alice_token}"},
            )
        ).json()

    room_id = room["id"]

    # Connect BOTH people through the real Gateway, one right after the
    # other - exactly the sequence that exposed the race: if Bob's
    # connection is only Gateway-accepted and not yet Chat-Service-
    # registered by the time Alice's message is broadcast, Bob misses it.
    alice_ws = await websockets.connect(f"{gateway_ws_url}/ws/{room_id}?token={alice_token}")
    bob_ws = await websockets.connect(f"{gateway_ws_url}/ws/{room_id}?token={bob_token}")

    try:
        await alice_ws.send(json.dumps({"type": "message", "text": "race condition check"}))

        alice_echo = json.loads(await asyncio.wait_for(alice_ws.recv(), timeout=5))
        bob_received = json.loads(await asyncio.wait_for(bob_ws.recv(), timeout=5))

        assert alice_echo["message"]["text"] == "race condition check"
        assert bob_received["message"]["text"] == "race condition check"
    finally:
        await alice_ws.close()
        await bob_ws.close()


def test_a_second_connection_never_misses_a_message_that_arrives_right_after_it_connects(live_gateway, live_services):
    asyncio.run(
        _two_person_broadcast_check(live_gateway["ws_url"], live_gateway["http_url"], live_services["user_url"])
    )
