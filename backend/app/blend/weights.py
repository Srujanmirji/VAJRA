"""Skill-based blending weights between nowcast and NWP."""
from __future__ import annotations
import numpy as np


def skill_weights(skills: dict[str, float], floor: float = 0.0) -> dict[str, float]:
    """Convert non-negative skill scores into weights that are >= floor and sum to 1."""
    if not skills:
        raise ValueError("no sources")
    n = len(skills)
    if floor * n > 1:
        raise ValueError("floor too large for number of sources")
    s = np.clip(np.array(list(skills.values()), dtype=float), 0, None)
    base = s / s.sum() if s.sum() > 0 else np.full(n, 1 / n)
    # Reserve `floor` for every source, share the rest by skill: stays >= floor and sums to 1.
    w = floor + (1 - n * floor) * base
    return dict(zip(skills.keys(), (float(x) for x in w)))


def blend(fields: dict[str, np.ndarray], weights: dict[str, float]) -> np.ndarray:
    """Weighted sum of fields with matching shapes."""
    return sum(weights[k] * fields[k] for k in fields)
