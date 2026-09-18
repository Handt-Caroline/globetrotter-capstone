# =============================================================================
# tests/conftest.py  -  CHAT SERVICE
#
# Same test-isolation idea as every other service (isolated_database), and
# the same locally-minted-token idea as itinerary-service's tests (no real
# User Service to call POST /auth/register on).
#
# THE ONE THING SPECIFIC TO THIS SERVICE: fake_directory
# -----------------------------------------------------------
# Chat Service calls OUT to User Service (app/user_lookup.py) to confirm a
# user id is real and to get their display name. Rather than mocking that
# away entirely, `fake_directory` is a small in-memory {id: name} map that
# stands in for User Service's own users table - tests register a
# "traveller" into it (via `registered_user` or `make_user`) exactly like
# a real account would exist there, and fetch_user_names() (monkeypatched
# to read from this dict instead of making an HTTP call) answers from it.
# This keeps the actual room/membership-validation LOGIC under real test
# coverage, while keeping these tests fast and independent of a live User
# Service. tests/test_inter_service_integration.py covers the real,
# unmocked HTTP call instead - same split as recommendation-service uses.
# =============================================================================

import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import jwt as pyjwt
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import metrics, storage  # noqa: E402
from app.main import app  # noqa: E402
from app.security import JWT_ALGORITHM, JWT_SECRET  # noqa: E402


@pytest.fixture(autouse=True)
def isolated_database(tmp_path, monkeypatch):
    test_db = tmp_path / f"test_db_{uuid.uuid4().hex}.json"
    monkeypatch.setattr(storage, "DB_PATH", test_db)
    metrics.reset()
    yield


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def make_token(user_id: str | None = None, role: str = "user") -> str:
    user_id = user_id or uuid.uuid4().hex[:12]
    expire_at = datetime.now(timezone.utc) + timedelta(hours=1)
    return pyjwt.encode({"sub": user_id, "role": role, "exp": expire_at}, JWT_SECRET, algorithm=JWT_ALGORITHM)


def auth_headers(user_id: str | None = None, role: str = "user") -> dict:
    return {"Authorization": f"Bearer {make_token(user_id, role)}"}


@pytest.fixture
def fake_directory(monkeypatch):
    directory: dict[str, str] = {}

    # fetch_user_names is `async def` for real (see app/user_lookup.py's
    # module docstring for why it has to be) - this stand-in must be too,
    # or `await fetch_user_names(...)` in the real code would fail with
    # "object dict can't be used in 'await' expression".
    async def _fake_fetch(user_ids):
        return {uid: directory[uid] for uid in user_ids if uid in directory}

    monkeypatch.setattr("app.routers.rooms.fetch_user_names", _fake_fetch)
    monkeypatch.setattr("app.chatlogic.fetch_user_names", _fake_fetch)
    return directory


def make_user(fake_directory: dict, role: str = "user") -> dict:
    """Registers a new "traveller" into the fake directory and returns
    their id/name/auth headers - call this as many times as you need
    distinct users (e.g. building a 100-member group)."""
    user_id = uuid.uuid4().hex[:12]
    name = f"Traveller {user_id[:4]}"
    fake_directory[user_id] = name
    return {"id": user_id, "name": name, "headers": auth_headers(user_id, role)}


@pytest.fixture
def registered_user(fake_directory):
    return make_user(fake_directory)
