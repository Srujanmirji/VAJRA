"""Cloudburst detection following IMD's definition:
rainfall of at least 100 mm in one hour over roughly 20-30 km^2."""
from __future__ import annotations
import numpy as np
from scipy import ndimage


def cloudburst_clusters(rain_1h_mm: np.ndarray, cell_area_km2: float = 1.0,
                        threshold_mm: float = 100.0, min_area_km2: float = 20.0) -> list[dict]:
    """Return contiguous clusters where 1-h rainfall >= threshold covers >= min area.

    Args:
        rain_1h_mm: 2-D array of 1-hour accumulations (mm) on the fusion grid.
        cell_area_km2: area of one grid cell (1.0 for the 1 km grid).
    """
    if rain_1h_mm.ndim != 2:
        raise ValueError("rain_1h_mm must be 2-D")
    mask = np.nan_to_num(rain_1h_mm, nan=0.0) >= threshold_mm
    labels, n = ndimage.label(mask, structure=np.ones((3, 3), dtype=int))
    clusters = []
    for k in range(1, n + 1):
        cells = labels == k
        area = float(cells.sum() * cell_area_km2)
        if area >= min_area_km2:
            ys, xs = np.nonzero(cells)
            clusters.append({
                "label": k,
                "area_km2": area,
                "max_mm": float(rain_1h_mm[cells].max()),
                "centroid": (float(ys.mean()), float(xs.mean())),
            })
    return clusters


def cloudburst_probability(member_rain_1h_mm: np.ndarray, **kwargs) -> float:
    """Fraction of ensemble members (axis 0) containing at least one cloudburst cluster."""
    hits = sum(bool(cloudburst_clusters(m, **kwargs)) for m in member_rain_1h_mm)
    return hits / len(member_rain_1h_mm)
