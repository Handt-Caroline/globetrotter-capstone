# =============================================================================
# routers/favorites.py
#
# Implements:
#   GET    /favorites             -> api.getFavorites()
#   POST   /favorites/{dest_id}   -> api.addFavorite(destinationId)
#   DELETE /favorites/{dest_id}   -> api.removeFavorite(destinationId)
#
# Favorites.jsx expects GET /favorites to return the FULL destination
# objects (not just ids) - see toFavoriteShape() in Favorites.jsx, which
# reads destination.name, destination.rating, etc. straight off each item.
# So we store just the ids per user, but expand them into full destination
# objects before responding.
# =============================================================================

from fastapi import APIRouter, Depends, HTTPException, status

from app.deps import get_current_user
from app.storage import read_db, update_db

router = APIRouter(prefix="/favorites", tags=["favorites"])


@router.get("")
def list_favorites(current_user: dict = Depends(get_current_user)):
    db = read_db()
    favorite_ids = set(db["favorites"].get(current_user["id"], []))
    return [d for d in db["destinations"] if d["id"] in favorite_ids]


@router.post("/{destination_id}", status_code=status.HTTP_204_NO_CONTENT)
def add_favorite(destination_id: str, current_user: dict = Depends(get_current_user)):
    db = read_db()
    if not any(d["id"] == destination_id for d in db["destinations"]):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Destination not found")

    def _add(db):
        user_favorites = db["favorites"].setdefault(current_user["id"], [])
        if destination_id not in user_favorites:
            user_favorites.append(destination_id)

    update_db(_add)
    return None


@router.delete("/{destination_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_favorite(destination_id: str, current_user: dict = Depends(get_current_user)):
    def _remove(db):
        user_favorites = db["favorites"].get(current_user["id"], [])
        db["favorites"][current_user["id"]] = [d for d in user_favorites if d != destination_id]

    update_db(_remove)
    return None
