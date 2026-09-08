# =============================================================================
# storage.py
#
# Phase 1 of the project (see the lecture slides) intentionally uses a
# single JSON file instead of a real database. This file is our whole
# "data access layer" -- every other file in the app reads/writes data
# by calling the functions below, instead of touching the JSON file
# directly. That way, when we upgrade to a real database in a later
# phase, we only need to change THIS file.
#
# The JSON file looks like this (see data/db.json once the app has run):
# {
#   "users": [ {id, name, email, password_hash}, ... ],
#   "destinations": [ {id, name, category, description, rating,
#                       price_level, latitude, longitude}, ... ],
#   "preferences": { "<user_id>": {interests, pace, budget}, ... },
#   "itineraries": [ {id, user_id, title, date, stops}, ... ],
#   "favorites": { "<user_id>": ["<destination_id>", ...], ... },
#   "chat_messages": [ {id, user_id, user_name, text, created_at}, ... ]
# }
#
# Destinations are editable now: each may also carry a "media" list of
# uploaded photos/videos. The files live next to db.json in data/uploads/
# (see uploads_dir() below); only their "/media/<name>" URLs go in the JSON.
# =============================================================================

import json
import threading
import uuid
from pathlib import Path

from app.seed import SEED_DESTINATIONS

# Path to our "database" file, e.g. globetrotter-backend/data/db.json
DB_PATH = Path(__file__).resolve().parent.parent / "data" / "db.json"

# A lock so that two requests arriving at almost the same moment don't
# corrupt the file by writing to it at the same time (JSON files aren't
# safe for concurrent writes the way a real database is - this is one
# of the "Data Storage" limitations of the monolith phase mentioned in
# the lecture slides!).
_lock = threading.Lock()


def _empty_db() -> dict:
    """The shape of a brand-new database, seeded with sample destinations
    so the app has something to show the very first time it runs."""
    return {
        "users": [],
        "destinations": SEED_DESTINATIONS,
        "preferences": {},
        "itineraries": [],
        "favorites": {},
        "chat_messages": [],
    }


def uploads_dir() -> Path:
    """Folder where uploaded place photos/videos are stored, alongside
    db.json (so the tests' monkeypatch of DB_PATH moves this too). Created
    on first use. Call this at request time -- don't bind it at import."""
    directory = DB_PATH.parent / "uploads"
    directory.mkdir(parents=True, exist_ok=True)
    return directory


def _read_db() -> dict:
    """Loads the whole JSON file into a Python dict. If the file doesn't
    exist yet (first run), we create it with seed data."""
    if not DB_PATH.exists():
        db = _empty_db()
        _write_db(db)
        return db
    with open(DB_PATH, "r", encoding="utf-8") as f:
        db = json.load(f)

    # A db.json written by an older version of the app won't have the newer
    # top-level keys (the global chat, for one). Filling in whatever is
    # missing means an existing database keeps working after an update
    # instead of every read crashing with a KeyError - and nobody has to
    # delete their data to pick up a new feature.
    for key, default in _empty_db().items():
        if key != "destinations":  # never overwrite the seeded destinations
            db.setdefault(key, default)
    return db


def _write_db(db: dict) -> None:
    """Saves the whole dict back to disk as nicely formatted JSON."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(DB_PATH, "w", encoding="utf-8") as f:
        json.dump(db, f, indent=2, ensure_ascii=False)


def new_id() -> str:
    """Generates a short unique id for new records (users, itineraries...)."""
    return uuid.uuid4().hex[:12]


# -----------------------------------------------------------------------------
# Every route handler should go through one of these instead of opening the
# JSON file itself. `with _lock:` makes sure only one request at a time can
# read-modify-write the file.
# -----------------------------------------------------------------------------
def read_db() -> dict:
    with _lock:
        return _read_db()


def update_db(mutate_fn) -> dict:
    """
    Runs `mutate_fn(db)` on the current database, then saves the result.
    `mutate_fn` should modify the `db` dict in place (e.g. append to a list)
    and may return a value we want to hand back to the caller (e.g. the
    record that was just created).

    Example:
        def _add_user(db):
            db["users"].append(new_user)
            return new_user
        created_user = update_db(_add_user)
    """
    with _lock:
        db = _read_db()
        result = mutate_fn(db)
        _write_db(db)
        return result
