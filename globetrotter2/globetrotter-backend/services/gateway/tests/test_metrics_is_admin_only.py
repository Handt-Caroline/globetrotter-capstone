# =============================================================================
# tests/test_metrics_is_admin_only.py  -  API GATEWAY
#
# The roles feature says a regular traveller should not see System Health.
# See app/security.py's require_admin and its use on GET/POST /metrics in
# app/main.py.
# =============================================================================


def test_metrics_requires_a_token_at_all(client):
    response = client.get("/metrics")
    assert response.status_code in (401, 422)  # 422: FastAPI's missing-header error


def test_a_regular_user_is_forbidden_from_metrics(client, registered_user):
    response = client.get("/metrics", headers=registered_user["headers"])
    assert response.status_code == 403


def test_an_admin_can_read_metrics(client, admin_user):
    response = client.get("/metrics", headers=admin_user["headers"])
    assert response.status_code == 200
    assert "total_requests" in response.json()


def test_a_regular_user_cannot_reset_metrics(client, registered_user):
    response = client.post("/metrics/reset", headers=registered_user["headers"])
    assert response.status_code == 403


def test_an_admin_can_reset_metrics(client, admin_user):
    response = client.post("/metrics/reset", headers=admin_user["headers"])
    assert response.status_code == 200
