"""Lightning Hazard Diagnostic Engine.
Physically based on:
1. Recent stroke flash rate and lightning jumps (rapid acceleration in stroke frequency)
2. Radar reflectivity proxy aloft (mixed-phase charging zone: dBZ >= 40 above freezing level)
3. Satellite cloud-top cooling rate (updraft strength)
Outputs lightning probability (0.0 to 1.0) and expected flash density (strokes / km^2 / h).
"""

from typing import Tuple, Dict, Any, Optional
import numpy as np
from scipy import ndimage


def evaluate_lightning_hazard(
    current_density: np.ndarray,  # strokes / km^2 / 5-min
    previous_density: Optional[np.ndarray],  # strokes / km^2 / 5-min 10 min ago
    radar_dbz: np.ndarray,  # dBZ
    satellite_ir_k: np.ndarray,  # Kelvin
) -> Tuple[np.ndarray, np.ndarray, Dict[str, Any]]:
    """Evaluates lightning threat.
    Returns:
        prob_grid: 2D array of lightning occurrence probability [0.0, 1.0] for next 30-60 min
        expected_hourly_density: 2D array of estimated strokes / km^2 / hour
        metadata: summary statistics (total current strokes, max flash rate, lightning jump detected)
    """
    ny, nx = radar_dbz.shape
    
    # 1. Stroke rate jump detection
    flash_rate_change = np.zeros((ny, nx), dtype=np.float32)
    if previous_density is not None:
        flash_rate_change = current_density - previous_density

    # 2. Mixed-phase convective charging proxy from radar
    # In tropics/India, mixed-phase zone (-10C to -20C) is typically at 6-8 km AGL.
    # High composite dBZ (>= 40 dBZ) signifies strong updrafts and graupel-ice collisions.
    radar_charging_score = np.clip((radar_dbz - 35.0) / 20.0, 0.0, 1.0)

    # 3. Satellite cold-core / overshooting top proxy
    # Deep convection (Tb < 235 K) indicates cloud top reaching tropopause
    satellite_charging_score = np.clip((245.0 - satellite_ir_k) / 35.0, 0.0, 1.0)

    # 4. Existing flash activity indicator
    active_flash_score = np.clip(current_density / 2.0, 0.0, 1.0)

    # Combined lightning probability:
    # If active flashes already present -> probability is near 1.0
    # If developing storm with high dBZ + cold IR -> high probability of imminent stroke onset
    prob_grid = 0.40 * active_flash_score + 0.35 * radar_charging_score + 0.25 * satellite_charging_score
    prob_grid = np.clip(prob_grid, 0.0, 1.0).astype(np.float32)

    # Expected hourly flash density (strokes / km^2 / h)
    # Extrapolates current 5-min rate with trend adjustment
    trend_factor = np.clip(1.0 + flash_rate_change * 0.5, 0.4, 2.0)
    expected_hourly_density = (current_density * 12.0 * trend_factor).astype(np.float32)

    jump_detected = bool(np.max(flash_rate_change) > 3.0)  # sudden surge in stroke frequency
    metadata = {
        "max_prob": float(np.max(prob_grid)),
        "max_hourly_density": float(np.max(expected_hourly_density)),
        "lightning_jump_detected": jump_detected,
    }

    return prob_grid, expected_hourly_density, metadata
