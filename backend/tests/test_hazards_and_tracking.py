"""Tests for Phase 3: Convective Initiation, Hazard Diagnostics, and Tracking/Countdowns."""

import pytest
import numpy as np
from datetime import datetime, timezone, timedelta

from app.config import MonitoredPlace, REGIONS
from app.ci.detector import ConvectiveInitiationDetector
from app.hazards.lightning import evaluate_lightning_hazard
from app.hazards.hail import evaluate_hail_hazard
from app.hazards.downburst import detect_downburst_hazard
from app.tracking.cell_tracker import StormCellTracker
from app.tracking.countdown import evaluate_places_countdowns, arrival_countdown


def test_convective_initiation_detector():
    """Verify satellite cloud-top cooling detects new initiating convective cells."""
    ny, nx = 50, 50
    lat_grid, lon_grid = np.meshgrid(np.linspace(22.0, 24.0, ny), np.linspace(87.0, 89.0, nx), indexing="ij")

    # t - 15 min: Warm cumulus cloud top (275 K)
    ir_prev = np.full((ny, nx), 280.0, dtype=np.float32)
    ir_prev[20:28, 20:28] = 270.0

    # t = 0 min: Rapidly cooling overshooting tower (temperature drops to 230 K => -40 K / 15 min)
    ir_curr = np.full((ny, nx), 280.0, dtype=np.float32)
    ir_curr[20:28, 20:28] = 230.0

    # Radar reflectivity: currently pre-echo (< 15 dBZ)
    radar_dbz = np.full((ny, nx), -10.0, dtype=np.float32)

    detector = ConvectiveInitiationDetector(cooling_threshold_k_15min=-4.0)
    candidates, prob_grid = detector.detect(
        current_ir_k=ir_curr,
        previous_ir_k=ir_prev,
        lat_grid=lat_grid,
        lon_grid=lon_grid,
        current_radar_dbz=radar_dbz,
        time_delta_minutes=15.0,
    )

    assert len(candidates) >= 1
    c = candidates[0]
    assert c.cooling_rate_k_15min <= -15.0
    assert c.min_brightness_temp_k <= 235.0
    assert c.ci_probability >= 0.70
    assert c.estimated_time_to_echo_min <= 20
    assert c.status == "VIGOROUS_INITIATION"


def test_lightning_hazard_evaluation():
    """Verify lightning probability and flash jump calculation."""
    ny, nx = 40, 40
    dbz = np.full((ny, nx), 20.0, dtype=np.float32)
    ir = np.full((ny, nx), 270.0, dtype=np.float32)
    curr_density = np.zeros((ny, nx), dtype=np.float32)
    prev_density = np.zeros((ny, nx), dtype=np.float32)

    # Severe core area with high lightning
    dbz[15:25, 15:25] = 52.0
    ir[15:25, 15:25] = 210.0
    curr_density[18:22, 18:22] = 4.5
    prev_density[18:22, 18:22] = 0.5  # jump of +4 strokes / km^2

    prob_grid, exp_density, meta = evaluate_lightning_hazard(
        current_density=curr_density,
        previous_density=prev_density,
        radar_dbz=dbz,
        satellite_ir_k=ir,
    )

    assert meta["lightning_jump_detected"] is True
    assert np.max(prob_grid) >= 0.85
    assert np.max(exp_density) > 30.0  # high hourly flash rate


def test_hail_hazard_evaluation():
    """Verify hail probability (POH) and MESH size estimation."""
    ny, nx = 30, 30
    dbz = np.full((ny, nx), 30.0, dtype=np.float32)
    ir = np.full((ny, nx), 260.0, dtype=np.float32)

    # Mature supercell hail core: 62 dBZ with cold top 205 K
    dbz[10:18, 10:18] = 62.0
    ir[10:18, 10:18] = 205.0

    poh, mesh, meta = evaluate_hail_hazard(radar_dbz=dbz, satellite_ir_k=ir)

    assert meta["severe_hail_detected"] is True
    assert np.max(poh) >= 0.90
    assert np.max(mesh) >= 30.0  # Large hail (> 30 mm)


def test_downburst_hazard_detection():
    """Verify radial velocity divergence dipole triggers downburst event with outflow speed."""
    ny, nx = 40, 40
    lat_grid, lon_grid = np.meshgrid(np.linspace(22.0, 23.0, ny), np.linspace(88.0, 89.0, nx), indexing="ij")
    
    dbz = np.full((ny, nx), 20.0, dtype=np.float32)
    dbz[18:24, 18:24] = 54.0  # Precipitation core
    
    # Velocity field with divergence dipole: -12 m/s upwind, +14 m/s downwind => 26 m/s span
    vrad = np.zeros((ny, nx), dtype=np.float32)
    vrad[18:24, 17:20] = -12.0
    vrad[18:24, 21:24] = +14.0

    events, prob, meta = detect_downburst_hazard(
        vrad=vrad,
        current_dbz=dbz,
        previous_dbz=None,
        lat_grid=lat_grid,
        lon_grid=lon_grid,
        divergence_threshold_ms=20.0,
    )

    assert len(events) >= 1
    ev = events[0]
    assert ev.max_divergence_ms >= 24.0
    assert ev.estimated_outflow_speed_ms >= 25.0
    assert ev.severity == "SEVERE_DOWNBURST"
    assert ev.lead_time_minutes <= 15


def test_storm_cell_tracker():
    """Verify cell identification, motion vector estimation, and tracking continuity."""
    ny, nx = 50, 50
    lat_grid, lon_grid = np.meshgrid(np.linspace(22.0, 23.0, ny), np.linspace(88.0, 89.0, nx), indexing="ij")

    tracker = StormCellTracker(min_dbz=40.0, min_area_km2=10.0)

    # Frame 1: Cell at (20, 20)
    dbz1 = np.full((ny, nx), 10.0, dtype=np.float32)
    dbz1[18:24, 18:24] = 52.0
    cells1 = tracker.update(dbz1, lat_grid, lon_grid)

    assert len(cells1) == 1
    c1 = cells1[0]
    assert c1.cell_id == "CELL-01"
    assert c1.max_dbz == 52.0

    # Frame 2 (5 min later): Cell shifted to (19, 23) - moved ESE
    dbz2 = np.full((ny, nx), 10.0, dtype=np.float32)
    dbz2[17:23, 21:27] = 56.0  # Intensified
    cells2 = tracker.update(dbz2, lat_grid, lon_grid)

    assert len(cells2) == 1
    c2 = cells2[0]
    # Continuity of identity
    assert c2.cell_id == "CELL-01"
    assert c2.trend == "INTENSIFYING"
    assert c2.max_dbz == 56.0
    # Sparkline contains history
    assert len(c2.reflectivity_sparkline) == 2
    assert c2.reflectivity_sparkline == [52.0, 56.0]
    # Motion vector
    assert c2.motion_speed_kmh > 10.0


def test_evaluate_places_countdowns():
    """Verify monitored places countdowns with honest windows and probability."""
    t0 = datetime(2026, 5, 15, 12, 0, 0, tzinfo=timezone.utc)
    ny, nx = 60, 60
    lat_grid, lon_grid = np.meshgrid(np.linspace(22.0, 23.5, ny), np.linspace(87.5, 89.0, nx), indexing="ij")

    # Target place: Kolkata Airport (VECC) at lat 22.65, lon 88.45
    airport = MonitoredPlace(name="Kolkata Airport", code="CCU", lat=22.65, lon=88.45, type="airport")
    # Control place: Safe town far away (lat 22.1, lon 87.6)
    far_town = MonitoredPlace(name="Far Town", code="FAR", lat=22.10, lon=87.60, type="city")

    # Synthetic ensemble rain rate: (n_members=10, n_leads=12, ny=60, nx=60)
    # Storm approaches airport around step 6-8 (30-40 min)
    ensemble_rain = np.zeros((10, 12, ny, nx), dtype=np.float32)
    # Distance to airport
    d_lat = (lat_grid - airport.lat) * 111.0
    d_lon = (lon_grid - airport.lon) * 103.0
    dist_airport = np.sqrt(d_lat**2 + d_lon**2)

    # 8 out of 10 members hit the airport at steps 6, 7, 8 (30 to 40 min)
    for m in range(8):
        lead_hit = 6 + (m % 3)
        ensemble_rain[m, lead_hit:, dist_airport <= 5.0] = 45.0

    countdowns = evaluate_places_countdowns(
        places=[airport, far_town],
        ensemble_rain_rate=ensemble_rain,
        lat_grid=lat_grid,
        lon_grid=lon_grid,
        issued_time=t0,
        now_time=t0,
        threshold_mmh=20.0,
    )

    assert len(countdowns) == 2
    ccu_cd = next(c for c in countdowns if c.place_code == "CCU")
    far_cd = next(c for c in countdowns if c.place_code == "FAR")

    # Airport has approaching storm
    assert ccu_cd.approaching is True
    assert ccu_cd.probability_pct == 80  # 8 / 10 = 80%
    assert ccu_cd.window_min is not None
    assert ccu_cd.countdown_seconds is not None
    assert ccu_cd.countdown_seconds > 0
    assert ":" in ccu_cd.countdown_display

    # Far town has no threat
    assert far_cd.approaching is False
    assert far_cd.probability_pct == 0
    assert far_cd.countdown_display == "--:--"
    assert far_cd.window_display == "No threat within 60 min"
