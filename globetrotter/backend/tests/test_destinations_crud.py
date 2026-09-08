# =============================================================================
# tests/test_destinations_crud.py
#
# Destinations are editable now: any signed-in traveller can add a place,
# change one (seeded or not), delete one, and attach up to 6 photos/videos.
# Reads stay public (that's covered in test_destinations.py).
#
# Uploaded files land in storage.uploads_dir(), which hangs off DB_PATH, so
# the autouse `isolated_database` fixture puts them in the per-test tmp dir.
# =============================================================================

import io

from app import storage

# A minimal but valid 1x1 PNG.
_PNG_BYTES = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4"
    "890000000a49444154789c6360000002000154a24f9f0000000049454e44ae426082"
)

_CONTRACT_FIELDS = [
    "id", "name", "category", "description", "history", "getting_there",
    "what_to_expect", "tips", "rating", "price_level", "price_range",
    "latitude", "longitude", "neighbourhood", "media",
]


def _register(client, email):
    resp = client.post(
        "/auth/register",
        json={"name": "Tester", "email": email, "password": "SuperSecret123"},
    )
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def test_creating_a_destination_requires_login(client):
    assert client.post("/destinations", json={"name": "Somewhere"}).status_code in (401, 403)


def test_create_with_just_a_name_is_contract_complete(client, registered_user):
    created = client.post(
        "/destinations", headers=registered_user["headers"], json={"name": "My Rooftop Bar"}
    )
    assert created.status_code in (200, 201), created.text
    place = created.json()
    for field in _CONTRACT_FIELDS:
        assert field in place, f"missing {field}"
    assert place["id"].startswith("dest_user_")
    assert place["name"] == "My Rooftop Bar"
    assert place["media"] == []

    # It shows up in the public list, still carrying every field the UI reads.
    listed = client.get("/destinations").json()
    mine = next(d for d in listed if d["id"] == place["id"])
    for field in _CONTRACT_FIELDS:
        assert field in mine


def test_any_signed_in_user_can_edit_and_delete_any_place(client, registered_user):
    place = client.post(
        "/destinations", headers=registered_user["headers"], json={"name": "Shared Spot"}
    ).json()

    other = _register(client, "other_crud@example.cm")

    edited = client.put(
        f"/destinations/{place['id']}",
        headers=other,
        json={"name": "Renamed", "category": "viewpoints", "history": "A short note."},
    )
    assert edited.status_code == 200
    assert edited.json()["name"] == "Renamed"
    assert client.get(f"/destinations/{place['id']}").json()["category"] == "viewpoints"

    assert client.delete(f"/destinations/{place['id']}", headers=other).status_code == 204
    assert client.get(f"/destinations/{place['id']}").status_code == 404


def test_editing_a_seeded_destination_sticks(client, registered_user):
    seed = client.get("/destinations").json()[0]
    resp = client.put(
        f"/destinations/{seed['id']}",
        headers=registered_user["headers"],
        json={**{k: seed[k] for k in ("name", "category", "history") if k in seed},
              "neighbourhood": "Bastos"},
    )
    assert resp.status_code == 200
    assert client.get(f"/destinations/{seed['id']}").json()["neighbourhood"] == "Bastos"


def test_more_than_six_media_items_is_rejected(client, registered_user):
    seven = [{"url": f"/media/x{i}.jpg", "type": "photo"} for i in range(7)]
    resp = client.post(
        "/destinations",
        headers=registered_user["headers"],
        json={"name": "Too many", "media": seven},
    )
    assert resp.status_code == 422


def test_upload_requires_login(client):
    resp = client.post(
        "/destinations/media", files={"file": ("a.png", io.BytesIO(_PNG_BYTES), "image/png")}
    )
    assert resp.status_code in (401, 403)


def test_upload_a_photo_then_fetch_it_back(client, registered_user):
    resp = client.post(
        "/destinations/media",
        headers=registered_user["headers"],
        files={"file": ("view.png", io.BytesIO(_PNG_BYTES), "image/png")},
    )
    assert resp.status_code in (200, 201), resp.text
    body = resp.json()
    assert body["url"].startswith("/media/")
    assert body["type"] == "photo"

    fetched = client.get(body["url"])
    assert fetched.status_code == 200
    assert fetched.content == _PNG_BYTES


def test_uploading_a_non_media_file_is_rejected(client, registered_user):
    resp = client.post(
        "/destinations/media",
        headers=registered_user["headers"],
        files={"file": ("notes.txt", io.BytesIO(b"hello"), "text/plain")},
    )
    assert resp.status_code == 400


def test_editing_removes_orphaned_upload_files(client, registered_user):
    up = client.post(
        "/destinations/media",
        headers=registered_user["headers"],
        files={"file": ("p.png", io.BytesIO(_PNG_BYTES), "image/png")},
    ).json()
    stored = up["url"].rsplit("/", 1)[1]
    assert (storage.uploads_dir() / stored).is_file()

    place = client.post(
        "/destinations",
        headers=registered_user["headers"],
        json={"name": "Has a photo", "media": [{"url": up["url"], "type": "photo"}]},
    ).json()

    client.put(
        f"/destinations/{place['id']}",
        headers=registered_user["headers"],
        json={"name": "Photo removed", "media": []},
    )
    assert not (storage.uploads_dir() / stored).is_file()


def test_deleting_a_place_cleans_files_and_favourites(client, registered_user):
    up = client.post(
        "/destinations/media",
        headers=registered_user["headers"],
        files={"file": ("v.mp4", io.BytesIO(b"\x00\x00\x00\x18ftypmp42"), "video/mp4")},
    ).json()
    stored = up["url"].rsplit("/", 1)[1]

    place = client.post(
        "/destinations",
        headers=registered_user["headers"],
        json={"name": "Doomed", "media": [{"url": up["url"], "type": "video"}]},
    ).json()

    # favourite it, then delete the place
    assert client.post(
        f"/favorites/{place['id']}", headers=registered_user["headers"]
    ).status_code == 204
    assert client.delete(
        f"/destinations/{place['id']}", headers=registered_user["headers"]
    ).status_code == 204

    assert client.get(f"/destinations/{place['id']}").status_code == 404
    assert not (storage.uploads_dir() / stored).is_file()
    assert client.get("/favorites", headers=registered_user["headers"]).json() == []


def test_deleting_an_unknown_place_is_404(client, registered_user):
    assert client.delete(
        "/destinations/dest_nope", headers=registered_user["headers"]
    ).status_code == 404
