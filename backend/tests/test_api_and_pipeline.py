"""Tests for Phase 5: REST API, Replay Controller, CAP Alerts, and WebSocket."""

import pytest
from fastapi.testclient import TestClient

from app.api.main import app, FORECASTER_LABEL


@pytest.fixture
def client():
    return TestClient(app)


def test_api_health(client):
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert "VAJRA" in data["system"]
    assert data["label"] == FORECASTER_LABEL


def test_api_sources(client):
    res = client.get("/api/v1/sources")
    assert res.status_code == 200
    data = res.json()
    assert len(data["sources"]) == 4
    source_ids = [s["id"] for s in data["sources"]]
    assert "radar" in source_ids
    assert "satellite" in source_ids
    assert "lightning" in source_ids
    assert "nwp" in source_ids


def test_api_cycle_latest(client):
    res = client.get("/api/v1/cycle/latest")
    assert res.status_code == 200
    data = res.json()
    assert "stages" in data
    assert len(data["stages"]) >= 7
    assert data["meets_target_latency"] is True


def test_api_fields(client):
    # Reflectivity
    res_dbz = client.get("/api/v1/fields/reflectivity?lead=0")
    assert res_dbz.status_code == 200
    data_dbz = res_dbz.json()
    assert data_dbz["unit"] == "dBZ"
    assert "radar_coverage_mask" in data_dbz
    assert len(data_dbz["data"]) > 0

    # Rain rate at lead 30 min
    res_rain = client.get("/api/v1/fields/rain_rate?lead=30")
    assert res_rain.status_code == 200
    data_rain = res_rain.json()
    assert data_rain["unit"] == "mm/h"
    assert data_rain["lead_minutes"] == 30


def test_api_cells(client):
    res = client.get("/api/v1/cells")
    assert res.status_code == 200
    data = res.json()
    assert "cells" in data
    if len(data["cells"]) > 0:
        c = data["cells"][0]
        assert "max_dbz" in c
        assert "motion" in c
        assert "trend" in c
        assert "reflectivity_sparkline" in c


def test_api_countdowns(client):
    res = client.get("/api/v1/countdowns")
    assert res.status_code == 200
    data = res.json()
    assert "countdowns" in data
    assert len(data["countdowns"]) >= 3


def test_api_confidence_table(client):
    res = client.get("/api/v1/confidence-table")
    assert res.status_code == 200
    data = res.json()
    assert "confidence_by_hazard_and_lead" in data
    conf = data["confidence_by_hazard_and_lead"]
    assert "lightning" in conf
    assert "0-1h" in conf["lightning"]


def test_api_alerts_lifecycle(client):
    # Get alerts
    res = client.get("/api/v1/alerts")
    assert res.status_code == 200
    data = res.json()
    assert "alerts" in data

    if len(data["alerts"]) > 0:
        a = data["alerts"][0]
        alert_id = a["alert_id"]
        assert a["approval_status"] == "PENDING_IMD_APPROVAL"
        assert "cap_xml" in a
        assert "urn:oasis:names:tc:emergency:cap:1.2" in a["cap_xml"]

        # Approve alert
        res_app = client.post(f"/api/v1/alerts/{alert_id}/approve")
        assert res_app.status_code == 200
        assert res_app.json()["status"] == "APPROVED"

        # Check status updated
        res_after = client.get("/api/v1/alerts")
        a_updated = next(x for x in res_after.json()["alerts"] if x["alert_id"] == alert_id)
        assert a_updated["approval_status"] == "APPROVED"


def test_api_verification(client):
    res = client.get("/api/v1/verification")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "COMPUTED"
    assert "skill_curve" in data
    assert len(data["skill_curve"]) > 0


def test_api_replay_controls(client):
    res_step = client.post("/api/v1/replay/step")
    assert res_step.status_code == 200

    res_speed = client.post("/api/v1/replay/speed?speed=60.0")
    assert res_speed.status_code == 200
    assert res_speed.json()["speed"] == 60.0


def test_websocket_cycle(client):
    with client.websocket_connect("/ws/cycle") as ws:
        # Receive initial cycle payload
        msg = ws.receive_json()
        assert msg["type"] == "CYCLE_UPDATE"
