# =============================================================================
# tests/test_destination_requests.py  -  ITINERARY SERVICE
#
# Covers the whole approval workflow a regular traveller must now use
# instead of editing destinations directly (see routers/
# destination_requests.py and test_a_regular_user_cannot_create_edit_or_
# delete_directly in test_destinations_crud.py for the other half of this
# rule).
# =============================================================================

def test_submitting_a_request_requires_login(client):
    response = client.post("/destinations/requests", json={"type": "create", "payload": {"name": "X"}})
    assert response.status_code in (401, 403)


def test_a_create_request_does_not_appear_in_destinations_until_approved(client, registered_user):
    before = {d["id"] for d in client.get("/destinations").json()}

    submitted = client.post(
        "/destinations/requests",
        headers=registered_user["headers"],
        json={"type": "create", "payload": {"name": "Traveller's Suggestion"}},
    )
    assert submitted.status_code == 201, submitted.text
    assert submitted.json()["status"] == "pending"

    after = {d["id"] for d in client.get("/destinations").json()}
    assert after == before  # nothing changed yet - it's still just a proposal


def test_a_regular_user_cannot_list_or_approve_requests(client, registered_user):
    submitted = client.post(
        "/destinations/requests",
        headers=registered_user["headers"],
        json={"type": "create", "payload": {"name": "Mine"}},
    ).json()

    assert client.get("/destinations/requests", headers=registered_user["headers"]).status_code == 403
    assert client.post(
        f"/destinations/requests/{submitted['id']}/approve", headers=registered_user["headers"]
    ).status_code == 403


def test_full_create_request_lifecycle_approved(client, registered_user, admin_user):
    submitted = client.post(
        "/destinations/requests",
        headers=registered_user["headers"],
        json={"type": "create", "payload": {"name": "New Rooftop Bar", "category": "nightlife"}},
    ).json()

    # Admin sees it in the pending queue.
    pending = client.get("/destinations/requests?status=pending", headers=admin_user["headers"]).json()
    assert any(r["id"] == submitted["id"] for r in pending)

    approved = client.post(
        f"/destinations/requests/{submitted['id']}/approve", headers=admin_user["headers"]
    )
    assert approved.status_code == 200
    body = approved.json()
    assert body["status"] == "approved"
    new_destination_id = body["result"]["id"]

    # NOW it's a real, publicly-visible destination.
    live = client.get(f"/destinations/{new_destination_id}")
    assert live.status_code == 200
    assert live.json()["name"] == "New Rooftop Bar"

    # The requester can see their request was approved.
    mine = client.get("/destinations/requests/mine", headers=registered_user["headers"]).json()
    assert mine[0]["status"] == "approved"

    # Can't approve the same request twice.
    assert client.post(
        f"/destinations/requests/{submitted['id']}/approve", headers=admin_user["headers"]
    ).status_code == 400


def test_a_rejected_request_never_becomes_a_destination(client, registered_user, admin_user):
    submitted = client.post(
        "/destinations/requests",
        headers=registered_user["headers"],
        json={"type": "create", "payload": {"name": "Rejected Idea"}},
    ).json()

    rejected = client.post(
        f"/destinations/requests/{submitted['id']}/reject",
        headers=admin_user["headers"],
        params={"reason": "Duplicate of an existing place"},
    )
    assert rejected.status_code == 200
    assert rejected.json()["status"] == "rejected"

    names = [d["name"] for d in client.get("/destinations").json()]
    assert "Rejected Idea" not in names

    mine = client.get("/destinations/requests/mine", headers=registered_user["headers"]).json()
    assert mine[0]["status"] == "rejected"
    assert mine[0]["reject_reason"] == "Duplicate of an existing place"


def test_an_update_request_applies_the_proposed_fields_on_approval(client, registered_user, admin_user):
    seed = client.get("/destinations").json()[0]

    submitted = client.post(
        "/destinations/requests",
        headers=registered_user["headers"],
        json={
            "type": "update",
            "destination_id": seed["id"],
            "payload": {**{k: seed[k] for k in ("name", "category")}, "neighbourhood": "Renamed District"},
        },
    ).json()

    client.post(f"/destinations/requests/{submitted['id']}/approve", headers=admin_user["headers"])

    updated = client.get(f"/destinations/{seed['id']}").json()
    assert updated["neighbourhood"] == "Renamed District"


def test_a_delete_request_removes_the_destination_on_approval(client, registered_user, admin_user):
    seed = client.get("/destinations").json()[0]

    submitted = client.post(
        "/destinations/requests",
        headers=registered_user["headers"],
        json={"type": "delete", "destination_id": seed["id"]},
    ).json()

    client.post(f"/destinations/requests/{submitted['id']}/approve", headers=admin_user["headers"])

    assert client.get(f"/destinations/{seed['id']}").status_code == 404


def test_requesting_a_change_to_an_unknown_destination_is_404(client, registered_user):
    response = client.post(
        "/destinations/requests",
        headers=registered_user["headers"],
        json={"type": "delete", "destination_id": "dest_does_not_exist"},
    )
    assert response.status_code == 404


def test_update_request_without_destination_id_is_rejected(client, registered_user):
    response = client.post(
        "/destinations/requests",
        headers=registered_user["headers"],
        json={"type": "update", "payload": {"name": "Missing the id"}},
    )
    assert response.status_code == 422
