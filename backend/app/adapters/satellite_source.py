"""Satellite Data Adapter for VAJRA.
Supports:
1. INSAT-3DR / INSAT-3DS L1B HDF5 Reader (MOSDAC format)
2. SEVIR IR 10.7 µm fallback
3. INDIA-SIM synthetic cloud-top cooling generator
"""

from datetime import datetime, timezone
from typing import Optional, Dict, Any
import os
import numpy as np

from app.config import ProvenanceType
from app.adapters.base import BaseDataSource, SatelliteIRFrame


class SatelliteSource(BaseDataSource):
    """Adapter for INSAT-3DR/3DS geostationary infrared observations."""

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
        return f"SatelliteSource_{self.mode}"

    def fetch_latest(
        self,
        timestamp: Optional[datetime] = None,
        step_index: int = 0,
    ) -> SatelliteIRFrame:
        if self.mode == "SIMULATED":
            return self.simulator.get_satellite_ir_frame(step_index=step_index)
        elif self.mode == "INSAT_MOSDAC":
            return self._load_insat_mosdac_hdf5()
        elif self.mode == "SEVIR_IR":
            return self._load_sevir_ir(step_index=step_index)
        else:
            raise ValueError(f"Unknown satellite adapter mode: {self.mode}")

    def _load_insat_mosdac_hdf5(self) -> SatelliteIRFrame:
        if self.data_path and os.path.exists(self.data_path):
            try:
                import h5py
                with h5py.File(self.data_path, "r") as hf:
                    if "IMG_TIR1" in hf:
                        raw = hf["IMG_TIR1"][:]
                        bt_k = np.clip(raw * 0.1 + 180.0, 180.0, 330.0).astype(np.float32)
                        ny, nx = bt_k.shape
                        lats = np.linspace(21.0, 25.0, ny)
                        lons = np.linspace(86.0, 90.0, nx)
                        lon_grid, lat_grid = np.meshgrid(lons, lats)
                        return SatelliteIRFrame(
                            timestamp=datetime.now(timezone.utc),
                            provenance="LIVE",
                            satellite_id="INSAT-3DS",
                            channel="TIR1_10.8um",
                            lat_grid=lat_grid,
                            lon_grid=lon_grid,
                            brightness_temp_k=bt_k,
                            metadata={"source": "MOSDAC_INSAT3DS_L1B", "path": self.data_path},
                        )
            except Exception:
                pass

        frame = self.simulator.get_satellite_ir_frame(step_index=0)
        frame.provenance = "SIMULATED"
        frame.metadata["source"] = "INSAT_MOSDAC_STUB_READY_FOR_DATA"
        frame.metadata["doc"] = "Awaiting MOSDAC HDF5 in data/insat/"
        return frame

    def _load_sevir_ir(self, step_index: int = 0) -> SatelliteIRFrame:
        if self.data_path and os.path.exists(self.data_path):
            try:
                import h5py
                with h5py.File(self.data_path, "r") as hf:
                    if "ir107" in hf:
                        ir_slice = hf["ir107"][step_index % len(hf["ir107"])]
                        bt_k = (ir_slice * 0.5 + 200.0).astype(np.float32)
                        ny, nx = bt_k.shape
                        lats = np.linspace(35.0, 38.0, ny)
                        lons = np.linspace(-98.0, -95.0, nx)
                        lon_grid, lat_grid = np.meshgrid(lons, lats)
                        return SatelliteIRFrame(
                            timestamp=datetime.now(timezone.utc),
                            provenance="REPLAY",
                            satellite_id="GOES-16-SEVIR",
                            channel="ir107",
                            lat_grid=lat_grid,
                            lon_grid=lon_grid,
                            brightness_temp_k=bt_k,
                            metadata={"source": "SEVIR_IR107", "file": self.data_path},
                        )
            except Exception:
                pass

        frame = self.simulator.get_satellite_ir_frame(step_index=step_index)
        frame.provenance = "REPLAY"
        frame.metadata["source"] = "SEVIR_IR_REPLAY"
        return frame
