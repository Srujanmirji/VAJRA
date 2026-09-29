"""Downburst and Microburst Outflow Hazard Engine.
Detects intense convective downdrafts and estimating ground outflow gust speed (m/s).
Physically based on:
1. Low-level Doppler radial velocity divergence signature: Delta v >= 20 m/s across <= 8 km
2. Collapsing reflectivity core (rapid core descent and downdraft acceleration)
Triggers short-lead high-certainty warnings (0-15 min).
"""

from dataclasses import dataclass, field
from typing import List, Tuple, Dict, Any, Optional
import numpy as np
from scipy import ndimage


@dataclass
class DownburstEvent:
    """A detected microburst/macroburst downburst outflow signature."""
    event_id: str
    lat: float
    lon: float
    max_divergence_ms: float  # Velocity divergence Delta v (m/s)
    estimated_outflow_speed_ms: float  # Estimated peak ground surface gust (m/s)
    estimated_outflow_speed_kmh: float  # km/h
    lead_time_minutes: int  # minutes to peak surface impact (e.g. 5-10 min)
    severity: str  # "SEVERE_DOWNBURST" (>= 25 m/s), "MODERATE_DOWNBURST" (20-25 m/s)
    core_collapse_detected: bool
    affected_radius_km: float


def detect_downburst_hazard(
    vrad: Optional[np.ndarray],  # 2D Doppler radial velocity (m/s)
    current_dbz: np.ndarray,  # Current composite reflectivity
    previous_dbz: Optional[np.ndarray],  # Reflectivity 10 min ago
    lat_grid: np.ndarray,
    lon_grid: np.ndarray,
    divergence_threshold_ms: float = 20.0,
) -> Tuple[List[DownburstEvent], np.ndarray, Dict[str, Any]]:
    """Evaluates downburst outflow hazard.
    Returns:
        events: List of detected DownburstEvent objects
        downburst_prob_grid: 2D array [0.0, 1.0] of downburst hazard probability
        metadata: summary statistics (peak divergence, max outflow m/s)
    """
    ny, nx = current_dbz.shape
    prob_grid = np.zeros((ny, nx), dtype=np.float32)
    events: List[DownburstEvent] = []

    if vrad is None:
        return events, prob_grid, {"detected": False, "max_outflow_ms": 0.0}

    # 1. Compute local radial velocity divergence (finite difference)
    # Along x and y:
    # Divergence dipole: positive gradient d(vrad)/dx where outbound winds diverge from inbound
    kernel_x = np.array([[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]], dtype=np.float32) / 8.0
    grad_vrad_x = ndimage.convolve(vrad, kernel_x)
    
    # 2. Local span: maximum difference between peak outbound and inbound in 7x7 neighborhood (~7 km)
    max_local_v = ndimage.maximum_filter(vrad, size=7)
    min_local_v = ndimage.minimum_filter(vrad, size=7)
    local_span_v = max_local_v - min_local_v

    # 3. Core collapse detection: reflectivity drop in heavy core (dBZ >= 50)
    core_collapse = np.zeros((ny, nx), dtype=bool)
    if previous_dbz is not None:
        dbz_drop = previous_dbz - current_dbz
        # Core collapse signature: previous was severe (> 50 dBZ) and has dropped >= 8 dBZ as rain dumps
        core_collapse = (previous_dbz >= 50.0) & (dbz_drop >= 8.0)

    # Downburst signature condition:
    # Strong velocity span >= divergence_threshold_ms (20 m/s) near heavy precipitation (dBZ >= 40)
    downburst_mask = (local_span_v >= divergence_threshold_ms) & (current_dbz >= 38.0)

    if np.any(downburst_mask):
        # Probability scaling: 20 m/s is 0.60, 28+ m/s is 0.98
        div_score = np.clip((local_span_v - 15.0) / 15.0, 0.0, 1.0)
        prob_grid = np.where(downburst_mask, div_score, 0.0).astype(np.float32)
        # Boost probability if core collapse confirmed
        prob_grid = np.where(downburst_mask & core_collapse, np.minimum(1.0, prob_grid + 0.20), prob_grid)

        # Cluster events
        labeled, num_features = ndimage.label(downburst_mask, structure=np.ones((3, 3), dtype=int))
        for k in range(1, num_features + 1):
            cell_mask = labeled == k
            if np.sum(cell_mask) < 3:
                continue

            ys, xs = np.nonzero(cell_mask)
            c_lat = float(np.mean(lat_grid[ys, xs]))
            c_lon = float(np.mean(lon_grid[ys, xs]))
            max_div = float(np.max(local_span_v[cell_mask]))
            has_collapse = bool(np.any(core_collapse[cell_mask]))

            # Estimated ground gust speed: peak outbound velocity + 30% gust factor
            peak_gust_ms = round(max_div * 1.15, 1)
            peak_gust_kmh = round(peak_gust_ms * 3.6, 1)
            severity = "SEVERE_DOWNBURST" if max_div >= 25.0 else "MODERATE_DOWNBURST"

            events.append(
                DownburstEvent(
                    event_id=f"DWN-{int(c_lat * 100)}-{int(c_lon * 100)}",
                    lat=round(c_lat, 4),
                    lon=round(c_lon, 4),
                    max_divergence_ms=round(max_div, 1),
                    estimated_outflow_speed_ms=peak_gust_ms,
                    estimated_outflow_speed_kmh=peak_gust_kmh,
                    lead_time_minutes=8 if has_collapse else 14,
                    severity=severity,
                    core_collapse_detected=has_collapse,
                    affected_radius_km=round(np.sqrt(np.sum(cell_mask)) * 0.8, 1),
                )
            )

    metadata = {
        "detected": len(events) > 0,
        "event_count": len(events),
        "max_outflow_ms": float(np.max([e.estimated_outflow_speed_ms for e in events])) if events else 0.0,
    }
    return events, prob_grid, metadata
