"""Hail Hazard Diagnostic Engine.
Implements Probability of Hail (POH) and Maximum Expected Size of Hail (MESH) proxy
based on high reflectivity aloft, VIL density, and cold-cloud signatures.
"""

from typing import Tuple, Dict, Any, List, Optional
import numpy as np


def evaluate_hail_hazard(
    radar_dbz: np.ndarray,  # 2D composite reflectivity (dBZ)
    satellite_ir_k: np.ndarray,  # 2D brightness temp (K)
    vil_kg_m2: Optional[np.ndarray] = None,  # Vertically Integrated Liquid
) -> Tuple[np.ndarray, np.ndarray, Dict[str, Any]]:
    """Evaluates hail occurrence probability and estimated hail size.
    Returns:
        poh_grid: Probability of Hail [0.0, 1.0]
        mesh_mm_grid: Maximum Expected Size of Hail in millimeters (0 to 60+ mm)
        metadata: hail statistics (max MESH, severe hail clusters detected)
    """
    ny, nx = radar_dbz.shape
    poh_grid = np.zeros((ny, nx), dtype=np.float32)
    mesh_mm_grid = np.zeros((ny, nx), dtype=np.float32)

    # 1. Waldvogel / Witt physical hail criteria
    # Pre-monsoon sub-tropical Indian storms: 0C level ~4.5 km AGL, -20C level ~7.5 km AGL
    # Surface reflectivity thresholds:
    # < 45 dBZ: Liquid rain, negligible hail probability (< 5%)
    # 45 - 52 dBZ: Marginal small hail/graupel (20% - 50% POH, MESH 5-15 mm)
    # 52 - 58 dBZ: Probable hail (50% - 85% POH, MESH 15-28 mm)
    # >= 58 dBZ: Severe hail core (> 85% POH, MESH 30-55 mm)

    mask_marginal = (radar_dbz >= 45.0) & (radar_dbz < 52.0)
    mask_probable = (radar_dbz >= 52.0) & (radar_dbz < 58.0)
    mask_severe = radar_dbz >= 58.0

    poh_grid[mask_marginal] = 0.20 + 0.30 * ((radar_dbz[mask_marginal] - 45.0) / 7.0)
    poh_grid[mask_probable] = 0.50 + 0.35 * ((radar_dbz[mask_probable] - 52.0) / 6.0)
    poh_grid[mask_severe] = np.clip(0.85 + 0.14 * ((radar_dbz[mask_severe] - 58.0) / 7.0), 0.85, 0.99)

    # Estimate MESH (mm diameter)
    mesh_mm_grid[mask_marginal] = 5.0 + 10.0 * ((radar_dbz[mask_marginal] - 45.0) / 7.0)
    mesh_mm_grid[mask_probable] = 15.0 + 13.0 * ((radar_dbz[mask_probable] - 52.0) / 6.0)
    mesh_mm_grid[mask_severe] = 28.0 + 25.0 * ((radar_dbz[mask_severe] - 58.0) / 7.0)

    # 2. VIL Density enhancement if available
    # VIL density >= 3.5 g/m^3 is a classic indicator of severe hail
    if vil_kg_m2 is not None:
        # Assuming typical echo top 12 km
        vil_density_gm3 = vil_kg_m2 / 12.0
        high_vil = vil_density_gm3 >= 3.5
        poh_grid[high_vil] = np.maximum(poh_grid[high_vil], 0.80)
        mesh_mm_grid[high_vil] = np.maximum(mesh_mm_grid[high_vil], 25.0)

    # Cold cloud top boost (overshooting top supporting severe hail suspension)
    cold_overshoot = (satellite_ir_k < 215.0) & (radar_dbz >= 50.0)
    poh_grid[cold_overshoot] = np.minimum(1.0, poh_grid[cold_overshoot] + 0.10)

    severe_hail_detected = bool(np.any(mesh_mm_grid >= 25.0))  # >= 2.5 cm (1 inch) severe criteria
    metadata = {
        "max_poh": float(np.max(poh_grid)),
        "max_mesh_mm": float(np.max(mesh_mm_grid)),
        "severe_hail_detected": severe_hail_detected,
    }

    return poh_grid.astype(np.float32), mesh_mm_grid.astype(np.float32), metadata
