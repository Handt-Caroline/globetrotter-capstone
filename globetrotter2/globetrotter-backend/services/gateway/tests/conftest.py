# =============================================================================
# tests/conftest.py  -  API GATEWAY
#
# The Gateway has no logic of its own worth testing in isolation - its
# entire job is "route this request to the right real service". So EVERY
# test here needs real User Service, Itinerary Service and Recommendation
# Service actually running, the same way recommendation-service/tests/
# test_inter_service_integration.py does it (see that file for the fuller
# explanation of why real subprocesses instead of mocks).
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

TEST_JWT_SECRET = "test-secret-shared-by-every-service-in-this-test-run"
ADMIN_EMAIL = "gateway-admin@example.cm"

# MUST happen before `from app.main import app` below: app/security.py
# reads GLOBETROTTER_JWT_SECRET into a module-level constant the moment
# it's imported. The live_services fixture launches the OTHER 3 services
# as subprocesses signing tokens with TEST_JWT_SECRET (see _start_service)
# - if the Gateway's own copy of this process disagreed on the secret,
# every admin check would fail with 401 ("invalid signature") instead of
# the 403 these tests are actually checking for.
os.environ["GLOBETROTTER_JWT_SECRET"] = TEST_JWT_SECRET

from app import metrics  # noqa: E402
from app.main import app  # noqa: E402

SERVICES_ROOT = Path(__file__).resolve().parent.parent.parent  # .../globetrotter/services


@pytest.fixture(autouse=True)
def reset_metrics():
    metrics.reset()
    yield


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


def _start_service(folder_name: str, port: int, extra_env: dict) -> subprocess.Popen:
    service_dir = SERVICES_ROOT / folder_name
    python_exe = service_dir / ".venv" / "Scripts" / "python.exe"  # Windows venv layout
    if not python_exe.is_file():
        pytest.skip(
            f"{folder_name} has no .venv at {python_exe} - set it up first "
            f"(see that service's own tests) before running Gateway tests."
        )

    child_env = {**os.environ, "GLOBETROTTER_JWT_SECRET": TEST_JWT_SECRET, **extra_env}
    process = subprocess.Popen(
        [str(python_exe), "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", str(port)],
        cwd=str(service_dir),
        env=child_env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    return process


@pytest.fixture(scope="session")
def live_services(tmp_path_factory):
    """Starts REAL User, Itinerary, Recommendation and Chat Service
    processes once for the whole test session, and tears them down
    afterwards."""
    data_dir = tmp_path_factory.mktemp("gateway_test_data")
    user_port, itinerary_port, recommendation_port, chat_port = (
        _free_port(),
        _free_port(),
        _free_port(),
        _free_port(),
    )

    user_process = _start_service(
        "user-service",
        user_port,
        {
            "USER_DB_PATH": str(data_dir / "user_db.json"),
            # So the admin_user fixture below can register a real admin
            # account - see test_metrics_is_admin_only.py.
            "ADMIN_EMAILS": ADMIN_EMAIL,
        },
    )
    itinerary_process = _start_service(
        "itinerary-service", itinerary_port, {"ITINERARY_DB_PATH": str(data_dir / "itinerary_db.json")}
    )

    user_url = f"http://127.0.0.1:{user_port}"
    itinerary_url = f"http://127.0.0.1:{itinerary_port}"

    _wait_until_healthy(user_url)
    _wait_until_healthy(itinerary_url)

    # Recommendation Service needs to know where the other two are BEFORE
    # it starts, since it reads USER_SERVICE_URL/ITINERARY_SERVICE_URL from
    # its own environment.
    recommendation_process = _start_service(
        "recommendation-service",
        recommendation_port,
        {"USER_SERVICE_URL": user_url, "ITINERARY_SERVICE_URL": itinerary_url},
    )
    recommendation_url = f"http://127.0.0.1:{recommendation_port}"

    # Chat Service needs USER_SERVICE_URL too (to resolve member names -
    # see chat-service/app/user_lookup.py).
    chat_process = _start_service(
        "chat-service",
        chat_port,
        {"USER_SERVICE_URL": user_url, "CHAT_DB_PATH": str(data_dir / "chat_db.json")},
    )
    chat_url = f"http://127.0.0.1:{chat_port}"

    all_processes = (user_process, itinerary_process, recommendation_process, chat_process)
    try:
        _wait_until_healthy(recommendation_url)
        _wait_until_healthy(chat_url)
        yield {
            "user_url": user_url,
            "itinerary_url": itinerary_url,
            "recommendation_url": recommendation_url,
            "chat_url": chat_url,
        }
    finally:
        for process in all_processes:
            process.terminate()
        for process in all_processes:
            process.wait(timeout=10)


@pytest.fixture
def client(live_services, monkeypatch):
    """A TestClient for the Gateway itself, wired up so its proxy routes
    forward to the real live_services subprocesses instead of the
    localhost:8001/8002/8003 defaults - see app/main.py's *_service_url()
    functions."""
    monkeypatch.setenv("USER_SERVICE_URL", live_services["user_url"])
    monkeypatch.setenv("ITINERARY_SERVICE_URL", live_services["itinerary_url"])
    monkeypatch.setenv("RECOMMENDATION_SERVICE_URL", live_services["recommendation_url"])
    monkeypatch.setenv("CHAT_SERVICE_URL", live_services["chat_url"])

    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def registered_user(live_services):
    """Registers a REAL account on the live User Service subprocess, going
    through the exact same HTTP call the frontend would make - just
    directly, instead of through the Gateway, so tests can set up data
    without depending on the very routes they're trying to test."""
    email = f"handy_{uuid.uuid4().hex[:8]}@example.cm"
    response = httpx.post(
        f"{live_services['user_url']}/auth/register",
        json={"name": "Handy Caroline", "email": email, "password": "SuperSecret123"},
        timeout=5.0,
    )
    assert response.status_code == 200, response.text
    token = response.json()["access_token"]
    return {"email": email, "headers": {"Authorization": f"Bearer {token}"}}


@pytest.fixture
def live_gateway(live_services):
    """Starts the GATEWAY ITSELF as a real subprocess, listening on a real
    port - unlike the `client` fixture (TestClient, in-process), which is
    what most tests in this folder use.

    Why this exists: a real race condition lived in app/ws_proxy.py (fixed
    now - see the comment in proxy_websocket()) where a second WebSocket
    client could have its connection "open" from the browser's point of
    view before Chat Service had actually registered it for broadcasts.
    TestClient's synchronous request/response bridging happens to add
    enough scheduling delay between operations that it never reliably
    reproduced the race - only real concurrent sockets, with real network
    timing, did. See test_chat_proxy_race_condition.py.
    """
    port = _free_port()
    process = _start_service(
        "gateway",
        port,
        {
            "USER_SERVICE_URL": live_services["user_url"],
            "ITINERARY_SERVICE_URL": live_services["itinerary_url"],
            "RECOMMENDATION_SERVICE_URL": live_services["recommendation_url"],
            "CHAT_SERVICE_URL": live_services["chat_url"],
        },
    )
    http_url = f"http://127.0.0.1:{port}"
    try:
        _wait_until_healthy(http_url)
        yield {"http_url": http_url, "ws_url": f"ws://127.0.0.1:{port}"}
    finally:
        process.terminate()
        process.wait(timeout=10)


@pytest.fixture
def admin_user(live_services):
    """Registers (or logs into, if a previous test in this session already
    created it) the one email address the live User Service subprocess was
    started with in its ADMIN_EMAILS - see live_services above."""
    register = httpx.post(
        f"{live_services['user_url']}/auth/register",
        json={"name": "Gateway Admin", "email": ADMIN_EMAIL, "password": "SuperSecret123"},
        timeout=5.0,
    )
    if register.status_code == 200:
        token = register.json()["access_token"]
    else:
        login = httpx.post(
            f"{live_services['user_url']}/auth/login",
            json={"email": ADMIN_EMAIL, "password": "SuperSecret123"},
            timeout=5.0,
        )
        assert login.status_code == 200, login.text
        token = login.json()["access_token"]
    return {"email": ADMIN_EMAIL, "headers": {"Authorization": f"Bearer {token}"}}
