"""API integration tests using TestClient."""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch


@pytest.fixture
def client():
    from app.main import app
    from app.db import init_db
    init_db()
    return TestClient(app)


def test_health_endpoint(client):
    """Health endpoint should return 200."""
    resp = client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "version" in data


def test_forecast_invalid_date(client):
    """Non-January date should return 400."""
    resp = client.get("/api/forecast/latest?delivery_date=2026-03-01")
    assert resp.status_code == 400


def test_forecast_empty_without_data(client):
    """Without data loaded, forecast should return empty but valid response."""
    resp = client.get("/api/forecast/latest?delivery_date=2026-01-15")
    # Should be 200 with empty forecast_points
    assert resp.status_code == 200
    data = resp.json()
    assert "forecast_points" in data
    assert "delivery_date" in data


def test_actuals_endpoint(client):
    """Actuals endpoint should return 200."""
    resp = client.get("/api/actuals/?start_date=2026-01-01&end_date=2026-01-01")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
