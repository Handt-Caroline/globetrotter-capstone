# =============================================================================
# routers/recommendations.py
#
# Implements:
#   POST /recommendations/preferences  -> api.savePreferences(interests, pace, budget)
#   GET  /recommendations/preferences  -> api.getPreferences()
#   GET  /recommendations              -> api.getRecommendations()
#
# All three require login, because recommendations are personal to one user.
# =============================================================================

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.constants import INTEREST_LABEL_TO_CATEGORY
from app.deps import get_current_user
from app.storage import read_db, update_db

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


class PreferencesRequest(BaseModel):
    interests: list[str]  # e.g. ["Historical Landmarks", "Cafés"]
    pace: str  # "Relaxed" | "Balanced" | "Packed"
    budget: str  # "₣" | "₣₣" | "₣₣₣"


@router.post("/preferences")
def save_preferences(payload: PreferencesRequest, current_user: dict = Depends(get_current_user)):
    def _save(db):
        db["preferences"][current_user["id"]] = payload.model_dump()
        return db["preferences"][current_user["id"]]

    return update_db(_save)


@router.get("/preferences")
def get_preferences(current_user: dict = Depends(get_current_user)):
    db = read_db()
    prefs = db["preferences"].get(current_user["id"])
    if not prefs:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No preferences saved yet")
    return prefs


@router.get("")
def get_recommendations(current_user: dict = Depends(get_current_user)):
    """
    A simple, explainable scoring algorithm (not real ML - that's fine for
    a class project, and it's easy to describe in a demo):

      +2 points  if the destination's category matches one of the user's
                 chosen interests
      +1 point   if the destination is highly rated (4.3 or above)
      +0.5 point per 0.1 of rating, as a small tie-breaker

    We then sort by score (highest first) and return the top 10, each
    annotated with WHY it was picked (`reason`) and a 0-100 `match_score`
    so the "For You" screen can show something meaningful instead of a
    random list.
    """
    db = read_db()
    prefs = db["preferences"].get(current_user["id"])
    liked_categories = set()
    if prefs:
        liked_categories = {
            INTEREST_LABEL_TO_CATEGORY[label]
            for label in prefs["interests"]
            if label in INTEREST_LABEL_TO_CATEGORY
        }

    scored = []
    for dest in db["destinations"]:
        score = 0.0
        reasons = []

        if dest["category"] in liked_categories:
            score += 2.0
            reasons.append("matches one of your interests")

        if dest["rating"] >= 4.3:
            score += 1.0
            reasons.append("highly rated by other travellers")

        score += dest["rating"] / 10  # small tie-breaker, e.g. 4.5 -> +0.45

        if not reasons:
            reasons.append("popular in Yaoundé")

        # Convert the raw score into a friendly 0-100 percentage. The max
        # possible raw score is 2 + 1 + 0.5 = 3.5, so we scale against that.
        match_score = round(min(score / 3.5, 1.0) * 100)

        scored.append({**dest, "match_score": match_score, "reason": ", ".join(reasons).capitalize()})

    scored.sort(key=lambda d: d["match_score"], reverse=True)
    return scored[:10]
