# =============================================================================
# tests/test_rooms.py  -  CHAT SERVICE (REST side)
# =============================================================================

from tests.conftest import auth_headers, make_user


def test_creating_a_direct_room_with_an_unknown_user_is_404(client, registered_user):
    response = client.post(
        "/rooms/direct", json={"other_user_id": "nobody"}, headers=registered_user["headers"]
    )
    assert response.status_code == 404


def test_cannot_start_a_direct_chat_with_yourself(client, registered_user):
    response = client.post(
        "/rooms/direct", json={"other_user_id": registered_user["id"]}, headers=registered_user["headers"]
    )
    assert response.status_code == 400


def test_creating_a_direct_room_twice_returns_the_same_room(client, fake_directory):
    alice = make_user(fake_directory)
    bob = make_user(fake_directory)

    first = client.post("/rooms/direct", json={"other_user_id": bob["id"]}, headers=alice["headers"])
    second = client.post("/rooms/direct", json={"other_user_id": alice["id"]}, headers=bob["headers"])

    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["id"] == second.json()["id"]


def test_direct_room_is_named_after_the_other_person(client, fake_directory):
    alice = make_user(fake_directory)
    bob = make_user(fake_directory)

    room = client.post("/rooms/direct", json={"other_user_id": bob["id"]}, headers=alice["headers"]).json()
    assert room["name"] == bob["name"]


def test_group_room_enforces_the_100_member_cap(client, fake_directory):
    creator = make_user(fake_directory)
    too_many = [make_user(fake_directory)["id"] for _ in range(100)]  # + creator = 101

    response = client.post(
        "/rooms/group", json={"name": "Big Trip", "member_ids": too_many}, headers=creator["headers"]
    )
    assert response.status_code == 400


def test_group_room_with_exactly_100_members_is_allowed(client, fake_directory):
    creator = make_user(fake_directory)
    others = [make_user(fake_directory)["id"] for _ in range(99)]  # + creator = 100

    response = client.post(
        "/rooms/group", json={"name": "Big Trip", "member_ids": others}, headers=creator["headers"]
    )
    assert response.status_code == 201
    assert response.json()["member_count"] == 100


def test_group_room_rejects_unknown_member_ids(client, registered_user):
    response = client.post(
        "/rooms/group",
        json={"name": "Trip", "member_ids": ["ghost-1", "ghost-2"]},
        headers=registered_user["headers"],
    )
    assert response.status_code == 404


def test_adding_a_member_to_a_direct_room_is_rejected(client, fake_directory):
    alice = make_user(fake_directory)
    bob = make_user(fake_directory)
    carol = make_user(fake_directory)

    room = client.post("/rooms/direct", json={"other_user_id": bob["id"]}, headers=alice["headers"]).json()
    response = client.post(f"/rooms/{room['id']}/members", json={"user_id": carol["id"]}, headers=alice["headers"])
    assert response.status_code == 400


def test_adding_a_member_to_a_full_group_is_rejected(client, fake_directory):
    creator = make_user(fake_directory)
    others = [make_user(fake_directory)["id"] for _ in range(99)]
    room = client.post(
        "/rooms/group", json={"name": "Full Group", "member_ids": others}, headers=creator["headers"]
    ).json()

    one_more = make_user(fake_directory)
    response = client.post(
        f"/rooms/{room['id']}/members", json={"user_id": one_more["id"]}, headers=creator["headers"]
    )
    assert response.status_code == 400


def test_list_my_rooms_always_includes_the_public_room(client, registered_user):
    rooms = client.get("/rooms", headers=registered_user["headers"]).json()
    assert any(r["id"] == "global" and r["type"] == "public" for r in rooms)


def test_list_my_rooms_does_not_include_someone_elses_group(client, fake_directory):
    alice = make_user(fake_directory)
    bob = make_user(fake_directory)
    stranger = make_user(fake_directory)

    room = client.post(
        "/rooms/group", json={"name": "Alice and Bob", "member_ids": [bob["id"]]}, headers=alice["headers"]
    ).json()

    stranger_rooms = client.get("/rooms", headers=stranger["headers"]).json()
    assert not any(r["id"] == room["id"] for r in stranger_rooms)


def test_room_detail_lists_resolved_member_names(client, fake_directory):
    alice = make_user(fake_directory)
    bob = make_user(fake_directory)
    room = client.post(
        "/rooms/group", json={"name": "Trip", "member_ids": [bob["id"]]}, headers=alice["headers"]
    ).json()

    detail = client.get(f"/rooms/{room['id']}", headers=alice["headers"]).json()
    names = {m["name"] for m in detail["members"]}
    assert names == {alice["name"], bob["name"]}


def test_non_member_cannot_see_room_detail(client, fake_directory):
    alice = make_user(fake_directory)
    bob = make_user(fake_directory)
    stranger = make_user(fake_directory)
    room = client.post(
        "/rooms/group", json={"name": "Private", "member_ids": [bob["id"]]}, headers=alice["headers"]
    ).json()

    response = client.get(f"/rooms/{room['id']}", headers=stranger["headers"])
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# MESSAGES (REST fallback - the WebSocket is the real-time path, see
# test_websocket.py)
# ---------------------------------------------------------------------------
def test_reading_the_public_room_needs_no_login(client):
    response = client.get("/rooms/global/messages")
    assert response.status_code == 200
    assert response.json() == []


def test_reading_a_private_room_without_being_a_member_is_rejected(client, fake_directory):
    alice = make_user(fake_directory)
    bob = make_user(fake_directory)
    stranger = make_user(fake_directory)
    room = client.post(
        "/rooms/group", json={"name": "Private", "member_ids": [bob["id"]]}, headers=alice["headers"]
    ).json()

    assert client.get(f"/rooms/{room['id']}/messages").status_code == 401
    assert client.get(f"/rooms/{room['id']}/messages", headers=stranger["headers"]).status_code == 401


def test_posting_to_the_public_room_requires_login(client):
    response = client.post("/rooms/global/messages", json={"text": "hello"})
    assert response.status_code in (401, 403)


def test_post_and_read_back_a_message_in_the_public_room(client, registered_user):
    posted = client.post(
        "/rooms/global/messages", json={"text": "Anyone near Mvolyé?"}, headers=registered_user["headers"]
    )
    assert posted.status_code == 201
    body = posted.json()
    assert body["text"] == "Anyone near Mvolyé?"
    assert body["user_name"] == registered_user["name"]

    messages = client.get("/rooms/global/messages").json()
    assert [m["text"] for m in messages] == ["Anyone near Mvolyé?"]


def test_a_non_member_cannot_post_to_a_private_room(client, fake_directory):
    alice = make_user(fake_directory)
    bob = make_user(fake_directory)
    stranger = make_user(fake_directory)
    room = client.post(
        "/rooms/group", json={"name": "Private", "member_ids": [bob["id"]]}, headers=alice["headers"]
    ).json()

    response = client.post(f"/rooms/{room['id']}/messages", json={"text": "sneaky"}, headers=stranger["headers"])
    assert response.status_code == 403


def test_you_can_delete_your_own_message_but_not_someone_elses(client, registered_user, fake_directory):
    other = make_user(fake_directory)
    mine = client.post(
        "/rooms/global/messages", json={"text": "mine"}, headers=registered_user["headers"]
    ).json()

    assert client.delete(f"/rooms/global/messages/{mine['id']}", headers=other["headers"]).status_code == 403
    assert client.delete(f"/rooms/global/messages/{mine['id']}", headers=registered_user["headers"]).status_code == 204


def test_an_admin_can_delete_anyones_message(client, registered_user, fake_directory):
    admin = make_user(fake_directory, role="admin")
    mine = client.post(
        "/rooms/global/messages", json={"text": "delete me please"}, headers=registered_user["headers"]
    ).json()

    assert client.delete(f"/rooms/global/messages/{mine['id']}", headers=admin["headers"]).status_code == 204


def test_starting_a_call_returns_a_jitsi_room_name(client, registered_user):
    response = client.post("/rooms/global/call/start", headers=registered_user["headers"])
    assert response.status_code == 200
    assert response.json()["jitsi_room"].startswith("globetrotter-global-")
