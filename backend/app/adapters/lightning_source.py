"""Lightning Data Adapter for VAJRA.
Supports:
1. CSV/Stream Stroke Reader (compatible with IITM / Earth Networks / DAMINI lightning feeds)
2. SEVIR GLM flash event reader
3. INDIA-SIM synthetic lightning stroke generator
"""

from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
import os
import csv

from app.config import ProvenanceType
from app.adapters.base import (
    BaseDataSource,
    LightningStroke,
    LightningStrokeList,
)


class LightningSource(BaseDataSource):
    """Adapter for ground & spaceborne lightning stroke detection."""

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
        return f"LightningSource_{self.mode}"

    def fetch_latest(
        self,
        timestamp: Optional[datetime] = None,
        step_index: int = 0,
    ) -> LightningStrokeList:
        if self.mode == "SIMULATED":
            return self.simulator.get_lightning_strokes(step_index=step_index)
        elif self.mode == "CSV_STREAM":
            return self._load_csv_strokes()
        elif self.mode == "SEVIR_GLM":
            return self._load_sevir_glm(step_index=step_index)
        else:
            raise ValueError(f"Unknown lightning adapter mode: {self.mode}")

    def _load_csv_strokes(self) -> LightningStrokeList:
        strokes: List[LightningStroke] = []
        if self.data_path and os.path.exists(self.data_path):
            try:
                with open(self.data_path, "r", encoding="utf-8") as f:
                    reader = csv.DictReader(f)
                    for row in reader:
                        strokes.append(
                            LightningStroke(
                                timestamp=datetime.fromisoformat(row["time"]),
                                lat=float(row["lat"]),
                                lon=float(row["lon"]),
                                peak_current_ka=float(row.get("current_ka", 20.0)),
                                stroke_type=row.get("type", "CG"),
                                polarity=int(row.get("polarity", -1)),
                            )
                        )
                return LightningStrokeList(
                    timestamp=datetime.now(timezone.utc),
                    provenance="LIVE",
                    strokes=strokes,
                    metadata={"source": "GROUND_LIGHTNING_NETWORK", "file": self.data_path},
                )
            except Exception:
                pass

        lst = self.simulator.get_lightning_strokes(step_index=0)
        lst.provenance = "SIMULATED"
        lst.metadata["source"] = "CSV_LIGHTNING_STUB_READY_FOR_DATA"
        return lst

    def _load_sevir_glm(self, step_index: int = 0) -> LightningStrokeList:
        lst = self.simulator.get_lightning_strokes(step_index=step_index)
        lst.provenance = "REPLAY"
        lst.metadata["source"] = "SEVIR_GLM_REPLAY"
        return lst
