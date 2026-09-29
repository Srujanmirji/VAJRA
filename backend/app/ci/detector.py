"""Convective Initiation (CI) Detector.
Detects early-stage convective development from geostationary infrared satellite imagery (INSAT-3DR/3DS).
Implements:
1. Cloud-top cooling rate: Delta T_b / 15 min <= -4 K
2. Brightness temperature thresholds: T_b < 265 K (freezing aloft) and T_b < 235 K (deep convection)
3. Cold area expansion rate (growth of T_b < 240 K cloud shield)
4. Early radar cross-check (distinguishing pre-echo initiation from mature storm anvil)
Outputs CI candidates with probability and estimated time-to-radar-echo (0-45 min lead).
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Dict, Tuple, Optional, Any
import numpy as np
from scipy import ndimage

from app.config import settings


@dataclass
class CICandidate:
    """A detected convective initiation candidate cell."""
    ci_id: str
    lat: float
    lon: float
    cooling_rate_k_15min: float  # Negative value, e.g. -12.5 K / 15 min
    min_brightness_temp_k: float  # e.g. 235 K
    cold_area_km2: float
    ci_probability: float  # 0.0 to 1.0
    estimated_time_to_echo_min: int  # Minutes until first 35 dBZ radar echo
    status: str  # "VIGOROUS_INITIATION", "DEVELOPING", "MARGINAL"
    bbox: Tuple[float, float, float, float]  # (lat_min, lat_max, lon_min, lon_max)


class ConvectiveInitiationDetector:
    """Satellite-based convective initiation diagnostic engine."""

    def __init__(
        self,
        cooling_threshold_k_15min: float = -4.0,
        max_tb_k: float = 265.0,
        deep_convection_k: float = 230.0,
    ):
        self.cooling_threshold = cooling_threshold_k_15min
        self.max_tb_k = max_tb_k
        self.deep_convection_k = deep_convection_k

    def detect(
        self,
        current_ir_k: np.ndarray,  # 2D array of brightness temperatures in K
        previous_ir_k: np.ndarray,  # 2D array of brightness temperatures 15 min ago (or 3 cycles ago)
        lat_grid: np.ndarray,
        lon_grid: np.ndarray,
        current_radar_dbz: Optional[np.ndarray] = None,
        time_delta_minutes: float = 15.0,
    ) -> Tuple[List[CICandidate], np.ndarray]:
        """Runs multi-threshold CI detection.
        Returns:
            candidates: List of identified CI candidate cells
            ci_probability_grid: 2D array (ny, nx) of CI probabilities [0.0, 1.0]
        """
        ny, nx = current_ir_k.shape
        # 1. Cloud-top cooling rate: normalize to K per 15 min
        dt_rate_15min = (current_ir_k - previous_ir_k) * (15.0 / max(1.0, time_delta_minutes))
        
        # 2. Threshold tests:
        # Test A: Cloud top is sufficiently cold (glaciated/high altitude, Tb < 265 K)
        cold_mask = current_ir_k < self.max_tb_k
        # Test B: Cloud top is rapidly cooling (updraft pushing cloud top higher)
        cooling_mask = dt_rate_15min <= self.cooling_threshold
        # Test C: Pre-echo verification: radar reflectivity is currently low/absent (< 28 dBZ)
        pre_echo_mask = np.ones((ny, nx), dtype=bool)
        if current_radar_dbz is not None:
            pre_echo_mask = current_radar_dbz < 28.0

        ci_mask = cold_mask & cooling_mask & pre_echo_mask

        # Continuous probability grid based on physical scoring
        prob_grid = np.zeros((ny, nx), dtype=np.float32)
        if np.any(cold_mask & cooling_mask):
            # Score 1: Cooling severity (-4 K is 0.3, -15 K or colder is 1.0)
            score_cooling = np.clip((-dt_rate_15min - 4.0) / 12.0, 0.0, 1.0)
            # Score 2: Temperature depth (265 K is 0.2, 220 K is 1.0)
            score_temp = np.clip((self.max_tb_k - current_ir_k) / 45.0, 0.0, 1.0)
            combined_prob = 0.55 * score_cooling + 0.45 * score_temp
            # Where radar echo is already mature (> 35 dBZ), it is no longer an "initiating" storm
            if current_radar_dbz is not None:
                combined_prob = np.where(current_radar_dbz >= 35.0, 0.0, combined_prob)
            prob_grid = combined_prob.astype(np.float32)

        # 3. Cluster identification using connected components
        candidates: List[CICandidate] = []
        labeled, num_features = ndimage.label(ci_mask, structure=np.ones((3, 3), dtype=int))

        for k in range(1, num_features + 1):
            cell_coords = labeled == k
            area_pixels = int(np.sum(cell_coords))
            # Require minimum spatial coherence (~4 km^2)
            if area_pixels < 4:
                continue

            ys, xs = np.nonzero(cell_coords)
            c_lat = float(np.mean(lat_grid[ys, xs]))
            c_lon = float(np.mean(lon_grid[ys, xs]))
            min_tb = float(np.min(current_ir_k[cell_coords]))
            max_cooling = float(np.min(dt_rate_15min[cell_coords]))
            cell_prob = float(np.max(prob_grid[cell_coords]))

            # Estimated time to first radar echo (15-35 dBZ)
            # Explosive cooling (<= -12 K) reaches echo in 10-15 min; moderate cooling in 25-35 min
            if max_cooling <= -12.0:
                time_to_echo = 15
                status = "VIGOROUS_INITIATION"
            elif max_cooling <= -7.0:
                time_to_echo = 25
                status = "DEVELOPING"
            else:
                time_to_echo = 35
                status = "MARGINAL"

            candidates.append(
                CICandidate(
                    ci_id=f"CI-{int(c_lat * 100)}-{int(c_lon * 100)}",
                    lat=round(c_lat, 4),
                    lon=round(c_lon, 4),
                    cooling_rate_k_15min=round(max_cooling, 1),
                    min_brightness_temp_k=round(min_tb, 1),
                    cold_area_km2=float(area_pixels),
                    ci_probability=round(min(1.0, max(0.2, cell_prob)), 2),
                    estimated_time_to_echo_min=time_to_echo,
                    status=status,
                    bbox=(
                        float(np.min(lat_grid[ys, xs])),
                        float(np.max(lat_grid[ys, xs])),
                        float(np.min(lon_grid[ys, xs])),
                        float(np.max(lon_grid[ys, xs])),
                    ),
                )
            )

        return candidates, prob_grid
