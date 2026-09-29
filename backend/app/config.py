"""Configuration and Meteorological Domain Constants for VAJRA.
Supports loading from config/config.example.yaml or environment, with defaults
for India radar sites, domain bounds, monitored locations, and physical thresholds.
"""

from enum import Enum
from typing import Dict, List, Tuple, Optional, Literal, Any
import os
from pydantic import BaseModel, Field


class ProvenanceType(str, Enum):
    LIVE = "LIVE"
    REPLAY_REAL = "REPLAY"
    SIMULATED = "SIMULATED"


Provenance = Literal["LIVE", "REPLAY", "SIMULATED"]


class MonitoredPlace(BaseModel):
    name: str
    lat: float
    lon: float
    type: str = "city"  # airport, city, valley, infrastructure
    code: str = ""
    elevation_m: float = 10.0


class RadarSite(BaseModel):
    id: str
    name: str
    band: str = "S-band"
    lat: float
    lon: float
    altitude_m: float = 20.0
    max_range_km: float = 250.0
    azimuth_resolution_deg: float = 1.0
    gate_length_m: float = 250.0


class RegionConfig(BaseModel):
    id: str
    name: str
    state: str
    center_lat: float
    center_lon: float
    lat_min: float
    lat_max: float
    lon_min: float
    lon_max: float
    grid_res_km: float = 1.0
    radar_sites: List[str]
    monitored_places: List[MonitoredPlace]


class VajraSettings(BaseModel):
    project_name: str = "VAJRA (वज्र)"
    team_name: str = "CodeX_2026"
    problem_statement: str = "SIH 2026 PS 26084: Convective scale nowcasting (0-6h)"
    organization: str = "NCMRWF / Ministry of Earth Sciences"
    
    # Timing
    cycle_interval_seconds: int = 300  # 5 minutes
    max_latency_target_seconds: int = 300  # 5 minutes
    nowcast_lead_steps: int = 24  # 24 x 5 min = 120 min (0-2h)
    blending_lead_steps: int = 72  # 72 x 5 min = 360 min (0-6h)
    
    # Thresholds
    cloudburst_mm_per_h: float = 100.0  # IMD definition: >=100 mm in 1 h
    cloudburst_min_area_km2: float = 20.0
    storm_dbz: float = 40.0
    hail_dbz_threshold: float = 52.0
    hail_vil_density_threshold_gm3: float = 3.5
    downburst_divergence_threshold_ms: float = 20.0
    ci_cooling_rate_threshold_k_per_15min: float = -4.0
    ci_max_brightness_temp_k: float = 265.0
    
    # Z-R parameters
    zr_a: float = 300.0
    zr_b: float = 1.4

    # Blending
    nowcast_only_until_min: int = 60
    nwp_full_weight_from_min: int = 360


# Pre-configured IMD Radar Sites
RADAR_SITES: Dict[str, RadarSite] = {
    "VECC_KOLKATA": RadarSite(
        id="VECC_KOLKATA",
        name="Kolkata (New Town / VECC) DWR",
        band="S-band",
        lat=22.5726,
        lon=88.3639,
        altitude_m=12.0,
        max_range_km=250.0,
    ),
    "DEHRADUN_DWR": RadarSite(
        id="DEHRADUN_DWR",
        name="Dehradun (Surkanda Devi / Mukteshwar network) DWR",
        band="X-band",
        lat=30.3165,
        lon=78.0322,
        altitude_m=680.0,
        max_range_km=150.0,
    ),
    "DELHI_PALAM": RadarSite(
        id="DELHI_PALAM",
        name="Delhi (Palam / Mausam Bhavan) DWR",
        band="S-band",
        lat=28.5855,
        lon=77.2060,
        altitude_m=230.0,
        max_range_km=250.0,
    ),
    "MUMBAI_COLABA": RadarSite(
        id="MUMBAI_COLABA",
        name="Mumbai (Veravali / Colaba) DWR",
        band="S-band",
        lat=18.9067,
        lon=72.8147,
        altitude_m=35.0,
        max_range_km=250.0,
    ),
    "BENGALURU_GKVK": RadarSite(
        id="BENGALURU_GKVK",
        name="Bengaluru (GKVK Peenya) DWR",
        band="C-band",
        lat=13.0827,
        lon=77.5877,
        altitude_m=920.0,
        max_range_km=250.0,
    ),
}

# Domain Regions
REGIONS: Dict[str, RegionConfig] = {
    "kolkata": RegionConfig(
        id="kolkata",
        name="Kolkata & Gangetic West Bengal",
        state="West Bengal",
        center_lat=22.5726,
        center_lon=88.3639,
        lat_min=21.2,
        lat_max=24.0,
        lon_min=86.8,
        lon_max=89.8,
        grid_res_km=1.0,
        radar_sites=["VECC_KOLKATA"],
        monitored_places=[
            MonitoredPlace(name="NSCBI Airport (VECC)", code="CCU", lat=22.6547, lon=88.4467, type="airport"),
            MonitoredPlace(name="Kolkata Central", code="KOL", lat=22.5726, lon=88.3639, type="city"),
            MonitoredPlace(name="Howrah Junction", code="HWH", lat=22.5830, lon=88.3426, type="infrastructure"),
            MonitoredPlace(name="Bardhaman", code="BWN", lat=23.2400, lon=87.8600, type="city"),
            MonitoredPlace(name="Haldia Port", code="HLD", lat=22.0628, lon=88.0827, type="infrastructure"),
            MonitoredPlace(name="Salt Lake Sector V", code="SLK", lat=22.5797, lon=88.4312, type="city"),
            MonitoredPlace(name="Barrackpore", code="BRK", lat=22.7667, lon=88.3667, type="city"),
            MonitoredPlace(name="Kharagpur", code="KGP", lat=22.3382, lon=87.3235, type="city"),
        ],
    ),
    "uttarakhand": RegionConfig(
        id="uttarakhand",
        name="Uttarakhand Himalayan River Valleys",
        state="Uttarakhand",
        center_lat=30.3165,
        center_lon=78.0322,
        lat_min=29.4,
        lat_max=31.2,
        lon_min=77.2,
        lon_max=79.8,
        grid_res_km=1.0,
        radar_sites=["DEHRADUN_DWR"],
        monitored_places=[
            MonitoredPlace(name="Dehradun City", code="DDN", lat=30.3165, lon=78.0322, type="city", elevation_m=640),
            MonitoredPlace(name="Jolly Grant Airport", code="DED", lat=30.1897, lon=78.1803, type="airport", elevation_m=558),
            MonitoredPlace(name="Rishikesh", code="RSK", lat=30.0869, lon=78.2676, type="city", elevation_m=372),
            MonitoredPlace(name="Haridwar", code="HDW", lat=29.9457, lon=78.1642, type="city", elevation_m=314),
            MonitoredPlace(name="Rudraprayag Valley", code="RUD", lat=30.2858, lon=78.9813, type="valley", elevation_m=895),
            MonitoredPlace(name="Srinagar Garhwal", code="SRN", lat=30.2227, lon=78.7844, type="city", elevation_m=560),
            MonitoredPlace(name="Chamoli Gopeshwar", code="CHM", lat=30.4124, lon=79.3314, type="valley", elevation_m=1300),
            MonitoredPlace(name="Joshimath", code="JSH", lat=30.5564, lon=79.5667, type="valley", elevation_m=1890),
        ],
    ),
    "delhi": RegionConfig(
        id="delhi",
        name="Delhi NCR Region",
        state="Delhi / NCR",
        center_lat=28.5855,
        center_lon=77.2060,
        lat_min=27.9,
        lat_max=29.3,
        lon_min=76.4,
        lon_max=78.0,
        grid_res_km=1.0,
        radar_sites=["DELHI_PALAM"],
        monitored_places=[
            MonitoredPlace(name="IGI Airport T3", code="DEL", lat=28.5562, lon=77.1000, type="airport"),
            MonitoredPlace(name="Connaught Place", code="CP", lat=28.6315, lon=77.2167, type="city"),
            MonitoredPlace(name="Noida Sector 62", code="NOI", lat=28.6271, lon=77.3734, type="city"),
            MonitoredPlace(name="Cyber City Gurugram", code="GGN", lat=28.4950, lon=77.0895, type="city"),
        ],
    ),
    "mumbai": RegionConfig(
        id="mumbai",
        name="Mumbai Metropolitan Region",
        state="Maharashtra",
        center_lat=18.9067,
        center_lon=72.8147,
        lat_min=18.3,
        lat_max=19.7,
        lon_min=72.3,
        lon_max=73.5,
        grid_res_km=1.0,
        radar_sites=["MUMBAI_COLABA"],
        monitored_places=[
            MonitoredPlace(name="CSMIA Airport", code="BOM", lat=19.0896, lon=72.8656, type="airport"),
            MonitoredPlace(name="Colaba", code="CLB", lat=18.9067, lon=72.8147, type="city"),
            MonitoredPlace(name="Navi Mumbai", code="NVM", lat=19.0330, lon=73.0297, type="city"),
            MonitoredPlace(name="Thane", code="THN", lat=19.2183, lon=72.9781, type="city"),
        ],
    ),
    "bengaluru": RegionConfig(
        id="bengaluru",
        name="Bengaluru Urban & Rural",
        state="Karnataka",
        center_lat=13.0827,
        center_lon=77.5877,
        lat_min=12.4,
        lat_max=13.7,
        lon_min=76.9,
        lon_max=78.2,
        grid_res_km=1.0,
        radar_sites=["BENGALURU_GKVK"],
        monitored_places=[
            MonitoredPlace(name="Kempegowda Int Airport", code="BLR", lat=13.1986, lon=77.7066, type="airport"),
            MonitoredPlace(name="Majestic City Center", code="SBC", lat=12.9772, lon=77.5714, type="city"),
            MonitoredPlace(name="Whitefield IT Corridor", code="WTF", lat=12.9698, lon=77.7500, type="city"),
        ],
    ),
}

settings = VajraSettings()
