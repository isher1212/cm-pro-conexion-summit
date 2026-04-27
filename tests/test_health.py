import pytest
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from fastapi.testclient import TestClient

def test_health_returns_ok():
    from backend.main import app
    client = TestClient(app)
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "version" in data

def test_health_includes_scheduler_status():
    from backend.main import app
    client = TestClient(app)
    response = client.get("/api/health")
    data = response.json()
    assert "scheduler_running" in data
