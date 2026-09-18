# =============================================================================
# social.py  -  RATINGS, COMMENTS AND LIKES on destinations
#
# Same "own data, own file" idea as everything else in this service: these
# three new tables (destination_ratings, destination_comments,
# destination_likes) live in the same itinerary_db.json as destinations
# itself, because they're all facts about a destination and this service
# already owns that whole domain. See storage.py's _empty_db() for the
# on-disk shapes.
#
# WHY THE "rating" FIELD'S MEANING CHANGES HERE
# ------------------------------------------------
# Every destination started with a fixed, hand-picked "rating" from
# seed.py, just so the app didn't look empty on day one. Now that real
# travellers can submit their own 1-5 star rating, effective_rating()
# blends the two: if anyone has actually rated a place, its rating becomes
# the real average of those votes; otherwise it quietly falls back to the
# original seed number. routers/destinations.py overlays this onto every
# destination it serves (see overlay_social below) - the seed number never
# has to be migrated by hand, it just gets outvoted.
# =============================================================================

from datetime import datetime, timezone

from app.storage import new_id, read_db, update_db


def _ratings_for(db: dict, destination_id: str) -> dict:
    return db.get("destination_ratings", {}).get(destination_id, {})


def effective_rating(db: dict, destination: dict) -> tuple[float, int]:
    """Returns (rating, how_many_real_votes). how_many_real_votes is 0
    when nobody has rated it yet - that's the caller's cue that `rating`
    is still just the seed placeholder, not a real average."""
    ratings = _ratings_for(db, destination["id"])
    if not ratings:
        return destination.get("rating", 0), 0
    values = list(ratings.values())
    return round(sum(values) / len(values), 2), len(values)


def like_count(db: dict, destination_id: str) -> int:
    return len(db.get("destination_likes", {}).get(destination_id, []))


def is_liked_by(db: dict, destination_id: str, user_id: str) -> bool:
    return user_id in db.get("destination_likes", {}).get(destination_id, [])


def overlay_social(db: dict, destination: dict) -> dict:
    """Attach the live rating/count/like-count onto a destination dict,
    WITHOUT mutating the stored record (seed.py's numbers stay on disk
    exactly as written - only what we SERVE reflects real votes)."""
    rating, count = effective_rating(db, destination)
    return {
        **destination,
        "rating": rating,
        "rating_count": count,
        "like_count": like_count(db, destination["id"]),
    }


def set_rating(destination_id: str, user_id: str, stars: int) -> dict:
    def _set(db):
        db.setdefault("destination_ratings", {}).setdefault(destination_id, {})[user_id] = stars

    update_db(_set)
    db = read_db()
    values = list(_ratings_for(db, destination_id).values())
    return {"rating": round(sum(values) / len(values), 2), "rating_count": len(values)}


def get_my_rating(destination_id: str, user_id: str) -> int | None:
    db = read_db()
    return _ratings_for(db, destination_id).get(user_id)


def add_comment(destination_id: str, user_id: str, text: str) -> dict:
    comment = {
        "id": new_id(),
        "destination_id": destination_id,
        "user_id": user_id,
        "text": text,
        "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }

    def _add(db):
        db.setdefault("destination_comments", []).append(comment)
        return comment

    return update_db(_add)


def list_comments(destination_id: str) -> list[dict]:
    db = read_db()
    return [c for c in db.get("destination_comments", []) if c["destination_id"] == destination_id]


def delete_comment(destination_id: str, comment_id: str, user_id: str, is_admin: bool) -> bool:
    """Returns False if no such comment exists. Raises PermissionError if
    it exists but belongs to someone else and the caller isn't an admin -
    the router turns that into a 403."""
    db = read_db()
    comment = next(
        (
            c
            for c in db.get("destination_comments", [])
            if c["id"] == comment_id and c["destination_id"] == destination_id
        ),
        None,
    )
    if not comment:
        return False
    if comment["user_id"] != user_id and not is_admin:
        raise PermissionError()

    def _delete(db):
        db["destination_comments"] = [
            c for c in db.get("destination_comments", []) if c["id"] != comment_id
        ]

    update_db(_delete)
    return True


def like(destination_id: str, user_id: str) -> int:
    def _like(db):
        likers = db.setdefault("destination_likes", {}).setdefault(destination_id, [])
        if user_id not in likers:
            likers.append(user_id)

    update_db(_like)
    return like_count(read_db(), destination_id)


def unlike(destination_id: str, user_id: str) -> int:
    def _unlike(db):
        likers = db.setdefault("destination_likes", {}).setdefault(destination_id, [])
        if user_id in likers:
            likers.remove(user_id)

    update_db(_unlike)
    return like_count(read_db(), destination_id)


def top_rated(db: dict, limit: int = 20) -> list[dict]:
    overlaid = [overlay_social(db, d) for d in db["destinations"]]
    # Best-rated first; break ties by how many people actually voted, so a
    # single 5-star rating doesn't outrank a place ten people rated 4.8.
    overlaid.sort(key=lambda d: (d["rating"], d["rating_count"]), reverse=True)
    return overlaid[:limit]
