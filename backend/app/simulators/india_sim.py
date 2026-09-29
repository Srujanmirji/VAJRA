"""INDIA-SIM Scenario Generator (B7).
Physically-plausible synthetic scenarios for:
1. Pre-monsoon Nor'wester (Kalbaishakhi) over the Kolkata region moving ESE:
   - Cell 1: Severe supercell with hail core (> 60 dBZ) and downburst outflow (> 24 m/s divergence).
   - Cell 2: Weakening multicell cluster.
   - Cell 3: Satellite-detected Convective Initiation (CI) cell (rapid IR cooling prior to radar echo).
2. Uttarakhand Himalayan Hills Cloudburst scenario:
   - High-intensity stationary convective cloud cluster producing >= 100 mm/h rain rate over > 20 km²
     in the Rudraprayag / Chamoli river valleys.
All outputs clearly tagged with ProvenanceType.SIMULATED ("SIMULATED").
"""

from datetime import datetime, timedelta, timezone
from typing import List, Tuple, Dict, Any, Optional
import numpy as np

from app.config import (
    ProvenanceType,
    REGIONS,
    RADAR_SITES,
    settings,
)
from app.adapters.base import (
    RadarVolumeFrame,
    SatelliteIRFrame,
    LightningStroke,
    LightningStrokeList,
    NWPForecastField,
)


class IndiaScenarioSimulator:
    """Generates time-stepped multi-sensor data for Kolkata and Uttarakhand scenarios."""

    def __init__(self, region_id: str = "kolkata", base_time: Optional[datetime] = None):
        self.region_id = region_id if region_id in REGIONS else "kolkata"
        self.region = REGIONS[self.region_id]
        self.radar_site = RADAR_SITES[self.region.radar_sites[0]]
        self.base_time = base_time or datetime(2026, 5, 15, 14, 0, 0, tzinfo=timezone.utc)
        self.grid_lat, self.grid_lon = self._create_grid()

    def _create_grid(self) -> Tuple[np.ndarray, np.ndarray]:
        d_lat = self.region.grid_res_km / 111.0
        d_lon = self.region.grid_res_km / 103.0
        lats = np.arange(self.region.lat_min, self.region.lat_max, d_lat)
        lons = np.arange(self.region.lon_min, self.region.lon_max, d_lon)
        lon_grid, lat_grid = np.meshgrid(lons, lats)
        return lat_grid, lon_grid

    def get_radar_frame(self, step_index: int = 0) -> RadarVolumeFrame:
        t = self.base_time + timedelta(seconds=step_index * settings.cycle_interval_seconds)
        ny, nx = self.grid_lat.shape

        dbz = np.full((ny, nx), -15.0, dtype=np.float32)
        vrad = np.zeros((ny, nx), dtype=np.float32)

        if self.region_id == "kolkata":
            dbz, vrad = self._simulate_kolkata_radar(step_index, dbz, vrad)
        else:
            dbz, vrad = self._simulate_uttarakhand_radar(step_index, dbz, vrad)

        # Apply radar coverage mask (250 km radius)
        d_lat_deg = (self.grid_lat - self.radar_site.lat) * 111.0
        d_lon_deg = (self.grid_lon - self.radar_site.lon) * 103.0
        dist_km = np.sqrt(d_lat_deg**2 + d_lon_deg**2)
        outside_radar = dist_km > self.radar_site.max_range_km
        dbz[outside_radar] = -32.0

        return RadarVolumeFrame(
            timestamp=t,
            provenance="SIMULATED",
            radar_id=self.radar_site.id,
            lat_grid=self.grid_lat,
            lon_grid=self.grid_lon,
            reflectivity=dbz,
            radial_velocity=vrad,
            metadata={
                "region": self.region_id,
                "step_index": step_index,
                "max_dbz": float(np.max(dbz)),
                "radar_site": self.radar_site.name,
                "scenario": f"{self.region_id}_convective_event",
            },
        )

    def _simulate_kolkata_radar(
        self, step: int, dbz: np.ndarray, vrad: np.ndarray
    ) -> Tuple[np.ndarray, np.ndarray]:
        c1_lat = 22.88 - step * 0.012
        c1_lon = 87.82 + step * 0.035
        dist_c1_deg = np.sqrt(((self.grid_lat - c1_lat) * 1.1)**2 + (self.grid_lon - c1_lon)**2)
        dist_c1_km = dist_c1_deg * 103.0
        c1_dbz = 63.5 * np.exp(-(dist_c1_km**2) / (2 * 12.0**2))
        dbz = np.maximum(dbz, c1_dbz)

        # Downburst outflow signature
        delta_x = (self.grid_lon - c1_lon) * 103.0
        delta_y = (self.grid_lat - c1_lat) * 111.0
        downburst_intensity = 1.0 if step >= 4 else (0.2 + 0.2 * step)
        outflow = 26.0 * downburst_intensity * (delta_x / 8.0) * np.exp(-(dist_c1_km**2) / (2 * 8.0**2))
        vrad += outflow.astype(np.float32)

        # Cell 2: Weakening multicell cluster
        c2_lat = 22.20 - step * 0.008
        c2_lon = 87.95 + step * 0.025
        dist_c2_km = np.sqrt(((self.grid_lat - c2_lat) * 111.0)**2 + ((self.grid_lon - c2_lon) * 103.0)**2)
        c2_peak = max(28.0, 52.0 - step * 2.5)
        c2_dbz = c2_peak * np.exp(-(dist_c2_km**2) / (2 * 15.0**2))
        dbz = np.maximum(dbz, c2_dbz)

        # Cell 3: Convective Initiation (CI) cell
        c3_lat = 23.35 - step * 0.010
        c3_lon = 88.55 + step * 0.020
        dist_c3_km = np.sqrt(((self.grid_lat - c3_lat) * 111.0)**2 + ((self.grid_lon - c3_lon) * 103.0)**2)
        if step < 3:
            c3_peak = 0.0
        elif step == 3:
            c3_peak = 24.0
        elif step == 4:
            c3_peak = 38.0
        else:
            c3_peak = min(56.0, 48.0 + (step - 5) * 2.0)
        c3_dbz = c3_peak * np.exp(-(dist_c3_km**2) / (2 * 9.0**2))
        dbz = np.maximum(dbz, c3_dbz)

        return dbz, vrad

    def _simulate_uttarakhand_radar(
        self, step: int, dbz: np.ndarray, vrad: np.ndarray
    ) -> Tuple[np.ndarray, np.ndarray]:
        c_lat = 30.30
        c_lon = 79.05
        dist_deg = np.sqrt(((self.grid_lat - c_lat) * 1.2)**2 + ((self.grid_lon - c_lon) * 0.9)**2)
        dist_km = dist_deg * 105.0

        pulse = 1.0 + 0.05 * np.sin(step * 0.5)
        cell_dbz = 61.0 * pulse * np.exp(-(dist_km**2) / (2 * 7.5**2))
        dbz = np.maximum(dbz, cell_dbz)

        c2_lat = 30.42
        c2_lon = 79.35
        dist2_km = np.sqrt(((self.grid_lat - c2_lat) * 111.0)**2 + ((self.grid_lon - c2_lon) * 103.0)**2)
        c2_dbz = 54.0 * np.exp(-(dist2_km**2) / (2 * 9.0**2))
        dbz = np.maximum(dbz, c2_dbz)

        conv = -10.0 * np.exp(-(dist_km**2) / (2 * 10.0**2))
        vrad += conv.astype(np.float32)

        return dbz, vrad

    def get_satellite_ir_frame(self, step_index: int = 0) -> SatelliteIRFrame:
        t = self.base_time + timedelta(seconds=step_index * settings.cycle_interval_seconds)
        ny, nx = self.grid_lat.shape
        ir_temp = np.full((ny, nx), 300.0, dtype=np.float32)

        if self.region_id == "kolkata":
            c1_lat = 22.88 - step_index * 0.012
            c1_lon = 87.82 + step_index * 0.035
            dist1_km = np.sqrt(((self.grid_lat - c1_lat) * 111.0)**2 + ((self.grid_lon - c1_lon) * 103.0)**2)
            c1_cold = 95.0 * np.exp(-(dist1_km**2) / (2 * 25.0**2))
            ir_temp -= c1_cold

            c2_lat = 22.20 - step_index * 0.008
            c2_lon = 87.95 + step_index * 0.025
            dist2_km = np.sqrt(((self.grid_lat - c2_lat) * 111.0)**2 + ((self.grid_lon - c2_lon) * 103.0)**2)
            c2_cold = max(35.0, 70.0 - step_index * 4.0) * np.exp(-(dist2_km**2) / (2 * 20.0**2))
            ir_temp -= c2_cold

            c3_lat = 23.35 - step_index * 0.010
            c3_lon = 88.55 + step_index * 0.020
            dist3_km = np.sqrt(((self.grid_lat - c3_lat) * 111.0)**2 + ((self.grid_lon - c3_lon) * 103.0)**2)
            cooling_delta = min(85.0, 30.0 + step_index * 10.0)
            c3_cold = cooling_delta * np.exp(-(dist3_km**2) / (2 * 14.0**2))
            ir_temp -= c3_cold
        else:
            c_lat = 30.30
            c_lon = 79.05
            dist_km = np.sqrt(((self.grid_lat - c_lat) * 111.0)**2 + ((self.grid_lon - c_lon) * 103.0)**2)
            c_cold = 92.0 * np.exp(-(dist_km**2) / (2 * 22.0**2))
            ir_temp -= c_cold

        return SatelliteIRFrame(
            timestamp=t,
            provenance="SIMULATED",
            satellite_id="INSAT-3DS",
            channel="TIR1_10.8um",
            lat_grid=self.grid_lat,
            lon_grid=self.grid_lon,
            brightness_temp_k=np.clip(ir_temp, 190.0, 315.0),
            metadata={
                "region": self.region_id,
                "step_index": step_index,
                "min_bt_k": float(np.min(ir_temp)),
                "channel": "TIR-1 (10.8 micron)",
            },
        )

    def get_lightning_strokes(self, step_index: int = 0) -> LightningStrokeList:
        t = self.base_time + timedelta(seconds=step_index * settings.cycle_interval_seconds)
        strokes: List[LightningStroke] = []
        rng = np.random.default_rng(seed=42 + step_index)

        if self.region_id == "kolkata":
            c1_lat = 22.88 - step_index * 0.012
            c1_lon = 87.82 + step_index * 0.035
            num_strokes_c1 = rng.integers(35, 60)
            for _ in range(num_strokes_c1):
                sec_offset = rng.uniform(0, 300)
                s_lat = c1_lat + rng.normal(0, 0.05)
                s_lon = c1_lon + rng.normal(0, 0.05)
                current = rng.uniform(15.0, 85.0) * (-1.0 if rng.random() > 0.1 else 1.0)
                strokes.append(
                    LightningStroke(
                        timestamp=t + timedelta(seconds=sec_offset),
                        lat=float(s_lat),
                        lon=float(s_lon),
                        peak_current_ka=float(current),
                        stroke_type="CG" if abs(current) > 20 else "IC",
                        polarity=1 if current > 0 else -1,
                    )
                )

            c2_lat = 22.20 - step_index * 0.008
            c2_lon = 87.95 + step_index * 0.025
            num_strokes_c2 = max(2, 18 - step_index * 3)
            for _ in range(num_strokes_c2):
                sec_offset = rng.uniform(0, 300)
                s_lat = c2_lat + rng.normal(0, 0.04)
                s_lon = c2_lon + rng.normal(0, 0.04)
                strokes.append(
                    LightningStroke(
                        timestamp=t + timedelta(seconds=sec_offset),
                        lat=float(s_lat),
                        lon=float(s_lon),
                        peak_current_ka=float(rng.uniform(-40, -10)),
                        stroke_type="CG",
                        polarity=-1,
                    )
                )

            if step_index >= 4:
                c3_lat = 23.35 - step_index * 0.010
                c3_lon = 88.55 + step_index * 0.020
                num_c3 = (step_index - 3) * 6
                for _ in range(num_c3):
                    sec_offset = rng.uniform(0, 300)
                    strokes.append(
                        LightningStroke(
                            timestamp=t + timedelta(seconds=sec_offset),
                            lat=float(c3_lat + rng.normal(0, 0.03)),
                            lon=float(c3_lon + rng.normal(0, 0.03)),
                            peak_current_ka=float(rng.uniform(-50, -15)),
                            stroke_type="CG",
                            polarity=-1,
                        )
                    )
        else:
            c_lat = 30.30
            c_lon = 79.05
            num_strokes = rng.integers(20, 45)
            for _ in range(num_strokes):
                sec_offset = rng.uniform(0, 300)
                strokes.append(
                    LightningStroke(
                        timestamp=t + timedelta(seconds=sec_offset),
                        lat=float(c_lat + rng.normal(0, 0.04)),
                        lon=float(c_lon + rng.normal(0, 0.04)),
                        peak_current_ka=float(rng.uniform(-70, 40)),
                        stroke_type="CG",
                        polarity=-1,
                    )
                )

        return LightningStrokeList(
            timestamp=t,
            provenance="SIMULATED",
            strokes=strokes,
            metadata={"count": len(strokes), "region": self.region_id},
        )

    def get_nwp_field(self, lead_minutes: int = 120) -> NWPForecastField:
        ref_time = self.base_time - timedelta(hours=3)
        valid_time = self.base_time + timedelta(minutes=lead_minutes)
        ny, nx = self.grid_lat.shape

        precip_rate = np.zeros((ny, nx), dtype=np.float32)
        cape = np.full((ny, nx), 1800.0, dtype=np.float32)

        if self.region_id == "kolkata":
            band_lat = 22.6
            band_lon = 88.2 + (lead_minutes / 60.0) * 0.4
            dist_deg = np.sqrt(((self.grid_lat - band_lat) * 1.5)**2 + ((self.grid_lon - band_lon) * 0.8)**2)
            precip_rate = 35.0 * np.exp(-(dist_deg**2) / (2 * 0.45**2))
            cape += 1200.0 * np.exp(-(((self.grid_lat - 22.5)**2 + (self.grid_lon - 88.5)**2)) / 1.0)
        else:
            precip_rate = 45.0 * np.exp(-(((self.grid_lat - 30.25)**2 + (self.grid_lon - 79.1)**2)) / (2 * 0.3**2))
            cape = np.full((ny, nx), 1200.0, dtype=np.float32)

        return NWPForecastField(
            model_name="IMD-HRRR / NCUM-R (Read-only)",
            reference_run_time=ref_time,
            forecast_valid_time=valid_time,
            lead_minutes=lead_minutes,
            provenance="SIMULATED",
            lat_grid=self.grid_lat,
            lon_grid=self.grid_lon,
            precip_rate_mmh=precip_rate,
            cape_jkg=cape,
            metadata={"resolution_km": 4.0, "status": "LATEST_AVAILABLE_RUN"},
        )
