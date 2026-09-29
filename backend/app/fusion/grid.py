"""Fusion Grid Engine for VAJRA.
Regrids Radar, INSAT-3DR/3DS IR, Lightning strokes, and NWP to a common 1 km Cartesian grid
on a fixed 5-minute clock. Computes coverage masks to enforce honest confidence zoning.
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple, Any
import numpy as np
from scipy import ndimage
from scipy.interpolate import RegularGridInterpolator

from app.config import (
    ProvenanceType,
    RegionConfig,
    REGIONS,
    RADAR_SITES,
    settings,
)
from app.adapters.base import (
    RadarVolumeFrame,
    SatelliteIRFrame,
    LightningStrokeList,
    NWPForecastField,
)
from app.fusion.qc import (
    remove_speckle,
    filter_ground_clutter,
    attenuation_correction_hook,
    zr_reflectivity_to_rain_rate,
)


@dataclass
class FusedSnapshot:
    """Synchronized multi-sensor field on the common 1 km grid."""
    timestamp: datetime
    region_id: str
    provenance: ProvenanceType
    lat_grid: np.ndarray  # 2D array (ny, nx)
    lon_grid: np.ndarray  # 2D array (ny, nx)
    reflectivity_qc: np.ndarray  # dBZ (QC corrected)
    radial_velocity_qc: Optional[np.ndarray]  # m/s
    rain_rate_mmh: np.ndarray  # mm/h
    satellite_ir_k: np.ndarray  # Kelvin
    lightning_density: np.ndarray  # strokes / km^2 / 5-min
    nwp_precip_mmh: np.ndarray  # mm/h (read-only)
    radar_coverage_mask: np.ndarray  # 1 = inside radar coverage, 0 = satellite-only hatched area
    clutter_mask: np.ndarray  # 1 = filtered clutter
    source_latencies_seconds: Dict[str, float] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)


class FusionEngine:
    """Manages regridding, QC, and multi-sensor alignment for a region."""

    def __init__(self, region_id: str = "kolkata"):
        self.region_id = region_id if region_id in REGIONS else "kolkata"
        self.region = REGIONS[self.region_id]
        self.radar_site = RADAR_SITES[self.region.radar_sites[0]]
        self.lat_grid, self.lon_grid = self._create_grid()
        self.ny, self.nx = self.lat_grid.shape
        self.radar_coverage_mask = self._compute_coverage_mask()

    def _create_grid(self) -> Tuple[np.ndarray, np.ndarray]:
        """Creates 1 km regular lat/lon grid for the region."""
        d_lat = self.region.grid_res_km / 111.0
        d_lon = self.region.grid_res_km / 103.0
        lats = np.arange(self.region.lat_min, self.region.lat_max, d_lat)
        lons = np.arange(self.region.lon_min, self.region.lon_max, d_lon)
        lon_grid, lat_grid = np.meshgrid(lons, lats)
        return lat_grid.astype(np.float32), lon_grid.astype(np.float32)

    def _compute_coverage_mask(self) -> np.ndarray:
        """Computes boolean mask where distance to radar <= radar max_range_km."""
        d_lat_km = (self.lat_grid - self.radar_site.lat) * 111.0
        d_lon_km = (self.lon_grid - self.radar_site.lon) * 103.0
        dist_km = np.sqrt(d_lat_km**2 + d_lon_km**2)
        return (dist_km <= self.radar_site.max_range_km).astype(np.uint8)

    def fuse(
        self,
        radar_frame: RadarVolumeFrame,
        satellite_frame: SatelliteIRFrame,
        lightning_strokes: LightningStrokeList,
        nwp_field: Optional[NWPForecastField] = None,
        gauge_bias_factor: float = 1.0,
    ) -> FusedSnapshot:
        """Applies QC and fuses all sources onto the common 1 km grid."""
        t_now = datetime.now(timezone.utc)
        
        # 1. Regrid Radar Reflectivity
        dbz_regrid = self._regrid_field(
            radar_frame.reflectivity,
            radar_frame.lat_grid,
            radar_frame.lon_grid,
            fill_value=-32.0,
        )
        
        # Regrid Radial Velocity if available
        vrad_regrid = None
        if radar_frame.radial_velocity is not None:
            vrad_regrid = self._regrid_field(
                radar_frame.radial_velocity,
                radar_frame.lat_grid,
                radar_frame.lon_grid,
                fill_value=0.0,
            )

        # 2. Apply Radar Quality Control
        # a) Speckle removal
        dbz_despeckled = remove_speckle(dbz_regrid, min_cluster_pixels=3)
        # b) Ground clutter & AP filtering
        dbz_clutter_filtered, clutter_mask = filter_ground_clutter(dbz_despeckled, vrad=vrad_regrid)
        # c) Attenuation correction hook
        dbz_qc = attenuation_correction_hook(dbz_clutter_filtered)

        # Mask radar data outside coverage ring
        dbz_qc[self.radar_coverage_mask == 0] = -32.0
        if vrad_regrid is not None:
            vrad_regrid[self.radar_coverage_mask == 0] = 0.0

        # 3. Z-R Rain rate calculation
        rain_rate = zr_reflectivity_to_rain_rate(
            dbz_qc,
            a=settings.zr_a,
            b=settings.zr_b,
            gauge_bias_factor=gauge_bias_factor,
        )

        # 4. Regrid INSAT IR brightness temperature (native ~4 km to 1 km)
        ir_regrid = self._regrid_field(
            satellite_frame.brightness_temp_k,
            satellite_frame.lat_grid,
            satellite_frame.lon_grid,
            fill_value=290.0,
        )

        # 5. Bin discrete lightning strokes onto 1 km grid
        lght_density = self._bin_lightning_strokes(lightning_strokes)

        # 6. Regrid NWP precipitation rate
        if nwp_field is not None:
            nwp_regrid = self._regrid_field(
                nwp_field.precip_rate_mmh,
                nwp_field.lat_grid,
                nwp_field.lon_grid,
                fill_value=0.0,
            )
        else:
            nwp_regrid = np.zeros((self.ny, self.nx), dtype=np.float32)

        # Ingest latencies
        latencies = {
            "radar": max(0.0, (t_now - radar_frame.timestamp).total_seconds()),
            "satellite": max(0.0, (t_now - satellite_frame.timestamp).total_seconds()),
            "lightning": max(0.0, (t_now - lightning_strokes.timestamp).total_seconds()),
        }

        # Overall provenance
        provenances = [
            radar_frame.provenance,
            satellite_frame.provenance,
            lightning_strokes.provenance,
        ]
        provenance = (
            ProvenanceType.LIVE
            if all(p == ProvenanceType.LIVE for p in provenances)
            else (
                ProvenanceType.REPLAY_REAL
                if any(p == ProvenanceType.REPLAY_REAL for p in provenances)
                else ProvenanceType.SIMULATED
            )
        )

        return FusedSnapshot(
            timestamp=radar_frame.timestamp,
            region_id=self.region_id,
            provenance=provenance,
            lat_grid=self.lat_grid,
            lon_grid=self.lon_grid,
            reflectivity_qc=dbz_qc.astype(np.float32),
            radial_velocity_qc=vrad_regrid.astype(np.float32) if vrad_regrid is not None else None,
            rain_rate_mmh=rain_rate.astype(np.float32),
            satellite_ir_k=ir_regrid.astype(np.float32),
            lightning_density=lght_density.astype(np.float32),
            nwp_precip_mmh=nwp_regrid.astype(np.float32),
            radar_coverage_mask=self.radar_coverage_mask,
            clutter_mask=clutter_mask.astype(np.uint8),
            source_latencies_seconds=latencies,
            metadata={
                "region": self.region_id,
                "radar_site": self.radar_site.name,
                "ny": self.ny,
                "nx": self.nx,
                "grid_res_km": 1.0,
            },
        )

    def _regrid_field(
        self,
        source_data: np.ndarray,
        source_lat: np.ndarray,
        source_lon: np.ndarray,
        fill_value: float = 0.0,
    ) -> np.ndarray:
        """Regrid 2D field to the target 1 km grid via interpolation."""
        if source_data.shape == (self.ny, self.nx):
            return np.copy(source_data)

        # If 1D coordinate vectors are available or regular mesh
        src_lats = source_lat[:, 0] if source_lat.ndim == 2 else source_lat
        src_lons = source_lon[0, :] if source_lon.ndim == 2 else source_lon

        try:
            interp = RegularGridInterpolator(
                (src_lats, src_lons),
                source_data,
                bounds_error=False,
                fill_value=fill_value,
            )
            pts = np.stack([self.lat_grid.ravel(), self.lon_grid.ravel()], axis=-1)
            regrid = interp(pts).reshape((self.ny, self.nx))
            return regrid
        except Exception:
            # Fallback to zoom resampling
            zoom_y = self.ny / source_data.shape[0]
            zoom_x = self.nx / source_data.shape[1]
            return ndimage.zoom(source_data, (zoom_y, zoom_x), order=1)

    def _bin_lightning_strokes(self, stroke_list: LightningStrokeList) -> np.ndarray:
        """Bin discrete strokes into 1 km flash density grid (strokes / km^2 / 5min)."""
        density = np.zeros((self.ny, self.nx), dtype=np.float32)
        if not stroke_list.strokes:
            return density

        lats = [s.lat for s in stroke_list.strokes]
        lons = [s.lon for s in stroke_list.strokes]

        # Region coordinates
        lat_min = self.region.lat_min
        lat_max = self.region.lat_max
        lon_min = self.region.lon_min
        lon_max = self.region.lon_max

        # 2D histogram
        H, _, _ = np.histogram2d(
            lats,
            lons,
            bins=[self.ny, self.nx],
            range=[[lat_min, lat_max], [lon_min, lon_max]],
        )
        # Smooth slightly to represent flash charge area (radius ~ 2 km)
        density = ndimage.gaussian_filter(H.astype(np.float32), sigma=1.2)
        return density
