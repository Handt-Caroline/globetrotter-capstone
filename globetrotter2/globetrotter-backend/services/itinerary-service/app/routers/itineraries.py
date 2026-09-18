# =============================================================================
# routers/itineraries.py
#
# Implements:
#   GET    /itineraries      -> api.getItineraries()
#   GET    /itineraries/{id} -> api.getItinerary(id)
#   POST   /itineraries      -> api.createItinerary(title, date, stops)
#   DELETE /itineraries/{id} -> api.deleteItinerary(id)
#
# The GET-one route exists because each itinerary now has its own page in the
# app (/itinerary/:id). The list screen only needs a title and a stop count,
# so it stays small no matter how many trips you have saved; the detail page
# fetches the one trip it is actually showing.
#
# An itinerary belongs to one user and contains a list of "stops"
# (destinations, in order, with a planned duration).
# =============================================================================

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.deps import get_current_user
from app.storage import new_id, read_db, update_db

router = APIRouter(prefix="/itineraries", tags=["itineraries"])


class Stop(BaseModel):
    destination_id: str
    order: int
    duration_minutes: int | None = None


class CreateItineraryRequest(BaseModel):
    title: str
    date: str  # kept as a plain string (e.g. "2026-08-26") - simplest for Phase 1
    stops: list[Stop]


@router.get("")
def list_itineraries(current_user: dict = Depends(get_current_user)):
    db = read_db()
    mine = [it for it in db["itineraries"] if it["user_id"] == current_user["id"]]
    # Most recently created first, so new trips show up at the top.
    mine.sort(key=lambda it: it["id"], reverse=True)
    return mine


@router.get("/{itinerary_id}")
def get_itinerary(itinerary_id: str, current_user: dict = Depends(get_current_user)):
    db = read_db()
    itinerary = next((it for it in db["itineraries"] if it["id"] == itinerary_id), None)

    # Same 404 whether it doesn't exist or belongs to someone else, for the
    # same reason as the delete route below: don't confirm that another
    # user's itinerary id is real.
    if not itinerary or itinerary["user_id"] != current_user["id"]:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Itinerary not found")

    # Stops are stored as ids. The detail page needs names and coordinates to
    # draw the route, so we attach the full destination record to each stop
    # here rather than making the browser fetch all 28 destinations to look
    # up three of them.
    destinations_by_id = {d["id"]: d for d in db["destinations"]}
    stops = []
    for stop in sorted(itinerary["stops"], key=lambda s: s["order"]):
        destination = destinations_by_id.get(stop["destination_id"])
        stops.append({**stop, "destination": destination})

    return {**itinerary, "stops": stops}


@router.post("")
def create_itinerary(payload: CreateItineraryRequest, current_user: dict = Depends(get_current_user)):
    new_itinerary = {
        "id": new_id(),
        "user_id": current_user["id"],
        "title": payload.title,
        "date": payload.date,
        "stops": [s.model_dump() for s in payload.stops],
    }

    def _create(db):
        db["itineraries"].append(new_itinerary)
        return new_itinerary

    return update_db(_create)


@router.delete("/{itinerary_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_itinerary(itinerary_id: str, current_user: dict = Depends(get_current_user)):
    db = read_db()
    itinerary = next((it for it in db["itineraries"] if it["id"] == itinerary_id), None)

    if not itinerary or itinerary["user_id"] != current_user["id"]:
        # Same error whether it doesn't exist or belongs to someone else -
        # we don't want to reveal other users' itinerary ids exist.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Itinerary not found")

    def _delete(db):
        db["itineraries"] = [it for it in db["itineraries"] if it["id"] != itinerary_id]

    update_db(_delete)
    return None
