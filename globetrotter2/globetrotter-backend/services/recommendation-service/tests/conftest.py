# =============================================================================
# tests/conftest.py  -  RECOMMENDATION SERVICE
#
# Two very different kinds of test live in this folder, so this file sets
# up fixtures for both:
#
#   test_recommendations_scoring.py
#       Tests the SCORING ALGORITHM only. It monkeypatches app.clients so
#       no network call happens at all - fast, deterministic, and it will
#       still pass even if User/Itinerary Service can't run on this
#       machine. Good for "does the math work".
#
#   test_inter_service_integration.py
#       The real deal: launches ACTUAL User Service and Itinerary Service
#       as their own subprocesses (their own Python venv, their own port,
#       their own throwaway data file), and proves Recommendation Service
#       gets a correct answer by really calling them over HTTP - loopback
#       TCP, real JSON over the wire, nothing mocked. This is the test that
#       actually demonstrates "microservices communicating via REST".
#
# See the `live_services` fixture below for how the subprocesses are
# started, waited for, and cleaned up.
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

from app import metrics  # noqa: E402
from app.main import app, get_http_client  # noqa: E402

SERVICES_ROOT = Path(__file__).resolve().parent.parent.parent  # .../globetrotter/services
TEST_JWT_SECRET = "test-secret-shared-by-every-service-in-this-test-run"


@pytest.fixture(autouse=True)
def reset_metrics():
    metrics.reset()
    yield


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def _free_port() -> int:
    """Ask the OS for a port nobody is using right now, so test runs never
    collide with a developer's own uvicorn already running on 8001/8002."""
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
    """Launches one sibling service (user-service or itinerary-service) as
    a real subprocess, using THAT service's own virtual environment (so it
    has its own dependencies installed) and its own throwaway data file."""
    service_dir = SERVICES_ROOT / folder_name
    python_exe = service_dir / ".venv" / "Scripts" / "python.exe"  # Windows venv layout
    if not python_exe.is_file():
        pytest.skip(
            f"{folder_name} has no .venv at {python_exe} - set it up with "
            f"'python -m venv .venv && .venv\\Scripts\\python.exe -m pip install -r requirements.txt' "
            f"before running the inter-service integration tests."
        )

    # Start from a full copy of THIS process's environment (Windows needs
    # things like SYSTEMROOT to even initialise sockets/DNS - stripping the
    # environment down to one or two variables causes cryptic WinError
    # failures) and layer the test-specific overrides on top.
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
    """Starts REAL User Service and Itinerary Service processes once for
    the whole test session, and tears them down afterwards. Yields their
    base URLs so tests can point Recommendation Service's HTTP client at
    them, and can also call them directly (e.g. to register a user)."""
    data_dir = tmp_path_factory.mktemp("inter_service_data")
    user_port = _free_port()
    itinerary_port = _free_port()

    user_process = _start_service(
        "user-service", user_port, {"USER_DB_PATH": str(data_dir / "user_db.json")}
    )
    itinerary_process = _start_service(
        "itinerary-service", itinerary_port, {"ITINERARY_DB_PATH": str(data_dir / "itinerary_db.json")}
    )

    user_url = f"http://127.0.0.1:{user_port}"
    itinerary_url = f"http://127.0.0.1:{itinerary_port}"

    try:
        _wait_until_healthy(user_url)
        _wait_until_healthy(itinerary_url)
        yield {"user_url": user_url, "itinerary_url": itinerary_url}
    finally:
        user_process.terminate()
        itinerary_process.terminate()
        user_process.wait(timeout=10)
        itinerary_process.wait(timeout=10)


@pytest.fixture
def live_client(live_services, monkeypatch):
    """A TestClient for THIS service (Recommendation Service), wired up so
    its outbound calls go to the real live_services subprocesses instead
    of localhost:8001/8002 (the defaults - see app/clients.py)."""
    monkeypatch.setenv("USER_SERVICE_URL", live_services["user_url"])
    monkeypatch.setenv("ITINERARY_SERVICE_URL", live_services["itinerary_url"])
    monkeypatch.setenv("GLOBETROTTER_JWT_SECRET", TEST_JWT_SECRET)

    # Recommendation Service's own JWT check (require_auth) reads the
    # secret at import time in app/security.py, which already ran before
    # this fixture set the env var - reach in and patch it directly so
    # this process agrees with the subprocesses on what a valid token
    # looks like.
    import app.security as recommendation_security

    monkeypatch.setattr(recommendation_security, "JWT_SECRET", TEST_JWT_SECRET)

    real_client = httpx.Client(timeout=5.0)
    app.dependency_overrides[get_http_client] = lambda: real_client
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.pop(get_http_client, None)
    real_client.close()


@pytest.fixture
def registered_user(live_services):
    """Registers a REAL account on the live User Service subprocess and
    returns a ready-made auth header - built the same way the frontend
    would, by actually calling POST /auth/register over HTTP."""
    email = f"handy_{uuid.uuid4().hex[:8]}@example.cm"
    response = httpx.post(
        f"{live_services['user_url']}/auth/register",
        json={"name": "Handy Caroline", "email": email, "password": "SuperSecret123"},
        timeout=5.0,
    )
    assert response.status_code == 200, response.text
    token = response.json()["access_token"]
    return {"email": email, "headers": {"Authorization": f"Bearer {token}"}}
