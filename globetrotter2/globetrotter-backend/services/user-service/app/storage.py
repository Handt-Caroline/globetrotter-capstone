# =============================================================================
# storage.py  -  USER SERVICE's OWN DATABASE
#
# THE WHOLE POINT OF PHASE 2
# ---------------------------
# In the Phase 1 monolith, ONE db.json held users, destinations, itineraries,
# favorites, preferences and chat messages together. That's exactly what a
# monolith is: one process, one database, everything coupled.
#
# Phase 2 splits that into independent services, and "independent" means
# each service owns ONLY its own data and nobody else is allowed to reach
# into its file. User Service owns:
#   - users        (id, name, email, password_hash)
#   - preferences  (per-user: interests, pace, budget)
#
# It does NOT store destinations, itineraries or favorites - those live in
# Itinerary Service's own separate JSON file (services/itinerary-service/
# data/itinerary_db.json). If Recommendation Service wants a user's
# preferences, it has to ask User Service over HTTP (see
# recommendation-service/app/main.py) - it is not allowed to open this file
# directly. That HTTP boundary IS the microservice; enforcing it is the
# entire exercise.
#
# STILL A JSON FILE, ON PURPOSE
# ------------------------------
# Just like Phase 1, this is a plain JSON file guarded by a lock, not a real
# database (Postgres, MongoDB, ...). That's a deliberate simplification for
# a class project - a real deployment would give each microservice its own
# actual database. Swapping this file for, say, SQLite or Postgres later
# would only mean rewriting THIS file - every router still calls read_db()/
# update_db() and would not notice the difference.
# =============================================================================

import json
import os
import threading
import uuid
from pathlib import Path

# USER_DB_PATH lets something outside this process (namely, the
# Recommendation Service's integration tests - see recommendation-service/
# tests/test_inter_service_integration.py) point a throwaway instance of
# this service at its own temporary file, so test runs never touch the
# real data/user_db.json. Normal running (uvicorn app.main:app) doesn't set
# this, so it falls back to the usual path right next to this service.
DB_PATH = Path(os.environ.get("USER_DB_PATH") or (Path(__file__).resolve().parent.parent / "data" / "user_db.json"))

_lock = threading.Lock()


def _empty_db() -> dict:
    return {
        "users": [],
        "preferences": {},
    }


def _read_db() -> dict:
    if not DB_PATH.exists():
        db = _empty_db()
        _write_db(db)
        return db
    with open(DB_PATH, "r", encoding="utf-8") as f:
        db = json.load(f)
    for key, default in _empty_db().items():
        db.setdefault(key, default)
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


def update_db(mutate_fn) -> dict:
    with _lock:
        db = _read_db()
        result = mutate_fn(db)
        _write_db(db)
        return result
