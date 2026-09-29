"""Arrival windows and live countdowns from ensemble arrival times.
Every countdown displays an honest window and probability:
e.g. "Kolkata · starts in 34:12 · window 35–55 min · 70%".
"""

from __future__ import annotations
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple, Dict, Any
import numpy as np

from app.config import MonitoredPlace, settings


@dataclass
class Countdown:
    window_min: tuple[float, float]
    p_arrival_60min: float
    countdown_seconds: int
    n_members: int


@dataclass
class PlaceThreatCountdown:
    """Formatted countdown result for a specific monitored place."""
    place_name: str
    place_code: str
    place_type: str
    lat: float
    lon: float
    approaching: bool
    countdown_seconds: Optional[int]
    countdown_display: str
    window_min: Optional[Tuple[float, float]]
    window_display: str
    probability_pct: int
    threat_severity: str
    primary_hazard: str


def arrival_countdown(
    arrival_minutes: list[float | None],
    now: datetime,
    issued: datetime,
    percentiles: tuple[int, int] = (10, 90),
) -> Countdown | None:
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


def evaluate_places_countdowns(
    places: List[MonitoredPlace],
    ensemble_rain_rate: np.ndarray,  # shape: (n_members, n_lead_steps, ny, nx)
    lat_grid: np.ndarray,
    lon_grid: np.ndarray,
    issued_time: datetime,
    now_time: Optional[datetime] = None,
    threshold_mmh: float = 20.0,
    impact_radius_km: float = 12.0,
    timestep_minutes: int = 5,
) -> List[PlaceThreatCountdown]:
    """Computes arrival distributions and live ticking countdowns for all configured places."""
    if now_time is None:
        now_time = issued_time

    n_members, n_leads, ny, nx = ensemble_rain_rate.shape
    results: List[PlaceThreatCountdown] = []

    for place in places:
        # Distance to place (km)
        d_lat = (lat_grid - place.lat) * 111.0
        d_lon = (lon_grid - place.lon) * 103.0
        dist_km = np.sqrt(d_lat**2 + d_lon**2)
        place_mask = dist_km <= impact_radius_km

        # Find arrival time (first lead time where rain_rate >= threshold within place mask)
        arrival_minutes: List[Optional[float]] = []

        for m in range(n_members):
            member_arrival = None
            for t in range(n_leads):
                if np.any(ensemble_rain_rate[m, t][place_mask] >= threshold_mmh):
                    member_arrival = (t + 1) * timestep_minutes
                    break
            arrival_minutes.append(member_arrival)

        c = arrival_countdown(arrival_minutes, now=now_time, issued=issued_time)

        if c is not None and c.p_arrival_60min > 0.05:
            mm = c.countdown_seconds // 60
            ss = c.countdown_seconds % 60
            count_str = f"{mm:02d}:{ss:02d}"
            win_str = f"{int(c.window_min[0])}–{int(c.window_min[1])} min"
            prob_pct = int(round(c.p_arrival_60min * 100))

            severity = "SEVERE" if prob_pct >= 60 else "MODERATE"
            primary_hazard = "hail" if prob_pct >= 70 else "thunderstorm"

            results.append(
                PlaceThreatCountdown(
                    place_name=place.name,
                    place_code=place.code or place.name[:3].upper(),
                    place_type=place.type,
                    lat=place.lat,
                    lon=place.lon,
                    approaching=True,
                    countdown_seconds=c.countdown_seconds,
                    countdown_display=count_str,
                    window_min=c.window_min,
                    window_display=win_str,
                    probability_pct=prob_pct,
                    threat_severity=severity,
                    primary_hazard=primary_hazard,
                )
            )
        else:
            results.append(
                PlaceThreatCountdown(
                    place_name=place.name,
                    place_code=place.code or place.name[:3].upper(),
                    place_type=place.type,
                    lat=place.lat,
                    lon=place.lon,
                    approaching=False,
                    countdown_seconds=None,
                    countdown_display="--:--",
                    window_min=None,
                    window_display="No threat within 60 min",
                    probability_pct=0,
                    threat_severity="NONE",
                    primary_hazard="none",
                )
            )

    return results
