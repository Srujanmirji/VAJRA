"""Tests for Phase 2: Radar QC, 1 km Fusion Grid, and PySteps Baseline Nowcast."""

import pytest
import numpy as np
from datetime import datetime, timezone

from app.config import ProvenanceType, settings
from app.adapters.radar_source import RadarSource
from app.adapters.satellite_source import SatelliteSource
from app.adapters.lightning_source import LightningSource
from app.adapters.nwp_source import NWPSource
from app.fusion.qc import (
    remove_speckle,
    filter_ground_clutter,
    attenuation_correction_hook,
    zr_reflectivity_to_rain_rate,
)
from app.fusion.grid import FusionEngine, FusedSnapshot
from app.nowcast.optical_flow import compute_optical_flow, extrapolate_field
from app.nowcast.ensemble import STEPSNowcastEnsemble


def test_qc_remove_speckle():
    """Verify that isolated small noise pixels are removed while contiguous storm cores are preserved."""
    grid = np.full((30, 30), -15.0, dtype=np.float32)
    # Contiguous storm cell (5x5 pixels = 25 km^2)
    grid[10:15, 10:15] = 45.0
    # Isolated speckles (1-pixel and 2-pixel blips)
    grid[2, 2] = 50.0
    grid[25, 25:27] = 40.0

    cleaned = remove_speckle(grid, min_cluster_pixels=3, threshold_dbz=10.0)

    # Main core must remain 45 dBZ
    assert np.all(cleaned[10:15, 10:15] == 45.0)
    # Isolated speckles must be reset to background
    assert cleaned[2, 2] == -15.0
    assert np.all(cleaned[25, 25:27] == -15.0)


def test_qc_ground_clutter_filter():
    """Verify high-texture clutter with near-zero Doppler velocity is suppressed."""
    dbz = np.full((30, 30), -15.0, dtype=np.float32)
    vrad = np.zeros((30, 30), dtype=np.float32)

    # Real storm: smooth texture, moving fast
    dbz[10:18, 10:18] = 48.0
    vrad[10:18, 10:18] = 15.0  # 15 m/s

    # Ground clutter patch: erratic texture with 0 m/s Doppler
    rng = np.random.default_rng(123)
    dbz[2, 2:8] = rng.uniform(48.0, 65.0, size=6)
    vrad[2, 2:8] = 0.1  # Stationary clutter

    cleaned_dbz, clutter_mask = filter_ground_clutter(dbz, vrad=vrad)

    # Clutter detected and filtered
    assert np.any(clutter_mask[2, 2:8])
    assert np.all(cleaned_dbz[12:16, 12:16] == 48.0)


def test_qc_attenuation_correction_and_zr_conversion():
    """Verify Hitschfeld-Bordan attenuation hook and Marshall-Palmer Z-R calculation."""
    dbz = np.full((20, 20), -15.0, dtype=np.float32)
    dbz[5:15, 5:15] = 50.0  # Intense rain core

    corrected = attenuation_correction_hook(dbz, dr_km=1.0, max_correction_db=6.0)
    # Reflectivity along path should be greater or equal to raw
    assert np.all(corrected[5:15, 5:15] >= dbz[5:15, 5:15])
    assert np.max(corrected) <= 56.0  # Within max_correction_db

    # Test Z-R conversion: Marshall-Palmer Z = 300 * R^1.4
    raw_rain = zr_reflectivity_to_rain_rate(dbz, a=300.0, b=1.4)
    # 50 dBZ gives ~62.7 mm/h
    assert 40.0 < np.max(raw_rain) < 80.0

    # Attenuation-corrected 56 dBZ gives ~170 mm/h
    corrected_rain = zr_reflectivity_to_rain_rate(corrected, a=300.0, b=1.4)
    assert 140.0 < np.max(corrected_rain) < 200.0

    # Test gauge bias scaling hook (1.2x adjustment)
    biased_rain = zr_reflectivity_to_rain_rate(dbz, a=300.0, b=1.4, gauge_bias_factor=1.2)
    assert np.isclose(np.max(biased_rain), np.max(raw_rain) * 1.2, rtol=1e-3)


def test_fusion_engine_grid_and_coverage():
    """Verify multi-source fusion on the 1 km grid and coverage masking."""
    engine = FusionEngine(region_id="kolkata")

    radar_src = RadarSource(mode="SIMULATED", region_id="kolkata")
    sat_src = SatelliteSource(mode="SIMULATED", region_id="kolkata")
    lght_src = LightningSource(mode="SIMULATED", region_id="kolkata")
    nwp_src = NWPSource(mode="SIMULATED", region_id="kolkata")

    r_frame = radar_src.fetch_latest(step_index=0)
    s_frame = sat_src.fetch_latest(step_index=0)
    l_list = lght_src.fetch_latest(step_index=0)
    n_field = nwp_src.fetch_latest(lead_minutes=60)

    fused = engine.fuse(r_frame, s_frame, l_list, n_field)

    assert isinstance(fused, FusedSnapshot)
    assert fused.region_id == "kolkata"
    assert fused.lat_grid.shape == (engine.ny, engine.nx)
    assert fused.reflectivity_qc.shape == (engine.ny, engine.nx)
    assert fused.satellite_ir_k.shape == (engine.ny, engine.nx)
    assert fused.lightning_density.shape == (engine.ny, engine.nx)
    assert fused.radar_coverage_mask.shape == (engine.ny, engine.nx)

    # Coverage mask contains both inside (1) and outside (0) areas
    assert 1 in fused.radar_coverage_mask
    # Inside coverage, radar reflectivity can be active
    inside_mask = fused.radar_coverage_mask == 1
    assert np.max(fused.reflectivity_qc[inside_mask]) > 50.0
    # Outside coverage, radar data is masked (-32.0 dBZ)
    outside_mask = fused.radar_coverage_mask == 0
    if np.any(outside_mask):
        assert np.all(fused.reflectivity_qc[outside_mask] == -32.0)

    # Lightning strokes converted to non-zero flash density
    assert np.max(fused.lightning_density) > 0.0


def test_optical_flow_and_extrapolation():
    """Verify Lucas-Kanade optical flow extraction and semi-Lagrangian advection."""
    # Create two synthetic frames with a storm cell translating eastward
    ny, nx = 80, 80
    f1 = np.zeros((ny, nx), dtype=np.float32)
    f2 = np.zeros((ny, nx), dtype=np.float32)

    # Frame 1: center at (40, 30)
    y, x = np.ogrid[:ny, :nx]
    f1 = 55.0 * np.exp(-((y - 40)**2 + (x - 30)**2) / (2 * 6**2))
    # Frame 2 (5 min later): center shifted east by 4 pixels to (40, 34)
    f2 = 55.0 * np.exp(-((y - 40)**2 + (x - 34)**2) / (2 * 6**2))

    frames = np.stack([f1, f2], axis=0)
    velocity = compute_optical_flow(frames)

    assert velocity.shape == (2, ny, nx)
    # Mean eastward motion (u) near storm center should be positive (~4 px/step)
    u_storm = velocity[0, 38:42, 32:36]
    assert np.mean(u_storm) > 1.5, f"Expected positive eastward motion, got {np.mean(u_storm)}"

    # Extrapolate forward 6 steps (30 min)
    lead_steps = 6
    extrap = extrapolate_field(f2, velocity, lead_steps=lead_steps)

    assert extrap.shape == (lead_steps, ny, nx)
    # The cell in final lead step must have moved further east
    max_pos_init = np.unravel_index(np.argmax(f2), f2.shape)
    max_pos_final = np.unravel_index(np.argmax(extrap[-1]), extrap[-1].shape)
    assert max_pos_final[1] > max_pos_init[1], "Extrapolated cell should translate eastward"


def test_steps_nowcast_ensemble():
    """Verify STEPS stochastic ensemble generates perturbed members and probabilistic outputs."""
    ny, nx = 60, 60
    field = np.zeros((ny, nx), dtype=np.float32)
    y, x = np.ogrid[:ny, :nx]
    field = 50.0 * np.exp(-((y - 30)**2 + (x - 30)**2) / (2 * 8**2))

    u = np.full((ny, nx), 2.0, dtype=np.float32)
    v = np.zeros((ny, nx), dtype=np.float32)
    velocity = np.stack([u, v], axis=0)

    ensemble_engine = STEPSNowcastEnsemble(n_members=12, seed=101)
    forecasts = ensemble_engine.generate_ensemble(field, velocity, lead_steps=6)

    # Check shape: (n_members=12, lead_steps=6, ny=60, nx=60)
    assert forecasts.shape == (12, 6, ny, nx)

    # Member 0 is deterministic baseline
    # Other members should have slight variance due to perturbations
    var_across_members = np.var(forecasts[:, 5, 30, 42])
    assert var_across_members > 0.0, "Ensemble members should exhibit spread"

    # Test exceedance probability
    prob_heavy = ensemble_engine.compute_exceedance_probability(forecasts, threshold=30.0)
    assert prob_heavy.shape == (6, ny, nx)
    assert np.all((prob_heavy >= 0.0) & (prob_heavy <= 1.0))
    # Near cell center at lead step 0, probability should be 1.0
    assert prob_heavy[0, 30, 32] == 1.0
