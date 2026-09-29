"""Storm Cell Identification and Tracking Engine.
Identifies convective cells using reflectivity thresholding (>= 40 dBZ) and connected components.
Tracks cells across consecutive cycles, computes motion vectors (speed km/h, direction azimuth/cardinal),
determines intensity trends (INTENSIFYING / STEADY / WEAKENING), and tracks history for UI sparklines.
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Dict, Tuple, Optional, Any
import numpy as np
from scipy import ndimage


@dataclass
class ForecastTrackPoint:
    lead_minutes: int
    lat: float
    lon: float
    semi_major_km: float  # Uncertainty ellipse semi-major axis
    semi_minor_km: float  # Uncertainty ellipse semi-minor axis


@dataclass
class TrackedCell:
    """An identified convective storm cell tracked across frames."""
    cell_id: str
    centroid_lat: float
    centroid_lon: float
    area_km2: float
    max_dbz: float
    mean_dbz: float
    motion_speed_kmh: float
    motion_direction_deg: float
    motion_direction_cardinal: str
    trend: str  # "INTENSIFYING", "STEADY", "WEAKENING"
    severity: str  # "MODERATE", "SEVERE", "EXTREME"
    active_hazards: List[str] = field(default_factory=list)
    reflectivity_sparkline: List[float] = field(default_factory=list)
    forecast_track: List[ForecastTrackPoint] = field(default_factory=list)
    polygon_boundary: List[Tuple[float, float]] = field(default_factory=list)


class StormCellTracker:
    """Tracks storm cells over time using centroid matching and optical flow."""

    def __init__(self, min_dbz: float = 40.0, min_area_km2: float = 12.0):
        self.min_dbz = min_dbz
        self.min_area_km2 = min_area_km2
        self.previous_cells: Dict[str, TrackedCell] = {}
        self.cell_counter: int = 1

    def update(
        self,
        radar_dbz: np.ndarray,
        lat_grid: np.ndarray,
        lon_grid: np.ndarray,
        velocity_field: Optional[np.ndarray] = None,
        hail_prob: Optional[np.ndarray] = None,
        lightning_density: Optional[np.ndarray] = None,
        downburst_prob: Optional[np.ndarray] = None,
        dt_minutes: float = 5.0,
    ) -> List[TrackedCell]:
        """Identifies cells in current frame and tracks them against previous cycle."""
        ny, nx = radar_dbz.shape
        mask = radar_dbz >= self.min_dbz
        labeled, num_features = ndimage.label(mask, structure=np.ones((3, 3), dtype=int))

        current_detected: List[Dict[str, Any]] = []

        for k in range(1, num_features + 1):
            cell_mask = labeled == k
            area_km2 = float(np.sum(cell_mask))
            if area_km2 < self.min_area_km2:
                continue

            ys, xs = np.nonzero(cell_mask)
            c_lat = float(np.mean(lat_grid[ys, xs]))
            c_lon = float(np.mean(lon_grid[ys, xs]))
            max_val = float(np.max(radar_dbz[cell_mask]))
            mean_val = float(np.mean(radar_dbz[cell_mask]))

            # Boundary polygon sample (convex hull or exterior perimeter points)
            # Take downsampled perimeter points for GIS display
            poly = self._extract_perimeter_coords(cell_mask, lat_grid, lon_grid)

            # Hazards active in this cell
            hazards = []
            if hail_prob is not None and np.max(hail_prob[cell_mask]) >= 0.5:
                hazards.append("hail")
            if lightning_density is not None and np.max(lightning_density[cell_mask]) >= 0.2:
                hazards.append("lightning")
            if downburst_prob is not None and np.max(downburst_prob[cell_mask]) >= 0.5:
                hazards.append("downburst")
            if max_val >= 58.0:
                hazards.append("cloudburst")

            severity = "MODERATE"
            if max_val >= 58.0 or "downburst" in hazards:
                severity = "EXTREME"
            elif max_val >= 50.0 or "hail" in hazards:
                severity = "SEVERE"

            current_detected.append({
                "lat": c_lat,
                "lon": c_lon,
                "area_km2": area_km2,
                "max_dbz": max_val,
                "mean_dbz": mean_val,
                "hazards": hazards,
                "severity": severity,
                "polygon": poly,
                "ys": ys,
                "xs": xs,
            })

        # Match detected cells with previous cycle cells
        updated_cells: Dict[str, TrackedCell] = {}
        used_prev_ids = set()

        for det in current_detected:
            best_id = None
            min_dist_km = 999.0

            for prev_id, prev_cell in self.previous_cells.items():
                if prev_id in used_prev_ids:
                    continue
                # Expected position from previous motion
                d_lat = (det["lat"] - prev_cell.centroid_lat) * 111.0
                d_lon = (det["lon"] - prev_cell.centroid_lon) * 103.0
                dist_km = np.sqrt(d_lat**2 + d_lon**2)

                # Matching threshold: storm moves at most ~80 km/h (< 12 km in 5 min)
                if dist_km < 14.0 and dist_km < min_dist_km:
                    min_dist_km = dist_km
                    best_id = prev_id

            if best_id is not None:
                cell_id = best_id
                used_prev_ids.add(cell_id)
                prev_cell = self.previous_cells[cell_id]

                # Compute motion vector
                d_lat_km = (det["lat"] - prev_cell.centroid_lat) * 111.0
                d_lon_km = (det["lon"] - prev_cell.centroid_lon) * 103.0
                speed_kmh = round((min_dist_km / dt_minutes) * 60.0, 1)
                angle_rad = np.arctan2(d_lon_km, d_lat_km)  # 0 = North, pi/2 = East
                angle_deg = round((np.degrees(angle_rad) + 360) % 360, 1)
                cardinal = self._degrees_to_cardinal(angle_deg)

                # Trend
                dbz_diff = det["max_dbz"] - prev_cell.max_dbz
                if dbz_diff >= 2.0:
                    trend = "INTENSIFYING"
                elif dbz_diff <= -2.0:
                    trend = "WEAKENING"
                else:
                    trend = "STEADY"

                sparkline = prev_cell.reflectivity_sparkline[-7:] + [round(det["max_dbz"], 1)]
            else:
                # New cell
                cell_id = f"CELL-{self.cell_counter:02d}"
                self.cell_counter += 1
                # Default motion from velocity field if available, else standard ESE drift
                speed_kmh, angle_deg, cardinal = 42.0, 110.0, "ESE"
                if velocity_field is not None and len(det["ys"]) > 0:
                    u_pts = velocity_field[0, det["ys"], det["xs"]]
                    v_pts = velocity_field[1, det["ys"], det["xs"]]
                    u_mean = float(np.mean(u_pts))
                    v_mean = float(np.mean(v_pts))
                    speed_px = np.sqrt(u_mean**2 + v_mean**2)
                    speed_kmh = round((speed_px * 1.0 / dt_minutes) * 60.0, 1)
                    angle_deg = round((np.degrees(np.arctan2(u_mean, v_mean)) + 360) % 360, 1)
                    cardinal = self._degrees_to_cardinal(angle_deg)

                trend = "STEADY"
                sparkline = [round(det["max_dbz"], 1)]

            # Compute forecast track with growing uncertainty ellipses
            forecast_track = self._compute_forecast_track(
                det["lat"], det["lon"], speed_kmh, angle_deg
            )

            cell = TrackedCell(
                cell_id=cell_id,
                centroid_lat=round(det["lat"], 4),
                centroid_lon=round(det["lon"], 4),
                area_km2=round(det["area_km2"], 1),
                max_dbz=round(det["max_dbz"], 1),
                mean_dbz=round(det["mean_dbz"], 1),
                motion_speed_kmh=speed_kmh,
                motion_direction_deg=angle_deg,
                motion_direction_cardinal=cardinal,
                trend=trend,
                severity=det["severity"],
                active_hazards=det["hazards"],
                reflectivity_sparkline=sparkline,
                forecast_track=forecast_track,
                polygon_boundary=det["polygon"],
            )
            updated_cells[cell_id] = cell

        self.previous_cells = updated_cells
        return list(updated_cells.values())

    def _compute_forecast_track(
        self, lat: float, lon: float, speed_kmh: float, angle_deg: float
    ) -> List[ForecastTrackPoint]:
        """Computes future track positions at +15, +30, +45, +60 min with uncertainty ellipses."""
        pts = []
        angle_rad = np.radians(angle_deg)
        # Vector components in km/h
        v_north = speed_kmh * np.cos(angle_rad)
        v_east = speed_kmh * np.sin(angle_rad)

        for lead_min in [15, 30, 45, 60]:
            dist_km = (lead_min / 60.0)
            d_lat = (v_north * dist_km) / 111.0
            d_lon = (v_east * dist_km) / 103.0
            # Uncertainty ellipse grows with lead time
            major_km = round(3.0 + (lead_min / 60.0) * 10.0, 1)
            minor_km = round(2.0 + (lead_min / 60.0) * 6.0, 1)
            pts.append(
                ForecastTrackPoint(
                    lead_minutes=lead_min,
                    lat=round(lat + d_lat, 4),
                    lon=round(lon + d_lon, 4),
                    semi_major_km=major_km,
                    semi_minor_km=minor_km,
                )
            )
        return pts

    def _extract_perimeter_coords(
        self, mask: np.ndarray, lat_grid: np.ndarray, lon_grid: np.ndarray
    ) -> List[Tuple[float, float]]:
        """Extracts boundary perimeter coordinates for a cell."""
        eroded = ndimage.binary_erosion(mask)
        perimeter = mask & ~eroded
        ys, xs = np.nonzero(perimeter)
        if len(ys) == 0:
            return []
        # Sample up to 16 points along the perimeter to keep payloads light
        step = max(1, len(ys) // 16)
        coords = [(round(float(lat_grid[ys[i], xs[i]]), 4), round(float(lon_grid[ys[i], xs[i]]), 4))
                  for i in range(0, len(ys), step)]
        if coords and coords[0] != coords[-1]:
            coords.append(coords[0])
        return coords

    @staticmethod
    def _degrees_to_cardinal(deg: float) -> str:
        cardinals = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
                     "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]
        idx = int((deg + 11.25) / 22.5) % 16
        return cardinals[idx]
