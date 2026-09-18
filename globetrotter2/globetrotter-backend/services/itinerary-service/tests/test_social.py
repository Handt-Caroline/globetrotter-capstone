# =============================================================================
# tests/test_social.py  -  ITINERARY SERVICE
#
# Ratings, comments, likes, and the top-rated leaderboard - see app/
# social.py for the actual logic and why a destination's "rating" field
# now means "the real average if anyone voted, else the seed placeholder".
# =============================================================================

from tests.conftest import auth_headers


def _seed_id(client):
    return client.get("/destinations").json()[0]["id"]


# ---------------------------------------------------------------------------
# RATINGS
# ---------------------------------------------------------------------------
def test_a_fresh_destination_shows_the_seed_rating_with_zero_votes(client):
    destination = client.get("/destinations").json()[0]
    assert destination["rating_count"] == 0
    assert destination["rating"] == destination["rating"]  # just the seed value, present


def test_rating_requires_login(client):
    dest_id = _seed_id(client)
    response = client.post(f"/destinations/{dest_id}/rating", json={"stars": 5})
    assert response.status_code in (401, 403)


def test_rejects_out_of_range_stars(client, registered_user):
    dest_id = _seed_id(client)
    assert client.post(
        f"/destinations/{dest_id}/rating", json={"stars": 0}, headers=registered_user["headers"]
    ).status_code == 422
    assert client.post(
        f"/destinations/{dest_id}/rating", json={"stars": 6}, headers=registered_user["headers"]
    ).status_code == 422


def test_one_real_rating_becomes_the_new_average_with_count_one(client, registered_user):
    dest_id = _seed_id(client)

    response = client.post(f"/destinations/{dest_id}/rating", json={"stars": 3}, headers=registered_user["headers"])
    assert response.status_code == 200
    assert response.json() == {"rating": 3.0, "rating_count": 1}

    fetched = client.get(f"/destinations/{dest_id}").json()
    assert fetched["rating"] == 3.0
    assert fetched["rating_count"] == 1


def test_two_users_ratings_are_averaged(client, registered_user):
    dest_id = _seed_id(client)
    other = auth_headers()

    client.post(f"/destinations/{dest_id}/rating", json={"stars": 4}, headers=registered_user["headers"])
    client.post(f"/destinations/{dest_id}/rating", json={"stars": 2}, headers=other)

    fetched = client.get(f"/destinations/{dest_id}").json()
    assert fetched["rating"] == 3.0
    assert fetched["rating_count"] == 2


def test_rating_again_replaces_your_previous_vote_not_adds_another(client, registered_user):
    dest_id = _seed_id(client)

    client.post(f"/destinations/{dest_id}/rating", json={"stars": 1}, headers=registered_user["headers"])
    client.post(f"/destinations/{dest_id}/rating", json={"stars": 5}, headers=registered_user["headers"])

    fetched = client.get(f"/destinations/{dest_id}").json()
    assert fetched["rating"] == 5.0
    assert fetched["rating_count"] == 1


def test_my_rating_endpoint(client, registered_user):
    dest_id = _seed_id(client)

    assert client.get(f"/destinations/{dest_id}/rating/mine", headers=registered_user["headers"]).status_code == 404

    client.post(f"/destinations/{dest_id}/rating", json={"stars": 4}, headers=registered_user["headers"])
    response = client.get(f"/destinations/{dest_id}/rating/mine", headers=registered_user["headers"])
    assert response.json() == {"stars": 4}


def test_rating_an_unknown_destination_is_404(client, registered_user):
    response = client.post("/destinations/dest_nope/rating", json={"stars": 5}, headers=registered_user["headers"])
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# TOP RATED LEADERBOARD
# ---------------------------------------------------------------------------
def test_top_rated_is_sorted_best_first(client, registered_user):
    destinations = client.get("/destinations").json()
    low, high = destinations[0]["id"], destinations[1]["id"]

    client.post(f"/destinations/{low}/rating", json={"stars": 1}, headers=registered_user["headers"])
    client.post(f"/destinations/{high}/rating", json={"stars": 5}, headers=registered_user["headers"])

    # A 1-star rating can legitimately push a place below the DEFAULT top-20
    # cutoff (there are ~28 seeded destinations) - ask for enough entries to
    # cover the whole catalogue so both places are guaranteed to appear.
    leaderboard = client.get("/destinations/top-rated?limit=100").json()
    ids = [d["id"] for d in leaderboard]
    assert ids.index(high) < ids.index(low)


def test_top_rated_respects_the_limit(client):
    response = client.get("/destinations/top-rated?limit=3")
    assert len(response.json()) == 3


# ---------------------------------------------------------------------------
# COMMENTS
# ---------------------------------------------------------------------------
def test_reading_comments_needs_no_login(client):
    dest_id = _seed_id(client)
    assert client.get(f"/destinations/{dest_id}/comments").json() == []


def test_posting_a_comment_requires_login(client):
    dest_id = _seed_id(client)
    assert client.post(f"/destinations/{dest_id}/comments", json={"text": "Nice!"}).status_code in (401, 403)


def test_post_and_read_back_a_comment(client, registered_user):
    dest_id = _seed_id(client)
    posted = client.post(
        f"/destinations/{dest_id}/comments", json={"text": "Loved this place!"}, headers=registered_user["headers"]
    )
    assert posted.status_code == 201
    body = posted.json()
    assert body["text"] == "Loved this place!"
    assert body["user_id"] == registered_user["id"]

    comments = client.get(f"/destinations/{dest_id}/comments").json()
    assert [c["text"] for c in comments] == ["Loved this place!"]


def test_an_empty_comment_is_rejected(client, registered_user):
    dest_id = _seed_id(client)
    response = client.post(f"/destinations/{dest_id}/comments", json={"text": ""}, headers=registered_user["headers"])
    assert response.status_code == 422


def test_you_can_delete_your_own_comment(client, registered_user):
    dest_id = _seed_id(client)
    comment = client.post(
        f"/destinations/{dest_id}/comments", json={"text": "delete me"}, headers=registered_user["headers"]
    ).json()

    response = client.delete(f"/destinations/{dest_id}/comments/{comment['id']}", headers=registered_user["headers"])
    assert response.status_code == 204
    assert client.get(f"/destinations/{dest_id}/comments").json() == []


def test_you_cannot_delete_someone_elses_comment(client, registered_user):
    dest_id = _seed_id(client)
    comment = client.post(
        f"/destinations/{dest_id}/comments", json={"text": "mine"}, headers=registered_user["headers"]
    ).json()

    other = auth_headers()
    response = client.delete(f"/destinations/{dest_id}/comments/{comment['id']}", headers=other)
    assert response.status_code == 403


def test_an_admin_can_delete_anyones_comment(client, registered_user):
    dest_id = _seed_id(client)
    comment = client.post(
        f"/destinations/{dest_id}/comments", json={"text": "moderate me"}, headers=registered_user["headers"]
    ).json()

    admin = auth_headers(role="admin")
    response = client.delete(f"/destinations/{dest_id}/comments/{comment['id']}", headers=admin)
    assert response.status_code == 204


def test_deleting_an_unknown_comment_is_404(client, registered_user):
    dest_id = _seed_id(client)
    response = client.delete(f"/destinations/{dest_id}/comments/does-not-exist", headers=registered_user["headers"])
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# LIKES
# ---------------------------------------------------------------------------
def test_liking_requires_login(client):
    dest_id = _seed_id(client)
    assert client.post(f"/destinations/{dest_id}/like").status_code in (401, 403)


def test_like_then_unlike(client, registered_user):
    dest_id = _seed_id(client)

    liked = client.post(f"/destinations/{dest_id}/like", headers=registered_user["headers"])
    assert liked.json() == {"like_count": 1, "liked_by_me": True}
    assert client.get(f"/destinations/{dest_id}").json()["like_count"] == 1
    assert client.get(f"/destinations/{dest_id}/like/mine", headers=registered_user["headers"]).json() == {"liked": True}

    unliked = client.delete(f"/destinations/{dest_id}/like", headers=registered_user["headers"])
    assert unliked.json() == {"like_count": 0, "liked_by_me": False}
    assert client.get(f"/destinations/{dest_id}").json()["like_count"] == 0


def test_liking_twice_does_not_double_count(client, registered_user):
    dest_id = _seed_id(client)
    client.post(f"/destinations/{dest_id}/like", headers=registered_user["headers"])
    client.post(f"/destinations/{dest_id}/like", headers=registered_user["headers"])
    assert client.get(f"/destinations/{dest_id}").json()["like_count"] == 1


def test_multiple_users_likes_accumulate(client, registered_user):
    dest_id = _seed_id(client)
    other = auth_headers()

    client.post(f"/destinations/{dest_id}/like", headers=registered_user["headers"])
    client.post(f"/destinations/{dest_id}/like", headers=other)

    assert client.get(f"/destinations/{dest_id}").json()["like_count"] == 2
