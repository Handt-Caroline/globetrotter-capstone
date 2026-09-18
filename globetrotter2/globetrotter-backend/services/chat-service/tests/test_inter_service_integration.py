# =============================================================================
# tests/test_inter_service_integration.py  -  CHAT SERVICE
#
# test_rooms.py/test_websocket.py mock app.user_lookup.fetch_user_names so
# they run fast and don't need a live User Service. THIS file is the
# real deal, same pattern as recommendation-service/tests/test_inter_
# service_integration.py: it launches an ACTUAL User Service process,
# registers real accounts on it over real HTTP, and proves Chat Service's
# room creation really calls out to it (not a shared file, not a mock) to
# confirm a member id is real and to resolve their name.
# =============================================================================

import os
import socket
import subprocess
import sys
import time
import uuid
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.main import app  # noqa: E402

# IMPORTANT: reuse THIS process's already-resolved secret rather than
# inventing a separate constant. tests/conftest.py imports app.main (and
# therefore app.security) before this file does, which permanently fixes
# app.security.JWT_SECRET to whatever GLOBETROTTER_JWT_SECRET was (or
# wasn't) set to at that moment - setting the env var here would be too
# late to change it. The live User Service subprocess below is launched
# with THIS SAME value, so both sides agree on what a valid signature
# looks like regardless of what the ambient shell had (or didn't have) set.
from app.security import JWT_SECRET as CHAT_SERVICE_JWT_SECRET  # noqa: E402

SERVICES_ROOT = Path(__file__).resolve().parent.parent.parent  # .../globetrotter/services


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _wait_until_healthy(base_url: str, timeout_s: float = 15.0) -> None:
    deadline = time.time() + timeout_s
    last_error = None
    while time.time() < deadline:
        try:
            response = httpx.get(f"{base_url}/health", timeout=1.0)
            if response.status_code == 200:
                return
        except httpx.RequestError as error:
            last_error = error
        time.sleep(0.2)
    raise RuntimeError(f"{base_url} never became healthy (last error: {last_error})")


@pytest.fixture(scope="session")
def live_user_service(tmp_path_factory):
    port = _free_port()
    service_dir = SERVICES_ROOT / "user-service"
    python_exe = service_dir / ".venv" / "Scripts" / "python.exe"
    if not python_exe.is_file():
        pytest.skip(f"user-service has no .venv at {python_exe} - set it up first.")

    data_dir = tmp_path_factory.mktemp("chat_inter_service_data")
    child_env = {
        **os.environ,
        "GLOBETROTTER_JWT_SECRET": CHAT_SERVICE_JWT_SECRET,
        "USER_DB_PATH": str(data_dir / "user_db.json"),
    }
    process = subprocess.Popen(
        [str(python_exe), "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", str(port)],
        cwd=str(service_dir),
        env=child_env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    url = f"http://127.0.0.1:{port}"
    try:
        _wait_until_healthy(url)
        yield url
    finally:
        process.terminate()
        process.wait(timeout=10)


@pytest.fixture
def live_client(live_user_service, monkeypatch):
    monkeypatch.setenv("USER_SERVICE_URL", live_user_service)
    with TestClient(app) as test_client:
        yield test_client


def _register(live_user_service: str, name: str) -> dict:
    email = f"{uuid.uuid4().hex[:10]}@example.cm"
    response = httpx.post(
        f"{live_user_service}/auth/register",
        json={"name": name, "email": email, "password": "SuperSecret123"},
        timeout=5.0,
    )
    assert response.status_code == 200, response.text
    token = response.json()["access_token"]
    user_id = httpx.get(
        f"{live_user_service}/auth/me", headers={"Authorization": f"Bearer {token}"}, timeout=5.0
    ).json()["id"]
    return {"id": user_id, "name": name, "headers": {"Authorization": f"Bearer {token}"}}


def test_direct_room_resolves_a_real_name_from_the_real_user_service(live_client, live_user_service):
    alice = _register(live_user_service, "Alice Real")
    bob = _register(live_user_service, "Bob Real")

    room = live_client.post(
        "/rooms/direct", json={"other_user_id": bob["id"]}, headers=alice["headers"]
    ).json()

    # "Bob Real" came from nowhere but a genuine HTTP call to the live
    # User Service - there is no other way this service could know it.
    assert room["name"] == "Bob Real"


def test_creating_a_room_with_a_real_but_nonexistent_id_is_404(live_client, live_user_service):
    alice = _register(live_user_service, "Alice Real")

    response = live_client.post(
        "/rooms/direct", json={"other_user_id": "not-a-real-user-id"}, headers=alice["headers"]
    )
    assert response.status_code == 404


def test_group_room_resolves_every_real_members_name(live_client, live_user_service):
    alice = _register(live_user_service, "Alice Real")
    bob = _register(live_user_service, "Bob Real")
    carol = _register(live_user_service, "Carol Real")

    room = live_client.post(
        "/rooms/group",
        json={"name": "Real Trip", "member_ids": [bob["id"], carol["id"]]},
        headers=alice["headers"],
    ).json()
    assert room["member_count"] == 3

    detail = live_client.get(f"/rooms/{room['id']}", headers=alice["headers"]).json()
    names = {m["name"] for m in detail["members"]}
    assert names == {"Alice Real", "Bob Real", "Carol Real"}
