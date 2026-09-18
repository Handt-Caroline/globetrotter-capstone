# =============================================================================
# tests/conftest.py  -  ITINERARY SERVICE
#
# Same test-isolation idea as every other service: each test gets its own
# throwaway JSON file (see isolated_database below).
#
# THE DIFFERENCE FROM USER SERVICE'S conftest.py
# -------------------------------------------------
# User Service's tests can call POST /auth/register to get a real token for
# a real user. This service has no /auth endpoint at all - it only ever
# DECODES a token that some other request already obtained from User
# Service (see app/security.py's comment about stateless JWT verification).
# So instead of registering, these tests mint a token directly with
# `make_token()`, using the exact same secret and algorithm this service
# reads out of GLOBETROTTER_JWT_SECRET. That's equivalent, for a test, to
# "pretend User Service already logged this person in".
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
    """Mint a valid JWT for a made-up user id, signed with the same shared
    secret User Service would have used. See the module docstring above for
    why tests do this instead of registering a real account. `role`
    mirrors what User Service embeds at login (see user-service/app/
    security.py's create_access_token) - pass role="admin" to test the
    admin-only routes (destinations.py's direct writes, destination_
    requests.py's approve/reject)."""
    user_id = user_id or uuid.uuid4().hex[:12]
    expire_at = datetime.now(timezone.utc) + timedelta(hours=1)
    return pyjwt.encode({"sub": user_id, "role": role, "exp": expire_at}, JWT_SECRET, algorithm=JWT_ALGORITHM)


def auth_headers(user_id: str | None = None, role: str = "user") -> dict:
    return {"Authorization": f"Bearer {make_token(user_id, role)}"}


@pytest.fixture
def registered_user():
    """A REGULAR (non-admin) user. Mirrors the shape backend/tests used,
    minus name/email - this service never learns a user's name (that's
    User Service's job)."""
    user_id = uuid.uuid4().hex[:12]
    return {"id": user_id, "headers": auth_headers(user_id, role="user")}


@pytest.fixture
def admin_user():
    """An ADMIN user - see routers/destinations.py and routers/
    destination_requests.py for what this unlocks."""
    user_id = uuid.uuid4().hex[:12]
    return {"id": user_id, "headers": auth_headers(user_id, role="admin")}
