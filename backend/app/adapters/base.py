"""Common interface for all data sources (radar, satellite, lightning, NWP)."""

from __future__ import annotations
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Literal, Protocol, List, Optional, Dict, Any
import numpy as np

Provenance = Literal["LIVE", "REPLAY", "SIMULATED"]


@dataclass
class Frame:
    """One time step of gridded data on the common 1 km grid."""
    time: datetime
    data: "object"          # numpy array (ny, nx)
    provenance: Provenance
    source_id: str


class Source(Protocol):
    source_id: str
    provenance: Provenance

    def latest(self) -> Frame | None:
        """Return the most recent frame, or None if unavailable."""
        ...


@dataclass
class RadarVolumeFrame:
    """Radar sweep or composite frame."""
    timestamp: datetime
    provenance: Provenance
    radar_id: str
    lat_grid: np.ndarray
    lon_grid: np.ndarray
    reflectivity: np.ndarray  # 2D array of dBZ
    radial_velocity: Optional[np.ndarray] = None  # 2D array of m/s
    spectrum_width: Optional[np.ndarray] = None
    azimuths_deg: Optional[np.ndarray] = None
    ranges_km: Optional[np.ndarray] = None
    elevation_deg: float = 0.5
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class SatelliteIRFrame:
    """Satellite Infrared brightness temperature frame."""
    timestamp: datetime
    provenance: Provenance
    satellite_id: str
    channel: str
    lat_grid: np.ndarray
    lon_grid: np.ndarray
    brightness_temp_k: np.ndarray  # 2D array in Kelvin
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class LightningStroke:
    """Individual lightning stroke."""
    timestamp: datetime
    lat: float
    lon: float
    peak_current_ka: float = 15.0
    stroke_type: str = "CG"  # CG or IC
    polarity: int = 1


@dataclass
class LightningStrokeList:
    """Collection of lightning strokes within an ingest window."""
    timestamp: datetime
    provenance: Provenance
    strokes: List[LightningStroke] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class NWPForecastField:
    """Pre-computed NWP forecast fields (IMD-HRRR / NCUM-R). Read-only."""
    model_name: str
    reference_run_time: datetime
    forecast_valid_time: datetime
    lead_minutes: int
    provenance: Provenance
    lat_grid: np.ndarray
    lon_grid: np.ndarray
    precip_rate_mmh: np.ndarray
    cape_jkg: Optional[np.ndarray] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


class BaseDataSource(ABC):
    """Common interface for all data sources."""

    def __init__(self, provenance: Provenance = "SIMULATED"):
        self.provenance = provenance

    @abstractmethod
    def fetch_latest(self, timestamp: Optional[datetime] = None) -> Any:
        pass

    @abstractmethod
    def get_source_name(self) -> str:
        pass

    def get_provenance(self) -> Provenance:
        return self.provenance
