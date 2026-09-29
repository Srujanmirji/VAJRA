"""Arrival windows and live countdowns from ensemble arrival times."""
from __future__ import annotations
from dataclasses import dataclass
from datetime import datetime, timedelta
import numpy as np


@dataclass
class Countdown:
    window_min: tuple[float, float]
    p_arrival_60min: float
    countdown_seconds: int
    n_members: int


def arrival_countdown(arrival_minutes: list[float | None], now: datetime, issued: datetime,
                      percentiles: tuple[int, int] = (10, 90)) -> Countdown | None:
    """Build an arrival window from per-member arrival times (minutes after `issued`).

    Members where the storm never arrives are given as None. Returns None if no member arrives.
    The countdown runs to the START of the window, never to a single fake-precise time.
    """
    n = len(arrival_minutes)
    arrived = np.array([a for a in arrival_minutes if a is not None], dtype=float)
    if n == 0 or arrived.size == 0:
        return None
    lo, hi = np.percentile(arrived, percentiles)
    p60 = float(np.sum(arrived <= 60) / n)
    start = issued + timedelta(minutes=float(lo))
    remaining = max(0, int((start - now).total_seconds()))
    return Countdown((round(float(lo), 1), round(float(hi), 1)), round(p60, 3), remaining, n)
