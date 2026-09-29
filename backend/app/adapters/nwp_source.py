"""NWP Data Adapter for VAJRA.
Reads latest available NWP model precipitation and CAPE forecast fields (IMD-HRRR / NCUM-R).
STRICT HONESTY RULE: NWP is strictly READ, never run on demand.
"""

from datetime import datetime, timezone
from typing import Optional, Dict, Any
import os
import numpy as np

from app.config import ProvenanceType
from app.adapters.base import BaseDataSource, NWPForecastField


class NWPSource(BaseDataSource):
    """Adapter for operational numerical weather prediction model fields."""

    def __init__(
        self,
        mode: str = "SIMULATED",
        region_id: str = "kolkata",
        data_path: Optional[str] = None,
    ):
        provenance = "SIMULATED" if mode == "SIMULATED" else "REPLAY"
        super().__init__(provenance=provenance)
        self.mode = mode
        self.region_id = region_id
        self.data_path = data_path
        from app.simulators.india_sim import IndiaScenarioSimulator
        self.simulator = IndiaScenarioSimulator(region_id=region_id)

    def get_source_name(self) -> str:
        return f"NWPSource_{self.mode}"

    def fetch_latest(
        self,
        timestamp: Optional[datetime] = None,
        lead_minutes: int = 120,
    ) -> NWPForecastField:
        if self.mode == "SIMULATED":
            return self.simulator.get_nwp_field(lead_minutes=lead_minutes)
        elif self.mode == "NETCDF_READ":
            return self._load_netcdf_nwp(lead_minutes=lead_minutes)
        else:
            raise ValueError(f"Unknown NWP adapter mode: {self.mode}")

    def _load_netcdf_nwp(self, lead_minutes: int = 120) -> NWPForecastField:
        if self.data_path and os.path.exists(self.data_path):
            try:
                import xarray as xr
                ds = xr.open_dataset(self.data_path)
                for var in ["prate", "tp", "precipitation", "precip_rate"]:
                    if var in ds:
                        precip_data = ds[var].values[0].astype(np.float32)
                        lats = ds["latitude"].values if "latitude" in ds else ds["lat"].values
                        lons = ds["longitude"].values if "longitude" in ds else ds["lon"].values
                        lon_grid, lat_grid = np.meshgrid(lons, lats)
                        return NWPForecastField(
                            model_name="IMD-HRRR / NCUM-R Operational (Read-only)",
                            reference_run_time=datetime.now(timezone.utc),
                            forecast_valid_time=datetime.now(timezone.utc),
                            lead_minutes=lead_minutes,
                            provenance="LIVE",
                            lat_grid=lat_grid,
                            lon_grid=lon_grid,
                            precip_rate_mmh=precip_data,
                            metadata={"source": "NCMRWF_NETCDF", "path": self.data_path},
                        )
            except Exception:
                pass

        field = self.simulator.get_nwp_field(lead_minutes=lead_minutes)
        field.provenance = "SIMULATED"
        field.metadata["source"] = "NWP_NETCDF_STUB_READY_FOR_DATA"
        return field
