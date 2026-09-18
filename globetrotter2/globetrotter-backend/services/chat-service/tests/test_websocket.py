# =============================================================================
# tests/test_websocket.py  -  CHAT SERVICE (real-time side)
#
# TestClient's websocket_connect() runs the REAL ASGI app (this service's
# actual routing, auth, and broadcast code) against a REAL WebSocket
# handshake - just over an in-process transport instead of a real TCP
# socket, so these are genuine tests of the live protocol, not mocks of it.
#
# THE 100-MEMBER TEST AT THE BOTTOM IS THE ONE THAT MATTERS MOST HERE: the
# assignment specifically requires groups to support up to 100 members
# over WebSocket (not a mesh of direct peer connections - see the calls
# feature's docstring in chatlogic.py for why that distinction exists).
# This test opens 100 SIMULTANEOUS real WebSocket connections to one
# group room and proves a single message reaches every one of them.
# =============================================================================

from contextlib import ExitStack

import pytest

from tests.conftest import make_token, make_user


def test_connecting_without_a_token_is_rejected(client):
    with pytest.raises(Exception):
        with client.websocket_connect("/ws/global"):
            pass


def test_connecting_with_a_garbage_token_is_rejected(client):
    with pytest.raises(Exception):
        with client.websocket_connect("/ws/global?token=not.a.real.token"):
            pass


def test_connecting_to_an_unknown_room_is_rejected(client, registered_user):
    token = registered_user["headers"]["Authorization"].split(" ", 1)[1]
    with pytest.raises(Exception):
        with client.websocket_connect(f"/ws/does-not-exist?token={token}"):
            pass


def test_a_non_member_cannot_connect_to_a_private_room(client, fake_directory):
    alice = make_user(fake_directory)
    bob = make_user(fake_directory)
    stranger = make_user(fake_directory)
    room = client.post(
        "/rooms/group", json={"name": "Private", "member_ids": [bob["id"]]}, headers=alice["headers"]
    ).json()

    stranger_token = stranger["headers"]["Authorization"].split(" ", 1)[1]
    with pytest.raises(Exception):
        with client.websocket_connect(f"/ws/{room['id']}?token={stranger_token}"):
            pass


def test_anyone_with_a_valid_token_can_connect_to_the_public_room(client, registered_user):
    token = registered_user["headers"]["Authorization"].split(" ", 1)[1]
    with client.websocket_connect(f"/ws/global?token={token}") as ws:
        pass  # connecting and cleanly closing is the whole test


def test_a_message_sent_over_the_socket_is_broadcast_to_another_connection(client, fake_directory):
    alice = make_user(fake_directory)
    bob = make_user(fake_directory)
    room = client.post(
        "/rooms/group", json={"name": "Two People", "member_ids": [bob["id"]]}, headers=alice["headers"]
    ).json()

    alice_token = alice["headers"]["Authorization"].split(" ", 1)[1]
    bob_token = bob["headers"]["Authorization"].split(" ", 1)[1]

    with client.websocket_connect(f"/ws/{room['id']}?token={alice_token}") as alice_ws:
        with client.websocket_connect(f"/ws/{room['id']}?token={bob_token}") as bob_ws:
            alice_ws.send_json({"type": "message", "text": "hey bob"})

            # Both connections receive it, including the sender's own -
            # the server is the single source of truth for what was
            # actually saved, not an assumption the client made locally.
            received_by_alice = alice_ws.receive_json()
            received_by_bob = bob_ws.receive_json()

    assert received_by_alice["type"] == "message"
    assert received_by_alice["message"]["text"] == "hey bob"
    assert received_by_alice["message"]["user_name"] == alice["name"]
    assert received_by_bob["message"]["text"] == "hey bob"

    # And it's really saved, readable afterwards over plain REST too.
    history = client.get(f"/rooms/{room['id']}/messages", headers=alice["headers"]).json()
    assert [m["text"] for m in history] == ["hey bob"]


def test_call_start_broadcasts_a_jitsi_room_to_the_other_connection(client, fake_directory):
    alice = make_user(fake_directory)
    bob = make_user(fake_directory)
    room = client.post(
        "/rooms/group", json={"name": "Call Room", "member_ids": [bob["id"]]}, headers=alice["headers"]
    ).json()

    alice_token = alice["headers"]["Authorization"].split(" ", 1)[1]
    bob_token = bob["headers"]["Authorization"].split(" ", 1)[1]

    with client.websocket_connect(f"/ws/{room['id']}?token={alice_token}") as alice_ws:
        with client.websocket_connect(f"/ws/{room['id']}?token={bob_token}") as bob_ws:
            alice_ws.send_json({"type": "call_start"})
            signal = bob_ws.receive_json()

    assert signal["type"] == "call_started"
    assert signal["jitsi_room"].startswith(f"globetrotter-{room['id']}-")
    assert signal["started_by"] == alice["id"]


def test_a_malformed_frame_does_not_crash_the_connection(client, registered_user):
    token = registered_user["headers"]["Authorization"].split(" ", 1)[1]
    with client.websocket_connect(f"/ws/global?token={token}") as ws:
        ws.send_text("this is not json")
        # The connection must still be usable afterwards.
        ws.send_json({"type": "message", "text": "still alive"})
        received = ws.receive_json()
    assert received["message"]["text"] == "still alive"


# ---------------------------------------------------------------------------
# THE 100-MEMBER REQUIREMENT
# ---------------------------------------------------------------------------
def test_a_message_reaches_all_100_members_of_a_group_over_real_websockets(client, fake_directory):
    creator = make_user(fake_directory)
    members = [make_user(fake_directory) for _ in range(99)]  # + creator = 100
    all_users = [creator, *members]

    room = client.post(
        "/rooms/group",
        json={"name": "The Whole Class", "member_ids": [m["id"] for m in members]},
        headers=creator["headers"],
    ).json()
    assert room["member_count"] == 100

    with ExitStack() as stack:
        sockets = []
        for user in all_users:
            token = user["headers"]["Authorization"].split(" ", 1)[1]
            ws = stack.enter_context(client.websocket_connect(f"/ws/{room['id']}?token={token}"))
            sockets.append(ws)

        assert len(sockets) == 100

        # One person, in a room of 100, sends a single message...
        sockets[0].send_json({"type": "message", "text": "can everyone see this?"})

        # ...and every single one of the 100 connections receives it -
        # this is the actual proof that a 100-member group works over a
        # real-time WebSocket broadcast, not a mesh of 99*100/2 direct
        # peer connections (which is exactly what the assignment says NOT
        # to build - see chatlogic.py's start_call docstring).
        received_count = 0
        for ws in sockets:
            payload = ws.receive_json()
            assert payload["message"]["text"] == "can everyone see this?"
            received_count += 1

        assert received_count == 100
