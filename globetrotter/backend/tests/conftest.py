# =============================================================================
# tests/conftest.py
#
# WHAT IS THIS FILE?
# ------------------
# pytest automatically looks for a file called conftest.py and loads it
# before running any test. Anything defined here is shared by every test
# file in this folder - you never import it yourself.
#
# WHAT IS A FIXTURE?
# ------------------
# A fixture is a named piece of setup. If a test function has an argument
# called `client`, pytest looks for a fixture called `client`, runs it,
# and passes the result in. It's dependency injection for tests.
#
# THE IMPORTANT IDEA HERE: TEST ISOLATION
# ---------------------------------------
# Our app stores everything in data/db.json. If tests wrote to that file
# they would destroy your real data AND leak into each other - a user
# registered in test 1 would still exist in test 5, so tests would pass or
# fail depending on the order they ran in. That is the classic flaky-test
# trap.
#
# So before each test we point the storage layer at a BRAND NEW temporary
# file, and delete it afterwards. Every test therefore starts from a clean,
# freshly seeded database and cannot affect any other test.
# =============================================================================

import sys
import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# Make sure `import app...` works when pytest is run from the backend folder.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import metrics, storage  # noqa: E402  (import after the path fix)
from app.main import app  # noqa: E402


@pytest.fixture(autouse=True)
def isolated_database(tmp_path, monkeypatch):
    """Give every test its own throwaway database file.

    - `tmp_path` is a pytest built-in: a fresh empty folder per test, which
      pytest cleans up for us afterwards.
    - `monkeypatch` is another built-in: it changes a value for the duration
      of one test and puts the original back automatically. Here we change
      storage.DB_PATH so the app writes to the temp folder instead of the
      real data/db.json.
    - `autouse=True` means "apply this to every test without being asked".
    """
    test_db = tmp_path / f"test_db_{uuid.uuid4().hex}.json"
    monkeypatch.setattr(storage, "DB_PATH", test_db)
    metrics.reset()  # start each test with clean performance numbers too
    yield  # <- the test runs at this point
    # tmp_path is deleted by pytest, so there is nothing to clean up by hand.


@pytest.fixture
def client():
    """A fake browser that can call our API without starting a real server.

    TestClient sends requests straight into the FastAPI app in memory, so
    the tests are fast and don't need uvicorn running or a free port.
    """
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def registered_user(client):
    """Create a user and return their details plus a ready-made auth header.

    Lots of tests need to be logged in (favourites, itineraries,
    recommendations). Rather than repeating the registration call in each
    one, they just ask for this fixture.
    """
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
        # This header is what tells the API "I am logged in as this user".
        "headers": {"Authorization": f"Bearer {token}"},
    }
