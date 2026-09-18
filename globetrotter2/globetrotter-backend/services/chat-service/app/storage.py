# =============================================================================
# storage.py  -  CHAT SERVICE's OWN DATABASE
#
# Owns: rooms (1-on-1, group, and the one special "public" room every
# traveller shares - the old Phase 1 monolith's Global Chat, folded in
# here) and their messages. Same JSON-file simplification as every other
# service in this project - see user-service/app/storage.py for the fuller
# explanation of why, and what a real deployment would do instead.
#
# THE ONE ROOM THAT ALWAYS EXISTS
# ----------------------------------
# PUBLIC_ROOM_ID ("global") is seeded on first run and never deleted. Its
# "members" list is meaningless (everyone is a member) - routers/rooms.py
# and ws.py special-case `room["type"] == "public"` instead of checking
# membership for it. This is the direct replacement for the monolith's
# GET/POST /chat/global - same room, same messages, just reachable over a
# WebSocket now instead of polling every few seconds.
# =============================================================================

import json
import os
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path

PUBLIC_ROOM_ID = "global"
MAX_GROUP_MEMBERS = 100

# CHAT_DB_PATH lets tests (this service's own, and any future cross-service
# integration test) point a throwaway instance at its own temp file - same
# pattern as USER_DB_PATH / ITINERARY_DB_PATH in the other services.
DB_PATH = Path(os.environ.get("CHAT_DB_PATH") or (Path(__file__).resolve().parent.parent / "data" / "chat_db.json"))

_lock = threading.Lock()


def _empty_db() -> dict:
    return {
        "rooms": [
            {
                "id": PUBLIC_ROOM_ID,
                "type": "public",
                "name": "Global Chat",
                "members": [],
                "created_by": None,
                "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            }
        ],
        "messages": [],
    }


def _read_db() -> dict:
    if not DB_PATH.exists():
        db = _empty_db()
        _write_db(db)
        return db
    with open(DB_PATH, "r", encoding="utf-8") as f:
        db = json.load(f)
    for key, default in _empty_db().items():
        if key != "rooms":  # never overwrite an existing rooms list
            db.setdefault(key, default)
    if not any(r["id"] == PUBLIC_ROOM_ID for r in db.get("rooms", [])):
        db.setdefault("rooms", []).insert(0, _empty_db()["rooms"][0])
    return db


def _write_db(db: dict) -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(DB_PATH, "w", encoding="utf-8") as f:
        json.dump(db, f, indent=2, ensure_ascii=False)


def new_id() -> str:
    return uuid.uuid4().hex[:12]


def read_db() -> dict:
    with _lock:
        return _read_db()


def update_db(mutate_fn):
    with _lock:
        db = _read_db()
        result = mutate_fn(db)
        _write_db(db)
        return result
