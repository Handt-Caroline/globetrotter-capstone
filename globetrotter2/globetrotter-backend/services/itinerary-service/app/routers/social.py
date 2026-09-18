# =============================================================================
# routers/social.py  -  ratings, comments, likes, and the "top rated" leaderboard
#
# GET  /destinations/top-rated             -> the leaderboard, best first
# POST /destinations/{id}/rating           -> rate 1-5 stars (login required)
# GET  /destinations/{id}/rating/mine      -> your own rating, if you left one
# GET  /destinations/{id}/comments         -> public, no login needed to read
# POST /destinations/{id}/comments         -> login required to post
# DELETE /destinations/{id}/comments/{id}  -> you, or an admin, can remove it
# POST /destinations/{id}/like             -> like it (login required)
# DELETE /destinations/{id}/like           -> unlike it
# GET  /destinations/{id}/like/mine        -> did I like this?
#
# REGISTERED BEFORE destinations.router IN main.py
# ---------------------------------------------------
# Same reason as destination_requests.py: GET /destinations/top-rated
# would otherwise be swallowed by destinations.router's catch-all
# GET /destinations/{destination_id} (treating "top-rated" as an id).
# =============================================================================

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app import social
from app.deps import get_current_user
from app.storage import read_db

router = APIRouter(prefix="/destinations", tags=["social"])


def _find(db: dict, destination_id: str) -> dict | None:
    return next((d for d in db["destinations"] if d["id"] == destination_id), None)


@router.get("/top-rated")
def get_top_rated(limit: int = Query(default=20, ge=1, le=100)):
    db = read_db()
    return social.top_rated(db, limit)


class RatingRequest(BaseModel):
    stars: int = Field(ge=1, le=5)


@router.post("/{destination_id}/rating")
def rate_destination(destination_id: str, payload: RatingRequest, current_user: dict = Depends(get_current_user)):
    db = read_db()
    if not _find(db, destination_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Destination not found")
    return social.set_rating(destination_id, current_user["id"], payload.stars)


@router.get("/{destination_id}/rating/mine")
def get_my_rating(destination_id: str, current_user: dict = Depends(get_current_user)):
    stars = social.get_my_rating(destination_id, current_user["id"])
    if stars is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="You haven't rated this place yet")
    return {"stars": stars}


class CommentRequest(BaseModel):
    text: str = Field(min_length=1, max_length=1000)


@router.get("/{destination_id}/comments")
def get_comments(destination_id: str):
    db = read_db()
    if not _find(db, destination_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Destination not found")
    return social.list_comments(destination_id)


@router.post("/{destination_id}/comments", status_code=status.HTTP_201_CREATED)
def post_comment(destination_id: str, payload: CommentRequest, current_user: dict = Depends(get_current_user)):
    db = read_db()
    if not _find(db, destination_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Destination not found")
    return social.add_comment(destination_id, current_user["id"], payload.text.strip())


@router.delete("/{destination_id}/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_comment(destination_id: str, comment_id: str, current_user: dict = Depends(get_current_user)):
    try:
        deleted = social.delete_comment(
            destination_id, comment_id, current_user["id"], current_user["role"] == "admin"
        )
    except PermissionError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only delete your own comment")
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
    return None


@router.post("/{destination_id}/like")
def like_destination(destination_id: str, current_user: dict = Depends(get_current_user)):
    db = read_db()
    if not _find(db, destination_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Destination not found")
    count = social.like(destination_id, current_user["id"])
    return {"like_count": count, "liked_by_me": True}


@router.delete("/{destination_id}/like")
def unlike_destination(destination_id: str, current_user: dict = Depends(get_current_user)):
    count = social.unlike(destination_id, current_user["id"])
    return {"like_count": count, "liked_by_me": False}


@router.get("/{destination_id}/like/mine")
def get_my_like(destination_id: str, current_user: dict = Depends(get_current_user)):
    db = read_db()
    return {"liked": social.is_liked_by(db, destination_id, current_user["id"])}
