# =============================================================================
# tests/test_destinations_crud.py  -  ITINERARY SERVICE
#
# Ported from the monolith, then updated for the roles feature: creating/
# editing/deleting a destination DIRECTLY now requires an admin token (see
# routers/destinations.py) - a regular traveller has to go through
# routers/destination_requests.py instead (see test_destination_requests.py
# for that flow). Uploading a photo is still open to any logged-in user,
# since a photo on its own isn't a change to the catalogue until some
# request that references it gets approved.
# =============================================================================

import io

from app import storage
from tests.conftest import auth_headers

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


def test_creating_a_destination_requires_login(client):
    assert client.post("/destinations", json={"name": "Somewhere"}).status_code in (401, 403)


def test_a_regular_user_cannot_create_edit_or_delete_directly(client, registered_user):
    """The core rule of the roles feature: a non-admin token is rejected
    with 403, not silently downgraded to "create a request" - the
    traveller has to explicitly go through POST /destinations/requests."""
    created = client.post("/destinations", headers=registered_user["headers"], json={"name": "Nope"})
    assert created.status_code == 403

    seed_id = client.get("/destinations").json()[0]["id"]
    assert client.put(
        f"/destinations/{seed_id}", headers=registered_user["headers"], json={"name": "Nope"}
    ).status_code == 403
    assert client.delete(f"/destinations/{seed_id}", headers=registered_user["headers"]).status_code == 403


def test_create_with_just_a_name_is_contract_complete(client, admin_user):
    created = client.post(
        "/destinations", headers=admin_user["headers"], json={"name": "My Rooftop Bar"}
    )
    assert created.status_code in (200, 201), created.text
    place = created.json()
    for field in _CONTRACT_FIELDS:
        assert field in place, f"missing {field}"
    assert place["id"].startswith("dest_user_")
    assert place["name"] == "My Rooftop Bar"
    assert place["media"] == []

    listed = client.get("/destinations").json()
    mine = next(d for d in listed if d["id"] == place["id"])
    for field in _CONTRACT_FIELDS:
        assert field in mine


def test_any_admin_can_edit_and_delete_any_place(client, admin_user):
    place = client.post(
        "/destinations", headers=admin_user["headers"], json={"name": "Shared Spot"}
    ).json()

    other_admin = auth_headers(role="admin")  # a second, unrelated admin

    edited = client.put(
        f"/destinations/{place['id']}",
        headers=other_admin,
        json={"name": "Renamed", "category": "viewpoints", "history": "A short note."},
    )
    assert edited.status_code == 200
    assert edited.json()["name"] == "Renamed"
    assert client.get(f"/destinations/{place['id']}").json()["category"] == "viewpoints"

    assert client.delete(f"/destinations/{place['id']}", headers=other_admin).status_code == 204
    assert client.get(f"/destinations/{place['id']}").status_code == 404


def test_editing_a_seeded_destination_sticks(client, admin_user):
    seed = client.get("/destinations").json()[0]
    resp = client.put(
        f"/destinations/{seed['id']}",
        headers=admin_user["headers"],
        json={**{k: seed[k] for k in ("name", "category", "history") if k in seed},
              "neighbourhood": "Bastos"},
    )
    assert resp.status_code == 200
    assert client.get(f"/destinations/{seed['id']}").json()["neighbourhood"] == "Bastos"


def test_more_than_six_media_items_is_rejected(client, admin_user):
    seven = [{"url": f"/media/x{i}.jpg", "type": "photo"} for i in range(7)]
    resp = client.post(
        "/destinations",
        headers=admin_user["headers"],
        json={"name": "Too many", "media": seven},
    )
    assert resp.status_code == 422


def test_upload_requires_login(client):
    resp = client.post(
        "/destinations/media", files={"file": ("a.png", io.BytesIO(_PNG_BYTES), "image/png")}
    )
    assert resp.status_code in (401, 403)


def test_upload_a_photo_then_fetch_it_back(client, registered_user):
    """Uploading is still open to any logged-in user (not just admins) -
    see the module docstring above for why."""
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


def test_editing_removes_orphaned_upload_files(client, admin_user):
    up = client.post(
        "/destinations/media",
        headers=admin_user["headers"],
        files={"file": ("p.png", io.BytesIO(_PNG_BYTES), "image/png")},
    ).json()
    stored = up["url"].rsplit("/", 1)[1]
    assert (storage.uploads_dir() / stored).is_file()

    place = client.post(
        "/destinations",
        headers=admin_user["headers"],
        json={"name": "Has a photo", "media": [{"url": up["url"], "type": "photo"}]},
    ).json()

    client.put(
        f"/destinations/{place['id']}",
        headers=admin_user["headers"],
        json={"name": "Photo removed", "media": []},
    )
    assert not (storage.uploads_dir() / stored).is_file()


def test_deleting_a_place_cleans_files_and_favourites(client, admin_user):
    up = client.post(
        "/destinations/media",
        headers=admin_user["headers"],
        files={"file": ("v.mp4", io.BytesIO(b"\x00\x00\x00\x18ftypmp42"), "video/mp4")},
    ).json()
    stored = up["url"].rsplit("/", 1)[1]

    place = client.post(
        "/destinations",
        headers=admin_user["headers"],
        json={"name": "Doomed", "media": [{"url": up["url"], "type": "video"}]},
    ).json()

    assert client.post(
        f"/favorites/{place['id']}", headers=admin_user["headers"]
    ).status_code == 204
    assert client.delete(
        f"/destinations/{place['id']}", headers=admin_user["headers"]
    ).status_code == 204

    assert client.get(f"/destinations/{place['id']}").status_code == 404
    assert not (storage.uploads_dir() / stored).is_file()
    assert client.get("/favorites", headers=admin_user["headers"]).json() == []


def test_deleting_an_unknown_place_is_404(client, admin_user):
    assert client.delete(
        "/destinations/dest_nope", headers=admin_user["headers"]
    ).status_code == 404
