# =============================================================================
# routers/preferences.py  -  USER SERVICE
#
# GET  /preferences  -> the logged-in user's saved travel preferences
# POST /preferences  -> save/replace them
#
# WHY THIS LIVES HERE, NOT IN RECOMMENDATION SERVICE
# ---------------------------------------------------
# Preferences ("I like Street Food, I travel at a Relaxed pace, my budget is
# ₣₣") are data ABOUT a user, so under the "each service owns its own data"
# rule they belong in User Service, right next to the users table - not in
# Recommendation Service, which the assignment spec says must own NO data at
# all.
#
# The frontend, however, still calls POST/GET "/recommendations/preferences"
# (see frontend/src/api/client.js - unchanged from Phase 1). The API Gateway
# is what bridges that gap: it rewrites "/recommendations/preferences" to
# this service's "/preferences" path before forwarding the request (see
# gateway/app/main.py). That path translation is a normal, expected job for
# an API Gateway - the frontend should never need to know that preferences
# and recommendations are now two different services.
#
# Recommendation Service also calls THIS endpoint over HTTP (forwarding the
# same user's JWT) when it computes recommendations - see
# recommendation-service/app/main.py. That HTTP call is the actual
# "microservices communicating via REST" requirement in action.
# =============================================================================

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.deps import get_current_user
from app.storage import read_db, update_db

router = APIRouter(prefix="/preferences", tags=["preferences"])


class PreferencesRequest(BaseModel):
    interests: list[str]  # e.g. ["Historical Landmarks", "Cafés"]
    pace: str  # "Relaxed" | "Balanced" | "Packed"
    budget: str  # "₣" | "₣₣" | "₣₣₣"


@router.post("")
def save_preferences(payload: PreferencesRequest, current_user: dict = Depends(get_current_user)):
    def _save(db):
        db["preferences"][current_user["id"]] = payload.model_dump()
        return db["preferences"][current_user["id"]]

    return update_db(_save)


@router.get("")
def get_preferences(current_user: dict = Depends(get_current_user)):
    db = read_db()
    prefs = db["preferences"].get(current_user["id"])
    if not prefs:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No preferences saved yet")
    return prefs
