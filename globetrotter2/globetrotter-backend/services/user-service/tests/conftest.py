# =============================================================================
# tests/conftest.py  -  USER SERVICE
#
# Same test-isolation trick as the Phase 1 monolith (see backend/tests/
# conftest.py for the long explanation): each test gets its own throwaway
# JSON file instead of touching the real data/user_db.json, so tests never
# leak into each other and never destroy real data.
# =============================================================================

import sys
import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import metrics, storage  # noqa: E402
from app.main import app  # noqa: E402


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


@pytest.fixture
def registered_user(client):
    payload = {
        "name": "Handy Caroline",
        "email": f"handy_{uuid.uuid4().hex[:8]}@example.cm",
        "password": "SuperSecret123",
    }
    response = client.post("/auth/register", json=payload)
    assert response.status_code == 200, response.text
    token = response.json()["access_token"]
    return {
        "email": payload["email"],
        "password": payload["password"],
        "name": payload["name"],
        "token": token,
        "headers": {"Authorization": f"Bearer {token}"},
    }
