"""Quality Control (QC) algorithms for Radar Data.
Implements:
1. Speckle removal (isolated non-meteorological pixel blips)
2. Ground clutter & anomalous propagation (AP) filtering (texture filter & Doppler near-zero check)
3. Path-integrated attenuation correction hook (Hitschfeld-Bordan formulation)
4. Marshall-Palmer Z-R rain rate calculation with rain-gauge bias correction hook
"""

from typing import Optional, Tuple
import numpy as np
from scipy import ndimage


def remove_speckle(dbz: np.ndarray, min_cluster_pixels: int = 3, threshold_dbz: float = 10.0) -> np.ndarray:
    """Removes isolated speckles (< min_cluster_pixels connected components) in reflectivity."""
    out = np.copy(dbz)
    mask = out >= threshold_dbz
    labeled, num_features = ndimage.label(mask, structure=np.ones((3, 3), dtype=int))
    
    if num_features > 0:
        sizes = ndimage.sum(mask, labeled, range(1, num_features + 1))
        # Find features smaller than min_cluster_pixels
        small_features = np.where(sizes < min_cluster_pixels)[0] + 1
        remove_mask = np.isin(labeled, small_features)
        out[remove_mask] = -15.0
    return out


def filter_ground_clutter(
    dbz: np.ndarray,
    vrad: Optional[np.ndarray] = None,
    texture_threshold: float = 14.0,
    min_dbz: float = 20.0,
) -> Tuple[np.ndarray, np.ndarray]:
    """Filters ground clutter and anomalous propagation using spatial texture and Doppler velocity.
    
    Returns:
        (filtered_dbz, clutter_mask)
    """
    out_dbz = np.copy(dbz)
    valid = out_dbz > -10.0
    
    # Compute local spatial standard deviation (texture)
    mean = ndimage.uniform_filter(np.where(valid, out_dbz, 0.0), size=3)
    sq_mean = ndimage.uniform_filter(np.where(valid, out_dbz**2, 0.0), size=3)
    texture = np.sqrt(np.maximum(0.0, sq_mean - mean**2))
    
    # Ground clutter typically exhibits abnormally high spatial texture (rough speckle edges)
    # and near-zero radial velocity with high reflectivity
    clutter_mask = (texture > texture_threshold) & (out_dbz >= min_dbz)
    
    if vrad is not None:
        near_zero_vrad = np.abs(vrad) < 0.8  # m/s
        clutter_mask = clutter_mask | (near_zero_vrad & (out_dbz > 45.0) & (texture > 8.0))
        
    out_dbz[clutter_mask] = -15.0
    return out_dbz, clutter_mask


def attenuation_correction_hook(
    dbz: np.ndarray,
    dr_km: float = 1.0,
    alpha: float = 1.6e-4,
    beta: float = 0.72,
    max_correction_db: float = 8.0,
) -> np.ndarray:
    """Hitschfeld-Bordan path-integrated attenuation correction hook for C/X band radars.
    Specific attenuation: k = alpha * Z^beta (dB/km)
    Integrated 2-way attenuation: A(r) = 2 * sum(k * dr)
    """
    out_dbz = np.copy(dbz)
    z_linear = 10.0 ** (np.maximum(out_dbz, 0.0) / 10.0)
    
    # Estimate specific attenuation along range gates (applied row-wise or radially)
    k_specific = alpha * (z_linear**beta)
    cum_attenuation = 2.0 * np.cumsum(k_specific, axis=-1) * dr_km
    cum_attenuation = np.clip(cum_attenuation, 0.0, max_correction_db)
    
    # Apply attenuation correction where reflectivity is significant
    corrected_dbz = out_dbz + cum_attenuation
    return np.where(out_dbz > 10.0, corrected_dbz, out_dbz)


def zr_reflectivity_to_rain_rate(
    dbz: np.ndarray,
    a: float = 300.0,
    b: float = 1.4,
    min_dbz: float = 10.0,
    gauge_bias_factor: float = 1.0,
) -> np.ndarray:
    """Converts reflectivity (dBZ) to rain rate (mm/h) via Marshall-Palmer convective relation:
    Z = a * R^b  =>  R = (10^(dBZ/10) / a)^(1/b) * gauge_bias_factor
    """
    valid_mask = (dbz >= min_dbz) & ~np.isnan(dbz)
    rain_rate = np.zeros_like(dbz, dtype=np.float32)
    
    z_linear = 10.0 ** (dbz[valid_mask] / 10.0)
    r_unbiased = (z_linear / a) ** (1.0 / b)
    
    rain_rate[valid_mask] = (r_unbiased * gauge_bias_factor).astype(np.float32)
    return rain_rate
