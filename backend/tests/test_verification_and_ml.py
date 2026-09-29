"""Tests for Phase 4: Blending, ML Model, and Verification on Real Replay Data."""

import pytest
import numpy as np
import torch

from app.blend.blender import get_blend_weights_for_lead, blend_nowcast_with_nwp
from app.nowcast.ml_model import VajraNowcastUNet, MLNowcastEngine
from app.verification.metrics import (
    compute_contingency_table,
    compute_csi_pod_far,
    compute_fractions_skill_score,
    compute_brier_score_and_reliability,
    evaluate_forecast_lead_curve,
    derive_confidence_table,
)


def test_blending_weights_sum_to_one_across_lead_times():
    """Verify nowcast-NWP blend weights are non-negative, respect floor, and sum to 1 across 0-360 min."""
    lead_times = [0, 15, 30, 60, 90, 120, 180, 240, 300, 360]
    previous_nowcast_weight = 1.1

    for lead in lead_times:
        w = get_blend_weights_for_lead(lead, floor=0.05)
        # Sum to 1
        assert np.isclose(w["nowcast"] + w["nwp"], 1.0, atol=1e-6)
        # Floor respected
        assert w["nowcast"] >= 0.05 - 1e-6
        assert w["nwp"] >= 0.05 - 1e-6
        # Nowcast weight decays or stays steady as lead time advances
        assert w["nowcast"] <= previous_nowcast_weight + 1e-6
        previous_nowcast_weight = w["nowcast"]

    # Test field blending
    f_now = np.full((10, 10), 40.0, dtype=np.float32)
    f_nwp = np.full((10, 10), 10.0, dtype=np.float32)
    blended_60, w60 = blend_nowcast_with_nwp(f_now, f_nwp, lead_minutes=60)
    assert np.allclose(blended_60, w60["nowcast"] * 40.0 + w60["nwp"] * 10.0)


def test_ml_nowcast_unet_forward():
    """Verify PyTorch multi-source U-Net forward pass and prediction shape."""
    model = VajraNowcastUNet(in_channels=9, out_channels=4)
    model.eval()

    # Batch of 1, 9 channels (3 radar + 3 IR + 3 lightning), grid size (64, 64)
    x = torch.randn(1, 9, 64, 64)
    with torch.no_grad():
        out = model(x)

    assert out.shape == (1, 4, 64, 64)
    # ReLU ensures non-negative reflectivity
    assert torch.all(out >= 0.0)

    # Test MLNowcastEngine predict wrapper
    engine = MLNowcastEngine()
    r_frames = [np.full((40, 40), 30.0, dtype=np.float32) for _ in range(3)]
    s_frames = [np.full((40, 40), 250.0, dtype=np.float32) for _ in range(3)]
    l_frames = [np.full((40, 40), 1.0, dtype=np.float32) for _ in range(3)]

    pred = engine.predict(r_frames, s_frames, l_frames)
    assert pred.shape == (4, 40, 40)
    assert np.all(pred >= 0.0)


def test_verification_contingency_and_csi():
    """Verify CSI, POD, FAR calculations on synthetic ground truth."""
    obs = np.zeros((20, 20), dtype=np.float32)
    obs[5:15, 5:15] = 45.0  # Observed storm (100 pixels)

    # Perfect forecast
    csi_perf, pod_perf, far_perf = compute_csi_pod_far(obs, obs, threshold=35.0)
    assert csi_perf == 1.0
    assert pod_perf == 1.0
    assert far_perf == 0.0

    # Half overlap forecast: forecast shifted by 5 pixels
    fcst_half = np.zeros((20, 20), dtype=np.float32)
    fcst_half[5:15, 10:20] = 45.0
    # Overlap is 5:15, 10:15 (50 pixels hits, 50 misses, 50 false alarms)
    csi_half, pod_half, far_half = compute_csi_pod_far(fcst_half, obs, threshold=35.0)
    # CSI = 50 / (50 + 50 + 50) = 0.3333
    assert np.isclose(csi_half, 1 / 3, atol=1e-3)
    assert np.isclose(pod_half, 0.5, atol=1e-3)
    assert np.isclose(far_half, 0.5, atol=1e-3)


def test_fractions_skill_score_scales():
    """Verify FSS increases monotonically with neighborhood scale."""
    obs = np.zeros((40, 40), dtype=np.float32)
    obs[20, 20] = 45.0  # Point storm

    # Forecast displaced by 3 pixels (20, 23)
    fcst = np.zeros((40, 40), dtype=np.float32)
    fcst[20, 23] = 45.0

    fss = compute_fractions_skill_score(fcst, obs, threshold=35.0, scales_km=[1, 4, 8, 16])
    # At 1 km (single pixel), displacement means FSS is 0
    assert fss[1] == 0.0
    # At larger scales covering the 3-pixel separation, FSS becomes positive and approaches 1.0
    assert fss[8] > 0.0
    assert fss[16] >= fss[8]


def test_brier_score_and_confidence_table():
    """Verify Brier Score and derivation of honest confidence table."""
    prob = np.array([[0.8, 0.2], [0.9, 0.1]], dtype=np.float32)
    obs = np.array([[1, 0], [1, 0]], dtype=np.float32)

    bs, rel = compute_brier_score_and_reliability(prob, obs)
    assert 0.0 <= bs <= 0.10
    assert len(rel) == 10

    # Test confidence table derivation
    curve = [
        {"lead_minutes": 15, "csi": 0.72},
        {"lead_minutes": 30, "csi": 0.65},
        {"lead_minutes": 60, "csi": 0.55},
        {"lead_minutes": 90, "csi": 0.42},
        {"lead_minutes": 120, "csi": 0.35},
    ]
    conf = derive_confidence_table(curve)
    assert "convective_initiation" in conf
    assert "lightning" in conf
    assert "hail" in conf
    assert "downburst" in conf
    assert "cloudburst" in conf
    assert conf["lightning"]["0-1h"] == "HIGH"
    assert "LOW" in conf["downburst"]["1-2h"]
