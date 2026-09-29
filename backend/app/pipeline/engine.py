"""VAJRA Pipeline Engine.
Orchestrates the 5-minute real-time nowcast cycle:
1. Ingest multi-source frames (Radar, INSAT-3DS, Lightning, NWP)
2. Quality Control & 1 km Fusion Grid alignment
3. Convective Initiation (CI) detection
4. PySteps optical flow & ML nowcast (0-120 min)
5. NWP blending (2-6 h)
6. Multi-hazard diagnostics (Hail, Lightning, Downburst, Cloudburst, CI)
7. Storm cell tracking & countdown computation
8. CAP alert draft generation for IMD approval
9. Logs stage-by-stage processing time vs the <= 5 min target.
"""

from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Tuple, Any
import time
import numpy as np

from app.config import (
    ProvenanceType,
    REGIONS,
    RADAR_SITES,
    settings,
)
from app.adapters.radar_source import RadarSource
from app.adapters.satellite_source import SatelliteSource
from app.adapters.lightning_source import LightningSource
from app.adapters.nwp_source import NWPSource
from app.fusion.grid import FusionEngine, FusedSnapshot
from app.ci.detector import ConvectiveInitiationDetector, CICandidate
from app.nowcast.optical_flow import compute_optical_flow, extrapolate_field
from app.nowcast.ensemble import STEPSNowcastEnsemble
from app.blend.blender import blend_nowcast_with_nwp
from app.hazards.hail import evaluate_hail_hazard
from app.hazards.lightning import evaluate_lightning_hazard
from app.hazards.downburst import detect_downburst_hazard, DownburstEvent
from app.hazards.cloudburst import cloudburst_clusters, cloudburst_probability
from app.tracking.cell_tracker import StormCellTracker, TrackedCell
from app.tracking.countdown import evaluate_places_countdowns, PlaceThreatCountdown
from app.alerts.cap import create_cap_alert, AlertPayload
from app.verification.metrics import evaluate_forecast_lead_curve, derive_confidence_table


class PipelineEngine:
    """Core stateful pipeline engine executing 5-minute cycles."""

    def __init__(self, region_id: str = "kolkata", mode: str = "SIMULATED"):
        self.region_id = region_id if region_id in REGIONS else "kolkata"
        self.region = REGIONS[self.region_id]
        self.mode = mode
        self.step_index: int = 0
        self.base_time = datetime(2026, 5, 15, 14, 0, 0, tzinfo=timezone.utc)

        # Adapters
        self.radar_src = RadarSource(mode=mode, region_id=self.region_id)
        self.sat_src = SatelliteSource(mode=mode, region_id=self.region_id)
        self.lght_src = LightningSource(mode=mode, region_id=self.region_id)
        self.nwp_src = NWPSource(mode=mode, region_id=self.region_id)

        # Engines
        self.fusion_engine = FusionEngine(region_id=self.region_id)
        self.radar_site = self.fusion_engine.radar_site
        self.ci_detector = ConvectiveInitiationDetector()
        self.ensemble_engine = STEPSNowcastEnsemble(n_members=12)
        self.cell_tracker = StormCellTracker()

        # Cache of cycle outputs
        self.latest_fused: Optional[FusedSnapshot] = None
        self.latest_cells: List[TrackedCell] = []
        self.latest_countdowns: List[PlaceThreatCountdown] = []
        self.latest_ci_candidates: List[CICandidate] = []
        self.latest_downbursts: List[DownburstEvent] = []
        self.latest_alerts: List[AlertPayload] = []
        self.latest_stage_latencies: List[Dict[str, Any]] = []
        self.latest_confidence_table: Dict[str, Dict[str, str]] = {}
        self.latest_verification: List[Dict[str, Any]] = []
        self.nowcast_rain_ensemble: Optional[np.ndarray] = None
        self.hazard_grids: Dict[str, np.ndarray] = {}

        # History for velocity & trend
        self._prev_fused: Optional[FusedSnapshot] = None
        self._prev_ir: Optional[np.ndarray] = None
        self._prev_lght_density: Optional[np.ndarray] = None
        self._prev_dbz: Optional[np.ndarray] = None

    def execute_cycle(self, step: Optional[int] = None) -> Dict[str, Any]:
        """Executes one complete 5-minute nowcast cycle."""
        if step is not None:
            self.step_index = step

        t_cycle_start = time.perf_counter()
        cycle_time = self.base_time + timedelta(seconds=self.step_index * settings.cycle_interval_seconds)
        stage_timings: List[Dict[str, Any]] = []

        # Stage 1: Ingest
        t0 = time.perf_counter()
        r_frame = self.radar_src.fetch_latest(step_index=self.step_index)
        s_frame = self.sat_src.fetch_latest(step_index=self.step_index)
        l_list = self.lght_src.fetch_latest(step_index=self.step_index)
        n_field = self.nwp_src.fetch_latest(lead_minutes=120)
        stage_timings.append({
            "stage_name": "Multi-Source Ingest",
            "duration_ms": round((time.perf_counter() - t0) * 1000, 2),
            "status": "COMPLETED",
        })

        # Stage 2: Quality Control & Fusion Grid
        t0 = time.perf_counter()
        fused = self.fusion_engine.fuse(r_frame, s_frame, l_list, n_field)
        self.latest_fused = fused
        stage_timings.append({
            "stage_name": "QC & 1 km Fusion Grid",
            "duration_ms": round((time.perf_counter() - t0) * 1000, 2),
            "status": "COMPLETED",
        })

        # Stage 3: Convective Initiation (CI) Detection
        t0 = time.perf_counter()
        prev_ir = self._prev_ir if self._prev_ir is not None else fused.satellite_ir_k
        ci_candidates, ci_prob_grid = self.ci_detector.detect(
            current_ir_k=fused.satellite_ir_k,
            previous_ir_k=prev_ir,
            lat_grid=fused.lat_grid,
            lon_grid=fused.lon_grid,
            current_radar_dbz=fused.reflectivity_qc,
        )
        self.latest_ci_candidates = ci_candidates
        self.hazard_grids["convective_initiation"] = ci_prob_grid
        stage_timings.append({
            "stage_name": "Satellite Convective Initiation",
            "duration_ms": round((time.perf_counter() - t0) * 1000, 2),
            "status": "COMPLETED",
        })

        # Stage 4: PySteps Optical Flow & Ensemble Extrapolation (0-2h)
        t0 = time.perf_counter()
        prev_dbz = self._prev_dbz if self._prev_dbz is not None else fused.reflectivity_qc
        frames_pair = np.stack([prev_dbz, fused.reflectivity_qc], axis=0)
        velocity = compute_optical_flow(frames_pair)

        # 12-member ensemble of rain rates for 24 steps (120 min)
        ensemble_rain = self.ensemble_engine.generate_ensemble(
            fused.rain_rate_mmh, velocity, lead_steps=24
        )
        self.nowcast_rain_ensemble = ensemble_rain
        ens_mean_rain = self.ensemble_engine.compute_ensemble_mean(ensemble_rain)
        stage_timings.append({
            "stage_name": "PySTEPS Ensemble Nowcast (0-2h)",
            "duration_ms": round((time.perf_counter() - t0) * 1000, 2),
            "status": "COMPLETED",
        })

        # Stage 5: NWP Blending (2-6h)
        t0 = time.perf_counter()
        # For lead time 180 min (3h) and 360 min (6h)
        blended_3h, weights_3h = blend_nowcast_with_nwp(
            ens_mean_rain[-1], fused.nwp_precip_mmh, lead_minutes=180
        )
        stage_timings.append({
            "stage_name": "NWP Skill-Weighted Blend (2-6h)",
            "duration_ms": round((time.perf_counter() - t0) * 1000, 2),
            "status": "COMPLETED",
        })

        # Stage 6: Hazard Diagnostics
        t0 = time.perf_counter()
        # Lightning
        lght_prob, lght_density, _ = evaluate_lightning_hazard(
            fused.lightning_density, self._prev_lght_density, fused.reflectivity_qc, fused.satellite_ir_k
        )
        # Hail
        hail_prob, mesh_mm, _ = evaluate_hail_hazard(fused.reflectivity_qc, fused.satellite_ir_k)
        # Downburst
        downburst_events, downburst_prob, _ = detect_downburst_hazard(
            fused.radial_velocity_qc, fused.reflectivity_qc, self._prev_dbz, fused.lat_grid, fused.lon_grid
        )
        self.latest_downbursts = downburst_events

        # Cloudburst
        cb_clusters = cloudburst_clusters(ens_mean_rain[0], cell_area_km2=1.0)
        cb_prob = cloudburst_probability(ensemble_rain[:, 0])

        self.hazard_grids["lightning"] = lght_prob
        self.hazard_grids["hail"] = hail_prob
        self.hazard_grids["downburst"] = downburst_prob
        self.hazard_grids["cloudburst"] = (ens_mean_rain[0] >= 100.0).astype(np.float32)

        stage_timings.append({
            "stage_name": "Hazard Diagnostics",
            "duration_ms": round((time.perf_counter() - t0) * 1000, 2),
            "status": "COMPLETED",
        })

        # Stage 7: Storm Cell Tracking & Live Countdowns
        t0 = time.perf_counter()
        cells = self.cell_tracker.update(
            radar_dbz=fused.reflectivity_qc,
            lat_grid=fused.lat_grid,
            lon_grid=fused.lon_grid,
            velocity_field=velocity,
            hail_prob=hail_prob,
            lightning_density=fused.lightning_density,
            downburst_prob=downburst_prob,
        )
        self.latest_cells = cells

        countdowns = evaluate_places_countdowns(
            places=self.region.monitored_places,
            ensemble_rain_rate=ensemble_rain,
            lat_grid=fused.lat_grid,
            lon_grid=fused.lon_grid,
            issued_time=cycle_time,
            now_time=cycle_time,
            threshold_mmh=25.0,
        )
        self.latest_countdowns = countdowns
        stage_timings.append({
            "stage_name": "Cell Tracking & Countdowns",
            "duration_ms": round((time.perf_counter() - t0) * 1000, 2),
            "status": "COMPLETED",
        })

        # Stage 8: CAP Alert Draft Generation
        t0 = time.perf_counter()
        alerts = []
        for cell in cells:
            if cell.severity in ["SEVERE", "EXTREME"]:
                alert_id = f"VAJRA-{self.region_id.upper()}-{cell.cell_id}-{int(cycle_time.timestamp())}"
                event_name = f"Severe Convective Storm ({', '.join(cell.active_hazards) or 'Thunderstorm'})"
                poly = cell.polygon_boundary if len(cell.polygon_boundary) >= 3 else [
                    (cell.centroid_lat - 0.1, cell.centroid_lon - 0.1),
                    (cell.centroid_lat + 0.1, cell.centroid_lon - 0.1),
                    (cell.centroid_lat + 0.1, cell.centroid_lon + 0.1),
                    (cell.centroid_lat - 0.1, cell.centroid_lon + 0.1),
                ]
                alert = create_cap_alert(
                    alert_id=alert_id,
                    event=event_name,
                    place_name=self.region.name,
                    polygon=poly,
                    probability=0.85 if cell.severity == "EXTREME" else 0.65,
                    onset=cycle_time + timedelta(minutes=20),
                    severity="Extreme" if cell.severity == "EXTREME" else "Severe",
                )
                alerts.append(alert)
        self.latest_alerts = alerts
        stage_timings.append({
            "stage_name": "CAP 1.2 Alert Drafting",
            "duration_ms": round((time.perf_counter() - t0) * 1000, 2),
            "status": "COMPLETED",
        })

        # Stage 9: Verification & Confidence Table
        t0 = time.perf_counter()
        fcst_leads = [ensemble_rain[0, min(i, 23)] for i in [2, 5, 8, 11, 17, 23]]
        # Use previous observations as simulated ground truth
        obs_leads = [fused.rain_rate_mmh for _ in range(6)]
        v_curve = evaluate_forecast_lead_curve(fcst_leads, obs_leads, threshold=20.0)
        self.latest_verification = v_curve
        self.latest_confidence_table = derive_confidence_table(v_curve)
        stage_timings.append({
            "stage_name": "Verification & Skill Scoring",
            "duration_ms": round((time.perf_counter() - t0) * 1000, 2),
            "status": "COMPLETED",
        })

        # Total pipeline latency
        total_latency_ms = round((time.perf_counter() - t_cycle_start) * 1000, 2)
        self.latest_stage_latencies = stage_timings

        # Update historical references for next cycle
        self._prev_fused = fused
        self._prev_ir = np.copy(fused.satellite_ir_k)
        self._prev_lght_density = np.copy(fused.lightning_density)
        self._prev_dbz = np.copy(fused.reflectivity_qc)

        summary = {
            "cycle_id": f"CYCLE-{int(cycle_time.timestamp())}",
            "timestamp": cycle_time.isoformat(),
            "region_id": self.region_id,
            "region_name": self.region.name,
            "provenance": fused.provenance,
            "total_latency_ms": total_latency_ms,
            "meets_target_latency": total_latency_ms <= (settings.max_latency_target_seconds * 1000),
            "stage_timings": stage_timings,
            "active_cell_count": len(cells),
            "active_alert_count": len(alerts),
            "sources": {
                "radar": {"latency_s": fused.source_latencies_seconds.get("radar", 0.0), "status": "OK"},
                "satellite": {"latency_s": fused.source_latencies_seconds.get("satellite", 0.0), "status": "OK"},
                "lightning": {"latency_s": fused.source_latencies_seconds.get("lightning", 0.0), "status": "OK"},
                "nwp": {"latency_s": 0.0, "status": "OK (Read-only)"},
            },
        }
        return summary
