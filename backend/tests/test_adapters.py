"""Tests for VAJRA Data Adapters and INDIA-SIM Scenarios."""

import pytest
import numpy as np
from datetime import datetime, timezone

from app.config import (
    ProvenanceType,
    RADAR_SITES,
    REGIONS,
    settings,
)
from app.simulators.india_sim import IndiaScenarioSimulator
from app.adapters.radar_source import RadarSource
from app.adapters.satellite_source import SatelliteSource
from app.adapters.lightning_source import LightningSource
from app.adapters.nwp_source import NWPSource


def test_config_radar_sites_and_regions():
    assert "VECC_KOLKATA" in RADAR_SITES
    assert "DEHRADUN_DWR" in RADAR_SITES
    assert "kolkata" in REGIONS
    assert "uttarakhand" in REGIONS

    kolkata = REGIONS["kolkata"]
    assert kolkata.lat_min < kolkata.lat_max
    assert kolkata.lon_min < kolkata.lon_max
    assert len(kolkata.monitored_places) >= 5

    airport_codes = [p.code for p in kolkata.monitored_places]
    assert "CCU" in airport_codes


def test_india_sim_kolkata_norwester():
    sim = IndiaScenarioSimulator(region_id="kolkata")

    frame0 = sim.get_radar_frame(step_index=0)
    assert frame0.provenance == "SIMULATED"
    assert frame0.reflectivity.shape == frame0.lat_grid.shape
    assert np.max(frame0.reflectivity) > 55.0

    frame5 = sim.get_radar_frame(step_index=5)
    assert frame5.radial_velocity is not None
    v_span = np.max(frame5.radial_velocity) - np.min(frame5.radial_velocity)
    assert v_span >= 20.0, f"Expected downburst velocity span >= 20 m/s, got {v_span}"

    sat_frame = sim.get_satellite_ir_frame(step_index=0)
    assert sat_frame.provenance == "SIMULATED"
    assert np.min(sat_frame.brightness_temp_k) < 220.0

    sat0 = sim.get_satellite_ir_frame(step_index=0)
    sat3 = sim.get_satellite_ir_frame(step_index=3)
    diff = sat3.brightness_temp_k - sat0.brightness_temp_k
    min_cooling = float(np.min(diff))
    assert min_cooling < -15.0

    lght = sim.get_lightning_strokes(step_index=0)
    assert lght.provenance == "SIMULATED"
    assert len(lght.strokes) >= 30


def test_india_sim_uttarakhand_cloudburst():
    sim = IndiaScenarioSimulator(region_id="uttarakhand")
    frame = sim.get_radar_frame(step_index=0)

    assert frame.provenance == "SIMULATED"
    assert np.max(frame.reflectivity) >= 58.0

    z_linear = 10.0 ** (np.maximum(frame.reflectivity, 0.0) / 10.0)
    rain_rate = (z_linear / settings.zr_a) ** (1.0 / settings.zr_b)
    assert np.max(rain_rate) >= 100.0


def test_radar_source_adapter():
    src_sim = RadarSource(mode="SIMULATED", region_id="kolkata")
    f_sim = src_sim.fetch_latest(step_index=1)
    assert f_sim.provenance == "SIMULATED"

    src_replay = RadarSource(mode="REPLAY_REAL", region_id="kolkata")
    f_rep = src_replay.fetch_latest(step_index=1)
    assert f_rep.provenance == "REPLAY"

    src_imd = RadarSource(mode="IMD_DWR", region_id="kolkata")
    f_imd = src_imd.fetch_latest()
    assert "IMD" in f_imd.metadata.get("source", "")


def test_satellite_and_lightning_sources():
    sat_src = SatelliteSource(mode="SIMULATED", region_id="kolkata")
    sat_frame = sat_src.fetch_latest(step_index=2)
    assert sat_frame.satellite_id == "INSAT-3DS"

    lght_src = LightningSource(mode="SIMULATED", region_id="kolkata")
    lght_data = lght_src.fetch_latest(step_index=2)
    assert len(lght_data.strokes) > 0


def test_nwp_source_read_only_honesty():
    nwp_src = NWPSource(mode="SIMULATED", region_id="kolkata")
    nwp_field = nwp_src.fetch_latest(lead_minutes=180)
    assert nwp_field.lead_minutes == 180
    assert "Read-only" in nwp_field.model_name
