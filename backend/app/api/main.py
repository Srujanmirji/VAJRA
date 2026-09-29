"""Minimal VAJRA API (starter). Extend per docs/API.md."""
from datetime import datetime, timedelta, timezone
from fastapi import FastAPI
from app.tracking.countdown import arrival_countdown

app = FastAPI(title="VAJRA API", version="0.2.0")
LABEL = "Guidance for IMD forecasters"


@app.get("/api/v1/health")
def health():
    return {"status": "ok", "label": LABEL}


@app.get("/api/v1/countdowns/demo")
def demo_countdown():
    """SIMULATED example: 12 ensemble members' arrival times for Kolkata."""
    issued = datetime.now(timezone.utc)
    members = [34, 36, 38, 40, 41, 43, 45, 48, 52, 55, None, None]
    c = arrival_countdown(members, now=issued, issued=issued)
    return {"place": "Kolkata", "window_min": c.window_min, "p_arrival_60min": c.p_arrival_60min,
            "countdown_seconds": c.countdown_seconds, "provenance": "SIMULATED", "label": LABEL}
