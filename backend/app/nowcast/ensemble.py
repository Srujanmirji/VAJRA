"""STEPS Stochastic Ensemble Nowcast Engine.
Generates an ensemble of perturbed nowcast members (e.g. 12-20 members) capturing
advection velocity uncertainty and stochastic scale-dependent convective evolution.
"""

from typing import List, Tuple, Optional
import numpy as np
from scipy import ndimage

from app.nowcast.optical_flow import extrapolate_field


class STEPSNowcastEnsemble:
    """Generates perturbed ensemble members for probabilistic convective nowcasting (0-120 min)."""

    def __init__(
        self,
        n_members: int = 16,
        vel_perturb_std: float = 0.8,  # pixels/step perturbation
        seed: int = 42,
    ):
        self.n_members = n_members
        self.vel_perturb_std = vel_perturb_std
        self.seed = seed

    def generate_ensemble(
        self,
        current_field: np.ndarray,  # 2D array (ny, nx)
        velocity: np.ndarray,  # 3D array (2, ny, nx)
        lead_steps: int = 24,  # 24 steps x 5 min = 120 min
    ) -> np.ndarray:
        """Generates ensemble forecasts.
        Returns:
            ensemble_forecasts: array of shape (n_members, lead_steps, ny, nx)
        """
        ny, nx = current_field.shape
        members = np.zeros((self.n_members, lead_steps, ny, nx), dtype=np.float32)
        rng = np.random.default_rng(self.seed)

        # Member 0 is the unperturbed deterministic baseline
        members[0] = extrapolate_field(current_field, velocity, lead_steps=lead_steps)

        # Generate perturbed members
        for m in range(1, self.n_members):
            # 1. Spatially correlated velocity perturbation
            raw_noise_u = rng.normal(0, self.vel_perturb_std, size=(ny, nx))
            raw_noise_v = rng.normal(0, self.vel_perturb_std, size=(ny, nx))
            smooth_du = ndimage.gaussian_filter(raw_noise_u, sigma=15.0) * 3.0
            smooth_dv = ndimage.gaussian_filter(raw_noise_v, sigma=15.0) * 3.0
            perturbed_vel = np.copy(velocity)
            perturbed_vel[0] += smooth_du.astype(np.float32)
            perturbed_vel[1] += smooth_dv.astype(np.float32)

            # Extrapolate with perturbed motion
            advected = extrapolate_field(current_field, perturbed_vel, lead_steps=lead_steps)

            # 2. Stochastic cascade perturbation (growth/decay of convective cells)
            # Perturbation amplitude increases with lead time (loss of predictability)
            for t in range(lead_steps):
                time_factor = (t + 1) / lead_steps
                noise = rng.normal(0, 0.15 * time_factor, size=(ny, nx))
                smooth_noise = ndimage.gaussian_filter(noise, sigma=6.0) * 2.0
                intensity_scale = np.clip(1.0 + smooth_noise, 0.6, 1.4)
                members[m, t] = np.clip(advected[t] * intensity_scale, 0.0, None)

        return members

    @staticmethod
    def compute_ensemble_mean(forecasts: np.ndarray) -> np.ndarray:
        """Computes mean across ensemble members. Shape: (lead_steps, ny, nx)."""
        return np.mean(forecasts, axis=0)

    @staticmethod
    def compute_exceedance_probability(
        forecasts: np.ndarray, threshold: float
    ) -> np.ndarray:
        """Computes probability (0.0 to 1.0) of exceeding threshold. Shape: (lead_steps, ny, nx)."""
        exceeds = (forecasts >= threshold).astype(np.float32)
        return np.mean(exceeds, axis=0)
