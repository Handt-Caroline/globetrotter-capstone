# =============================================================================
# routers/chat.py
#
# THE GLOBAL CHAT
#
# One room, shared by everyone using the app. It is the counterpart to the AI
# assistant: the assistant knows what is written down, the global chat knows
# what is true right now - whether a market is open today, whether a road is
# flooded, what a taxi to Mvolye is actually going for this afternoon.
#
#   GET  /chat/global?since=<id>  -> messages (or only the new ones)
#   POST /chat/global             -> post a message (login required)
#
# WHY `since` MATTERS
# -------------------
# The frontend polls this endpoint every few seconds to stay live. Without
# `since` each poll would re-download the entire history, which gets slower
# the busier the room is. With it, a poll asks "anything after the last
# message I already have?" and almost always gets an empty list back - the
# cheapest possible answer.
#
# Reading is public (you can see what people are saying before you sign up);
# posting needs a login, so every message has a real name attached to it.
# =============================================================================

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.deps import get_current_user
from app.storage import new_id, read_db, update_db

router = APIRouter(prefix="/chat", tags=["chat"])

# Keeps one runaway client from filling db.json - the whole database is
# rewritten on every write in this phase, so an unbounded list would make
# every single request in the app slower over time.
MAX_STORED_MESSAGES = 500
MAX_MESSAGE_LENGTH = 500


class PostMessageRequest(BaseModel):
    text: str = Field(min_length=1, max_length=MAX_MESSAGE_LENGTH)


@router.get("/global")
def list_global_messages(
    since: str | None = Query(default=None, description="Return only messages after this message id"),
    limit: int = Query(default=100, ge=1, le=200),
):
    db = read_db()
    messages = db.get("chat_messages", [])

    if since:
        # Find where the caller got up to and return only what came after.
        # An unknown id (the message was trimmed away while they were gone)
        # falls through to the normal "last N messages" answer.
        for index, message in enumerate(messages):
            if message["id"] == since:
                return messages[index + 1 :]

    return messages[-limit:]


@router.post("/global", status_code=status.HTTP_201_CREATED)
def post_global_message(payload: PostMessageRequest, current_user: dict = Depends(get_current_user)):
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Message can't be empty")

    message = {
        "id": new_id(),
        "user_id": current_user["id"],
        "user_name": current_user["name"],
        "text": text,
        "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }

    def _post(db):
        db.setdefault("chat_messages", []).append(message)
        if len(db["chat_messages"]) > MAX_STORED_MESSAGES:
            db["chat_messages"] = db["chat_messages"][-MAX_STORED_MESSAGES:]
        return message

    return update_db(_post)
