# =============================================================================
# routers/destinations.py
#
# Browsing (all PUBLIC - you can look around Yaoundé before making an account):
#   GET    /destinations             -> api.getDestinations(params)
#   GET    /destinations/categories  -> api.getCategories()
#   GET    /destinations/{id}        -> api.getDestination(id)
#
# Managing (ADMIN ONLY as of the roles/approval-workflow update - see
# routers/destination_requests.py):
#   POST   /destinations             -> admin creates a place directly
#   PUT    /destinations/{id}        -> admin edits a place directly
#   DELETE /destinations/{id}        -> admin deletes a place directly
#   POST   /destinations/media       -> any logged-in user (uploading a photo
#                                        to ATTACH to a request is still fine -
#                                        the request itself still needs
#                                        approval before the photo is visible
#                                        anywhere)
#
# A regular traveller who wants to add/edit/remove a place no longer calls
# these three directly - see routers/destination_requests.py for
# POST /destinations/requests, which any logged-in user CAN call, and which
# an admin then approves (applying exactly the logic below) or rejects.
#
# The 28 places the app ships with are just the initial contents of
# db["destinations"] (see storage.SEED_DESTINATIONS); from here on every one
# of them is an ordinary editable record like any a traveller adds.
# =============================================================================

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel, Field

from app import media, social
from app.deps import get_current_user, require_admin
from app.media import MAX_MEDIA_ITEMS, MediaItem
from app.storage import new_id, read_db, update_db
from app.translations_fr import FR_TEXT


# -----------------------------------------------------------------------------
# BILINGUAL SUPPORT
#
# Cameroon is officially bilingual, so every destination can be served in
# French or English. The English text lives in seed.py; the French version
# lives in translations_fr.py.
#
# `localise` merges the two: it starts from the English record and, if the
# user asked for French AND we have a French version, overwrites the text
# fields. Anything without a translation stays in English rather than
# disappearing - a half-translated page is better than a blank one.
# (Traveller-added places have no French entry, so they stay in English.)
# -----------------------------------------------------------------------------
def localise(destination: dict, lang: str | None) -> dict:
    if lang != "fr":
        return destination
    french = FR_TEXT.get(destination["id"])
    if not french:
        return destination
    # dict unpacking: start with English, then let French keys win.
    return {**destination, **french, "lang": "fr"}


router = APIRouter(prefix="/destinations", tags=["destinations"])


# -----------------------------------------------------------------------------
# WRITE MODEL
#
# Only `name` is required. Everything else has a default so a freshly created
# place still carries every field the React app reads - a missing key renders
# as the literal string "undefined" at the user.
# -----------------------------------------------------------------------------
_YAOUNDE_LAT = 3.8480
_YAOUNDE_LNG = 11.5021


class DestinationBody(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    category: str = Field(default="", max_length=60)
    neighbourhood: str = Field(default="Yaoundé", max_length=120)
    description: str = Field(default="", max_length=4000)
    history: str = Field(default="", max_length=20000)
    getting_there: str = Field(default="", max_length=4000)
    what_to_expect: str = Field(default="", max_length=4000)
    tips: str = Field(default="", max_length=4000)
    rating: float = Field(default=0, ge=0, le=5)
    price_level: str = Field(default="free", max_length=20)
    price_range: str = Field(default="Free", max_length=120)
    latitude: float = _YAOUNDE_LAT
    longitude: float = _YAOUNDE_LNG
    # >6 items makes FastAPI return 422 on its own.
    media: list[MediaItem] = Field(default_factory=list, max_length=MAX_MEDIA_ITEMS)


def _record_from(payload: DestinationBody) -> dict:
    # model_dump() already turns the nested MediaItem models into plain dicts.
    return payload.model_dump()


def _find(db: dict, destination_id: str) -> dict | None:
    return next((d for d in db["destinations"] if d["id"] == destination_id), None)


# NOTE: /categories and /media must be declared BEFORE "/{destination_id}",
# otherwise FastAPI would treat "categories" as a destination id.
@router.get("/categories")
def get_categories():
    """The distinct category ids currently in use."""
    db = read_db()
    categories = sorted({d["category"] for d in db["destinations"] if d.get("category")})
    return categories


@router.post("/media", status_code=status.HTTP_201_CREATED)
def upload_media(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    """Store one photo/video and return its { url, type, name } descriptor."""
    return media.save_upload(file)


@router.get("")
def list_destinations(
    category: str | None = Query(default=None, description="Filter by category id, e.g. 'cafe'"),
    search: str | None = Query(default=None, description="Case-insensitive match against the name"),
    lang: str | None = Query(default=None, description="'fr' for French text, otherwise English"),
):
    db = read_db()
    results = db["destinations"]

    if category:
        results = [d for d in results if d["category"] == category]

    if search:
        needle = search.lower()
        results = [d for d in results if needle in d["name"].lower()]

    # Overlay the live rating/rating_count/like_count onto each result -
    # see app/social.py for why "rating" is no longer just the seed number.
    return [social.overlay_social(db, localise(d, lang)) for d in results]


# -----------------------------------------------------------------------------
# THE ACTUAL WRITE LOGIC, factored out of the routes below.
#
# routers/destination_requests.py calls these same three functions when an
# admin APPROVES a pending request - so "an admin edits directly" and "an
# admin approves someone else's request" both end up running exactly this
# code, instead of two slightly-different copies of it.
# -----------------------------------------------------------------------------
def apply_create(payload: DestinationBody, created_by: str) -> dict:
    record = _record_from(payload)
    # dest_user_* keeps traveller places clear of the dest_landmarks_01-style
    # seed ids and out of the French translation table.
    record["id"] = f"dest_user_{new_id()}"
    record["created_by"] = created_by

    def _create(db):
        db["destinations"].append(record)
        return record

    return update_db(_create)


def apply_update(destination_id: str, payload: DestinationBody) -> dict | None:
    db = read_db()
    existing = _find(db, destination_id)
    if not existing:
        return None

    old_urls = media.media_urls(existing)
    fields = _record_from(payload)
    new_urls = {m["url"] for m in fields["media"]}

    def _update(db):
        record = _find(db, destination_id)
        record.update(fields)
        return record

    updated = update_db(_update)
    media.delete_media_files(old_urls - new_urls)
    return updated


def apply_delete(destination_id: str) -> bool:
    db = read_db()
    existing = _find(db, destination_id)
    if not existing:
        return False

    urls = media.media_urls(existing)

    def _delete(db):
        db["destinations"] = [d for d in db["destinations"] if d["id"] != destination_id]
        # Don't leave the id dangling in other people's favourites or trips.
        for user_id, ids in db.get("favorites", {}).items():
            db["favorites"][user_id] = [i for i in ids if i != destination_id]
        for itinerary in db.get("itineraries", []):
            itinerary["stops"] = [
                s for s in itinerary.get("stops", []) if s.get("destination_id") != destination_id
            ]

    update_db(_delete)
    media.delete_media_files(urls)
    return True


@router.post("", status_code=status.HTTP_201_CREATED)
def create_destination(payload: DestinationBody, current_user: dict = Depends(require_admin)):
    return apply_create(payload, created_by=current_user["id"])


@router.put("/{destination_id}")
def update_destination(
    destination_id: str,
    payload: DestinationBody,
    current_user: dict = Depends(require_admin),
):
    updated = apply_update(destination_id, payload)
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Destination not found")
    return updated


@router.delete("/{destination_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_destination(destination_id: str, current_user: dict = Depends(require_admin)):
    if not apply_delete(destination_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Destination not found")
    return None


@router.get("/{destination_id}")
def get_destination(
    destination_id: str,
    lang: str | None = Query(default=None, description="'fr' for French text, otherwise English"),
):
    db = read_db()
    destination = _find(db, destination_id)
    if not destination:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Destination not found")
    return social.overlay_social(db, localise(destination, lang))
