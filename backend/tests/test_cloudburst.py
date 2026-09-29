import numpy as np
from app.hazards.cloudburst import cloudburst_clusters, cloudburst_probability


def test_detects_cluster_above_threshold_and_area():
    r = np.zeros((20, 20)); r[5:10, 5:10] = 120   # 25 km^2 at >=100 mm/h
    c = cloudburst_clusters(r)
    assert len(c) == 1 and c[0]["area_km2"] == 25 and c[0]["max_mm"] == 120


def test_ignores_small_or_weak_clusters():
    r = np.zeros((20, 20)); r[0:3, 0:3] = 150      # 9 km^2 too small
    r[10:16, 10:16] = 90                           # below threshold
    assert cloudburst_clusters(r) == []


def test_probability_over_members():
    a = np.zeros((10, 10)); b = a.copy(); b[0:5, 0:5] = 110
    assert cloudburst_probability(np.stack([a, b])) == 0.5
