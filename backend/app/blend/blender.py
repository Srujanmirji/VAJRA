"""Nowcast-NWP Blending Engine for 2-6 hour Convective Guidance.
Blends PySTEPS / ML nowcast ensemble with the latest available IMD-HRRR / NCUM-R output.
STRICT HONESTY RULES:
1. NWP is strictly READ, never run on demand.
2. Blend weights per lead time are non-negative and sum to 1.
3. Beyond 2 h (120 min), display transitions from deterministic cells to area probabilities.
"""

from typing import Dict, List, Tuple, Optional
import numpy as np

from app.blend.weights import skill_weights, blend
from app.config import settings


def get_blend_weights_for_lead(lead_minutes: int, floor: float = 0.05) -> Dict[str, float]:
    """Computes nowcast and NWP blending weights as a function of lead time.
    - 0 to 60 min: Nowcast dominant (optical flow / ML preserves fine convective details)
    - 60 to 120 min: Transition zone (nowcast skill decays, NWP starts contributing)
    - 120 to 240 min: NWP dominant (optical flow decorrelates, NWP convective parameterization takes over)
    - 240 to 360 min: NWP dominant (nowcast at floor weight)
    All weights are >= floor and strictly sum to 1.0.
    """
    if lead_minutes <= settings.nowcast_only_until_min:  # <= 60 min
        nowcast_skill = 0.95
        nwp_skill = 0.05
    elif lead_minutes >= settings.nwp_full_weight_from_min:  # >= 360 min
        nowcast_skill = 0.05
        nwp_skill = 0.95
    else:
        # Linear sigmoid decay between 60 and 360 min
        fraction = (lead_minutes - 60.0) / (360.0 - 60.0)
        # Cosine transition curve
        w_nwp = 0.05 + 0.90 * (0.5 * (1.0 - np.cos(np.pi * fraction)))
        nowcast_skill = 1.0 - w_nwp
        nwp_skill = w_nwp

    skills = {"nowcast": float(nowcast_skill), "nwp": float(nwp_skill)}
    return skill_weights(skills, floor=floor)


def blend_nowcast_with_nwp(
    nowcast_field: np.ndarray,  # 2D array of nowcast rain rate or probability
    nwp_field: np.ndarray,  # 2D array of NWP precipitation rate or probability
    lead_minutes: int,
) -> Tuple[np.ndarray, Dict[str, float]]:
    """Blends nowcast with NWP field for the specified lead time."""
    weights = get_blend_weights_for_lead(lead_minutes)
    fields = {"nowcast": nowcast_field, "nwp": nwp_field}
    blended = blend(fields, weights)
    return blended.astype(np.float32), weights
