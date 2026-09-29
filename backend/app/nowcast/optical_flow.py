"""Optical Flow and Semi-Lagrangian Extrapolation Engine (PySteps Baseline).
Implements Lucas-Kanade optical flow tracking and semi-Lagrangian advection for 0-120 minute nowcasting.
"""

from typing import Optional, Tuple, List
import numpy as np
from scipy import ndimage


def compute_optical_flow(
    frames: np.ndarray,  # shape: (n_frames, ny, nx), minimum 2 frames
    method: str = "lucaskanade",
) -> np.ndarray:
    """Computes advection velocity field (u, v) in pixels/timestep.
    Returns:
        velocity: array of shape (2, ny, nx) where velocity[0] is u (dx/dt) and velocity[1] is v (dy/dt).
    """
    if frames.ndim != 3 or frames.shape[0] < 2:
        raise ValueError("frames must be 3-D with at least 2 consecutive time frames")

    ny, nx = frames.shape[1], frames.shape[2]
    # Default slow drift if fields are completely flat/zero
    if np.max(frames) < 1.0:
        return np.zeros((2, ny, nx), dtype=np.float32)

    try:
        from pysteps.motion.lucaskanade import dense_lucaskanade
        # PySteps dense Lucas-Kanade
        clean_frames = np.nan_to_num(frames, nan=0.0)
        v = dense_lucaskanade(clean_frames, verbose=False)
        v = np.nan_to_num(v, nan=0.0)
        # Check if velocity field is non-trivial
        if np.max(np.abs(v)) > 0.05:
            return v.astype(np.float32)
    except Exception:
        pass

    # High-performance OpenCV / SciPy fallback
    try:
        import cv2
        f1 = np.clip(frames[-2], 0, 80).astype(np.float32)
        f2 = np.clip(frames[-1], 0, 80).astype(np.float32)
        # Normalize to 8-bit for Farneback
        norm1 = cv2.normalize(f1, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
        norm2 = cv2.normalize(f2, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
        flow = cv2.calcOpticalFlowFarneback(
            norm1, norm2, None, pyr_scale=0.5, levels=3, winsize=15,
            iterations=3, poly_n=5, poly_sigma=1.2, flags=0
        )
        # flow has shape (ny, nx, 2) where flow[..., 0] is u, flow[..., 1] is v
        u = flow[..., 0].astype(np.float32)
        v = flow[..., 1].astype(np.float32)
        return np.stack([u, v], axis=0)
    except Exception:
        pass

    # Simple centroid shift fallback
    c1 = ndimage.center_of_mass(frames[-2] > 20.0)
    c2 = ndimage.center_of_mass(frames[-1] > 20.0)
    if not np.isnan(c1[0]) and not np.isnan(c2[0]):
        dy = float(c2[0] - c1[0])
        dx = float(c2[1] - c1[1])
        u_grid = np.full((ny, nx), dx, dtype=np.float32)
        v_grid = np.full((ny, nx), dy, dtype=np.float32)
        return np.stack([u_grid, v_grid], axis=0)

    return np.zeros((2, ny, nx), dtype=np.float32)


def extrapolate_field(
    current_field: np.ndarray,  # 2D array (ny, nx)
    velocity: np.ndarray,  # 3D array (2, ny, nx)
    lead_steps: int = 24,  # e.g. 24 steps x 5 min = 120 min
    timestep_min: int = 5,
) -> np.ndarray:
    """Semi-Lagrangian advection of 2D field forward in time.
    Returns:
        extrapolated: array of shape (lead_steps, ny, nx)
    """
    if current_field.ndim != 2:
        raise ValueError("current_field must be 2-D (ny, nx)")
    if velocity.ndim != 3 or velocity.shape[0] != 2:
        raise ValueError("velocity must be 3-D with shape (2, ny, nx)")

    ny, nx = current_field.shape
    clean_field = np.nan_to_num(current_field, nan=0.0)

    try:
        from pysteps.extrapolation.semilagrangian import extrapolate
        res = extrapolate(clean_field, velocity, timesteps=lead_steps, outval=0.0)
        res = np.nan_to_num(res, nan=0.0)
        return res.astype(np.float32)
    except Exception:
        pass

    # Vectorized semi-Lagrangian backward trajectory advection fallback
    out = np.zeros((lead_steps, ny, nx), dtype=np.float32)
    y_coords, x_coords = np.meshgrid(np.arange(ny), np.arange(nx), indexing="ij")
    
    u = velocity[0]
    v = velocity[1]
    
    for t in range(1, lead_steps + 1):
        # Backward trajectory: position where parcel originated t steps ago
        src_y = np.clip(y_coords - t * v, 0, ny - 1)
        src_x = np.clip(x_coords - t * u, 0, nx - 1)
        coords = np.stack([src_y, src_x], axis=0)
        advected = ndimage.map_coordinates(clean_field, coords, order=1, mode="nearest")
        out[t - 1] = advected

    return out
