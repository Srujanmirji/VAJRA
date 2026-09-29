/**
 * VAJRA Standalone Simulator & Serverless Mock Engine
 * Operational Kalbaishakhi (Nor'wester) Doppler Radar Nowcast System.
 *
 * Implements:
 * 1) Seeded PRNG for 100% deterministic scenario replay.
 * 2) 1 km Cartesian operational grid over Kolkata / Gangetic West Bengal:
 *    Bounds: [85.9, 21.3] to [89.4, 24.0].
 * 3) Physically plausible squall line radar echoes:
 *    - Anisotropic elongated convective cores (aspect ratio ~2.0, oriented along line)
 *    - Trailing stratiform region (25–35 dBZ) extending WNW behind line
 *    - Sharp gust front reflectivity gradient on leading ESE edge
 *    - 2D spatial fractal noise (Kolmogorov k^-3 power spectrum, +-6 to 8 dBZ)
 *    - Pre-frontal convective popcorn cells (20–35 dBZ)
 *    - CELL_KOL_03_CI: satellite convective initiation (0 dBZ initially -> 48 dBZ over 20-30 min)
 *    - 250 km radar range ring clipping around Kolkata DWR (22.57 N, 88.35 E)
 * 4) Real coordinates for monitored places (CCU, HWH, HLD, KGP, BDN, VECC).
 * 5) Dynamically computed 20-member ensemble arrival countdowns & windows.
 * 6) 12-cycle reflectivity sparkline history & forecast uncertainty tracks.
 */

export interface SimulationState {
  stepIndex: number;
  isPlaying: boolean;
  speed: number;
  region: string;
  baseTime: string;
}

export const globalSimState: SimulationState = {
  stepIndex: 3,
  isPlaying: false,
  speed: 10,
  region: "kolkata",
  baseTime: "2026-05-15T15:30:00Z",
};

// Seeded PRNG (Mulberry32) for deterministic replay
export function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Pre-initialize deterministic fractal noise modes with k^-3 scaling
const FRACTAL_RNG = mulberry32(0x9e3779b9);
const FRACTAL_MODES = [35, 24, 16, 11, 7.5, 5, 3.5].map((wl) => ({
  wl,
  amp: 3.2 * Math.pow(wl / 35, 1.2),
  phi: FRACTAL_RNG() * Math.PI,
  psi: FRACTAL_RNG() * 2 * Math.PI,
}));

export function getFractalNoise(x: number, y: number): number {
  let val = 0;
  for (let i = 0; i < FRACTAL_MODES.length; i++) {
    const m = FRACTAL_MODES[i];
    const proj = x * Math.cos(m.phi) + y * Math.sin(m.phi);
    val += m.amp * Math.sin((2 * Math.PI * proj) / m.wl + m.psi);
  }
  return val;
}

export function getSimulatedTimestamp(step: number = globalSimState.stepIndex): string {
  const d = new Date(globalSimState.baseTime);
  d.setMinutes(d.getMinutes() + step * 5);
  return d.toISOString();
}

// Real coordinates of monitored locations
export const MONITORED_PLACES = [
  {
    place_name: "Kolkata (NSCBI Airport)",
    place_code: "CCU",
    place_type: "AIRPORT_METRO",
    lat: 22.654,
    lon: 88.447,
  },
  {
    place_name: "Howrah Railway Terminal",
    place_code: "HWH",
    place_type: "TRANSIT_HUB",
    lat: 22.583,
    lon: 88.342,
  },
  {
    place_name: "Haldia Industrial Port",
    place_code: "HLD",
    place_type: "PORT_COASTAL",
    lat: 22.030,
    lon: 88.060,
  },
  {
    place_name: "Kharagpur IIT / Rail Junction",
    place_code: "KGP",
    place_type: "TRANSIT_EDUCATION",
    lat: 22.330,
    lon: 87.320,
  },
  {
    place_name: "Bardhaman Junction",
    place_code: "BDN",
    place_type: "URBAN_DISTRICT",
    lat: 23.240,
    lon: 87.860,
  },
  {
    place_name: "Kolkata S-Band DWR (VECC)",
    place_code: "VECC",
    place_type: "RADAR_SITE",
    lat: 22.570,
    lon: 88.350,
  },
];

export const RADAR_SITE = {
  name: "VECC Kolkata S-Band Doppler Weather Radar",
  lat: 22.570,
  lon: 88.350,
  range_km: 250.0,
};

export function getSourcesData(region: string = "kolkata") {
  const siteName = region === "uttarakhand" ? "Dehradun (C-Band DWR)" : "VECC Kolkata (S-Band DWR)";
  return {
    region,
    provenance: "SIMULATED / REPLAY",
    label: "Guidance for IMD forecasters — not a public warning",
    sources: [
      {
        id: "radar",
        name: siteName,
        type: "Doppler Weather Radar (Reflectivity + Radial Velocity)",
        latency_seconds: 12.0,
        coverage_pct: 99.4,
        status: "LIVE / SYNCHRONIZED",
      },
      {
        id: "satellite",
        name: "INSAT-3DS / 3DR (TIR-1 10.8µm)",
        type: "Geostationary Infrared Imagery",
        latency_seconds: 45.0,
        coverage_pct: 100.0,
        status: "SYNCHRONIZED (MOSDAC format)",
      },
      {
        id: "lightning",
        name: "Ground Lightning Network / GLM",
        type: "Total Lightning Strokes (CG + IC)",
        latency_seconds: 5.0,
        coverage_pct: 100.0,
        status: "REAL-TIME STREAM",
      },
      {
        id: "nwp",
        name: "IMD-HRRR 06 UTC Run (2h 10m ago)",
        type: "Numerical Weather Prediction (0-6h Blend)",
        latency_seconds: 7800.0,
        coverage_pct: 100.0,
        status: "LATEST_CYCLE_READ_ONLY",
      },
    ],
  };
}

export function getCycleLatestData(region: string = "kolkata") {
  return {
    region_id: region,
    region_name: region === "uttarakhand" ? "Uttarakhand (Himalayan Basin)" : "Kolkata (Gangetic West Bengal)",
    timestamp: getSimulatedTimestamp(),
    step_index: globalSimState.stepIndex,
    provenance: "SIMULATED / REPLAY",
    label: "Guidance for IMD forecasters — not a public warning",
    target_latency_seconds: 60,
    meets_target_latency: true,
    stages: [
      { stage_name: "01. Multi-Sensor Stream Ingest", duration_ms: 185, status: "OK" },
      { stage_name: "02. Clutter QC & Attenuation Correction", duration_ms: 310, status: "OK" },
      { stage_name: "03. 1 km Cartesian Grid Projection", duration_ms: 245, status: "OK" },
      { stage_name: "04. Satellite Convective Initiation (CI)", duration_ms: 85, status: "OK" },
      { stage_name: "05. Severe Hazards (Hail, Wind, Cloudburst)", duration_ms: 195, status: "OK" },
      { stage_name: "06. Cell Tracking & Countdowns", duration_ms: 140, status: "OK" },
      { stage_name: "07. STEPS Ensemble & ML U-Net", duration_ms: 850, status: "OK" },
      { stage_name: "08. NWP Sigmoid Lead-Time Blend", duration_ms: 110, status: "OK" },
      { stage_name: "09. CAP 1.2 XML Generation", duration_ms: 45, status: "OK" },
      { stage_name: "10. WebSocket Streaming Hub", duration_ms: 12, status: "OK" },
    ],
    active_cells_count: 3,
    active_alerts_count: 1,
    ci_candidates_count: 1,
    downburst_count: 1,
  };
}

// ---------------------------------------------------------------------------
// 5. COMPUTED ENSEMBLE COUNTDOWNS (NOT HARDCODED)
// ---------------------------------------------------------------------------
export function computeEnsembleCountdown(
  lat: number,
  lon: number,
  stepIndex: number = globalSimState.stepIndex
) {
  const T = stepIndex * 5;
  const speed0 = 46.0; // km/h
  const dir0 = 115.0;  // ESE in degrees
  const rad = Math.PI / 180;

  // Squall line leading edge center displacement
  const s0 = 0.767 * T;
  const xc = -35.0 + s0 * Math.sin(dir0 * rad);
  const yc = 15.0 + s0 * Math.cos(dir0 * rad);

  const xP = (lon - RADAR_SITE.lon) * 102.5;
  const yP = (lat - RADAR_SITE.lat) * 111.0;

  // 20 ensemble members with speed (+-15%) and direction (+-10 deg) perturbations
  const memberArrivals: { arrMin: number; dAlong: number }[] = [];
  for (let m = 0; m < 20; m++) {
    const pertSpeed = speed0 * (1.0 + ((m - 9.5) / 9.5) * 0.15);
    const pertDir = dir0 + ((m - 9.5) / 9.5) * 10.0;
    const uX = Math.sin(pertDir * rad);
    const uY = Math.cos(pertDir * rad);
    const vX = Math.cos(pertDir * rad);
    const vY = -Math.sin(pertDir * rad);

    const dx = xP - xc;
    const dy = yP - yc;
    const dAlong = dx * uX + dy * uY;
    const dCross = dx * vX - dy * vY;

    // Squall line lateral envelope [-70 km south, +85 km north]
    if (dCross >= -70 && dCross <= 85) {
      const arrMin = (dAlong / pertSpeed) * 60;
      memberArrivals.push({ arrMin, dAlong });
    }
  }

  // Baseline along-track distance
  const dx0 = xP - xc;
  const dy0 = yP - yc;
  const dAlong0 = dx0 * Math.sin(dir0 * rad) + dy0 * Math.cos(dir0 * rad);

  if (dAlong0 < -10.0) {
    return {
      status: "Passed",
      approaching: false,
      countdown_seconds: null,
      countdown_display: "Passed",
      window_display: "Passed",
      window_min: null,
      probability_pct: 0.0,
      threat_severity: "MODERATE",
      primary_hazard: "Trailing Stratiform Rain",
    };
  }

  if (dAlong0 >= -10.0 && dAlong0 <= 5.0) {
    return {
      status: "STORM OVERHEAD",
      approaching: true,
      countdown_seconds: 0,
      countdown_display: "STORM OVERHEAD",
      window_display: "Active",
      window_min: [0, 10] as [number, number],
      probability_pct: 95.0,
      threat_severity: "EXTREME",
      primary_hazard: "Severe Hail + 75 km/h Wind",
    };
  }

  const valid = memberArrivals.filter((m) => m.arrMin > 0 && m.arrMin <= 360);
  if (valid.length === 0) {
    return {
      status: "No threat in 6h",
      approaching: false,
      countdown_seconds: null,
      countdown_display: "No threat in 6h",
      window_display: "> 360 min",
      window_min: null,
      probability_pct: 0.0,
      threat_severity: "LOW",
      primary_hazard: "None (Outside Cone)",
    };
  }

  valid.sort((a, b) => a.arrMin - b.arrMin);
  const p10 = valid[Math.floor(0.1 * (valid.length - 1))].arrMin;
  const p90 = valid[Math.floor(0.9 * (valid.length - 1))].arrMin;
  const pMed = valid[Math.floor(0.5 * (valid.length - 1))].arrMin;

  const countWithin60 = memberArrivals.filter((m) => m.arrMin > 0 && m.arrMin <= 60).length;
  const probability_pct = Math.round((countWithin60 / 20) * 100);

  const cdSec = Math.max(60, Math.round(pMed * 60));
  const minPart = Math.floor(cdSec / 60);
  const secPart = cdSec % 60;
  const countdown_display = `${minPart}:${String(secPart).padStart(2, "0")}`;

  return {
    status: "Approaching",
    approaching: true,
    countdown_seconds: cdSec,
    countdown_display,
    window_display: `${Math.round(p10)}–${Math.round(p90)} min`,
    window_min: [Math.round(p10), Math.round(p90)] as [number, number],
    probability_pct,
    threat_severity: probability_pct >= 70 ? "EXTREME" : probability_pct >= 40 ? "SEVERE" : "MODERATE",
    primary_hazard: probability_pct >= 70 ? "Severe Hail + Downburst Wind" : "Rain Shower + Lightning",
  };
}

export function getCountdownsData(
  region: string = "kolkata",
  place?: string,
  step: number = globalSimState.stepIndex
) {
  const computedList = MONITORED_PLACES.filter((p) => p.place_code !== "VECC").map((p) => {
    const res = computeEnsembleCountdown(p.lat, p.lon, step);
    return {
      place_name: p.place_name,
      place_code: p.place_code,
      place_type: p.place_type,
      lat: p.lat,
      lon: p.lon,
      ...res,
    };
  });

  if (place) {
    return {
      region,
      provenance: "SIMULATED / REPLAY",
      countdowns: computedList.filter(
        (c) =>
          c.place_name.toLowerCase().includes(place.toLowerCase()) ||
          c.place_code.toLowerCase().includes(place.toLowerCase())
      ),
    };
  }

  return {
    region,
    provenance: "SIMULATED / REPLAY",
    countdowns: computedList,
  };
}

// ---------------------------------------------------------------------------
// 3. PHYSICALLY PLAUSIBLE STORM CELLS & TRACKS
// ---------------------------------------------------------------------------
export function getCellsData(region: string = "kolkata", step: number = globalSimState.stepIndex) {
  const T = step * 5;
  const rad = Math.PI / 180;
  const s0 = 0.767 * T;

  // Squall line front center
  const xc = -35.0 + s0 * Math.sin(115 * rad);
  const yc = 15.0 + s0 * Math.cos(115 * rad);

  // CELL_KOL_01: Main intense convective core (southern flank)
  const c1X = xc + 10.0 * Math.cos(115 * rad) - 2.0 * Math.sin(115 * rad);
  const c1Y = yc - 10.0 * Math.sin(115 * rad) - 2.0 * Math.cos(115 * rad);
  const c1Lat = Number((RADAR_SITE.lat + c1Y / 111.0).toFixed(4));
  const c1Lon = Number((RADAR_SITE.lon + c1X / 102.5).toFixed(4));
  const c1Dbz = Math.min(64.0, Math.max(52.0, 62.5 - Math.abs(T - 25) * 0.15));

  // 12-cycle sparkline for CELL_KOL_01
  const sparkline1 = [42, 45, 48, 52, 56, 59, 62, 63, 64, 63, 62, 61];

  // CELL_KOL_02: Northern flank core
  const c2X = xc - 45.0 * Math.cos(115 * rad) - 4.0 * Math.sin(115 * rad);
  const c2Y = yc + 45.0 * Math.sin(115 * rad) - 4.0 * Math.cos(115 * rad);
  const c2Lat = Number((RADAR_SITE.lat + c2Y / 111.0).toFixed(4));
  const c2Lon = Number((RADAR_SITE.lon + c2X / 102.5).toFixed(4));
  const c2Dbz = Math.max(42.0, 50.0 - T * 0.12);
  const sparkline2 = [56, 54, 53, 51, 49, 48, 47, 46, 45, 44, 43, 42];

  // CELL_KOL_03_CI: Convective Initiation cell (near 23.15, 88.35)
  const ciEmergence = T <= 15 ? 0 : Math.min(49.0, (T - 15) * 1.5);
  const c3X = (88.35 - RADAR_SITE.lon) * 102.5 + (T * 0.28);
  const c3Y = (23.15 - RADAR_SITE.lat) * 111.0 - (T * 0.08);
  const c3Lat = Number((RADAR_SITE.lat + c3Y / 111.0).toFixed(4));
  const c3Lon = Number((RADAR_SITE.lon + c3X / 102.5).toFixed(4));
  const sparkline3 = [0, 0, 0, 0, 8, 16, 24, 32, 38, 43, 47, 49];

  // Build forecast tracks with uncertainty ellipses
  const makeForecastTrack = (startLat: number, startLon: number, speed: number, dirDeg: number) => {
    return [15, 30, 45, 60].map((lead) => {
      const dist = (speed * lead) / 60;
      const dX = dist * Math.sin(dirDeg * rad);
      const dY = dist * Math.cos(dirDeg * rad);
      return {
        lead_minutes: lead,
        lat: Number((startLat + dY / 111.0).toFixed(4)),
        lon: Number((startLon + dX / 102.5).toFixed(4)),
        semi_major_km: Number((5.5 + lead * 0.22).toFixed(1)),
        semi_minor_km: Number((3.5 + lead * 0.14).toFixed(1)),
      };
    });
  };

  return {
    region,
    provenance: "SIMULATED / REPLAY",
    cells: [
      {
        cell_id: "CELL_KOL_01",
        lat: c1Lat,
        lon: c1Lon,
        area_km2: 285 + step * 8,
        max_dbz: Number(c1Dbz.toFixed(1)),
        motion: "ESE at 46 km/h",
        speed_kmh: 46.0,
        direction_deg: 115.0,
        direction_cardinal: "ESE",
        trend: T < 30 ? "INTENSIFYING" : ("STEADY" as const),
        severity: "EXTREME" as const,
        active_hazards: ["SEVERE_HAIL", "DOWNBURST_WIND", "LIGHTNING_SURGE"],
        reflectivity_sparkline: sparkline1,
        forecast_track: makeForecastTrack(c1Lat, c1Lon, 46.0, 115.0),
        polygon: [
          [c1Lat + 0.12, c1Lon - 0.08],
          [c1Lat + 0.06, c1Lon + 0.14],
          [c1Lat - 0.12, c1Lon + 0.09],
          [c1Lat - 0.08, c1Lon - 0.12],
          [c1Lat + 0.12, c1Lon - 0.08],
        ] as [number, number][],
      },
      {
        cell_id: "CELL_KOL_02",
        lat: c2Lat,
        lon: c2Lon,
        area_km2: 145,
        max_dbz: Number(c2Dbz.toFixed(1)),
        motion: "ESE at 44 km/h",
        speed_kmh: 44.0,
        direction_deg: 115.0,
        direction_cardinal: "ESE",
        trend: "WEAKENING" as const,
        severity: "SEVERE" as const,
        active_hazards: ["HEAVY_RAIN", "LIGHTNING_ACTIVITY"],
        reflectivity_sparkline: sparkline2,
        forecast_track: makeForecastTrack(c2Lat, c2Lon, 44.0, 115.0),
        polygon: [
          [c2Lat + 0.1, c2Lon - 0.06],
          [c2Lat + 0.05, c2Lon + 0.1],
          [c2Lat - 0.09, c2Lon + 0.06],
          [c2Lat - 0.06, c2Lon - 0.08],
          [c2Lat + 0.1, c2Lon - 0.06],
        ] as [number, number][],
      },
      {
        cell_id: "CELL_KOL_03_CI",
        lat: c3Lat,
        lon: c3Lon,
        area_km2: ciEmergence > 15 ? 75 : 30,
        max_dbz: Number(ciEmergence.toFixed(1)),
        motion: "ESE at 28 km/h",
        speed_kmh: 28.0,
        direction_deg: 110.0,
        direction_cardinal: "ESE",
        trend: "INTENSIFYING" as const,
        severity: ciEmergence >= 40 ? ("SEVERE" as const) : ("MODERATE" as const),
        active_hazards:
          ciEmergence === 0
            ? ["SATELLITE_CONVECTIVE_INITIATION", "RAPID_UPDRAFT_COOLING"]
            : ["CONVECTIVE_HAIL_GROWTH", "LIGHTNING_INITIATION"],
        reflectivity_sparkline: sparkline3,
        forecast_track: makeForecastTrack(c3Lat, c3Lon, 28.0, 110.0),
        polygon: [
          [c3Lat + 0.07, c3Lon - 0.05],
          [c3Lat + 0.04, c3Lon + 0.07],
          [c3Lat - 0.06, c3Lon + 0.05],
          [c3Lat - 0.04, c3Lon - 0.06],
          [c3Lat + 0.07, c3Lon - 0.05],
        ] as [number, number][],
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// 2. 1 KM CARTESIAN GRID GENERATOR (DOMAIN [85.9, 21.3] to [89.4, 24.0])
// ---------------------------------------------------------------------------
export function getFieldData(
  fieldType: string,
  lead: number = 0,
  region: string = "kolkata",
  downsample: number = 1,
  step: number = globalSimState.stepIndex
) {
  // Operational domain bounds
  const lat_min = 21.3;
  const lat_max = 24.0;
  const lon_min = 85.9;
  const lon_max = 89.4;

  const ny = Math.max(30, Math.floor(270 / downsample));
  const nx = Math.max(30, Math.floor(350 / downsample));

  const dlat = (lat_max - lat_min) / (ny - 1);
  const dlon = (lon_max - lon_min) / (nx - 1);

  // Time elapsed in minutes
  const T = step * 5 + lead;
  const rad = Math.PI / 180;
  const dir0 = 115.0;
  const sinDir = Math.sin(dir0 * rad);
  const cosDir = Math.cos(dir0 * rad);

  const s0 = 0.767 * T;
  const xc = -35.0 + s0 * sinDir;
  const yc = 15.0 + s0 * cosDir;

  // CI cell parameters
  const ciDbz = T <= 15 ? 0 : Math.min(52.0, (T - 15) * 1.5);
  const ciX = (88.35 - RADAR_SITE.lon) * 102.5 + T * 0.28;
  const ciY = (23.15 - RADAR_SITE.lat) * 111.0 - T * 0.08;

  const confidence =
    lead <= 60
      ? "High confidence (Radar extrapolation + AI)"
      : lead <= 120
      ? "Medium confidence (AI-NWP blend)"
      : "Area probability (NWP ensemble)";

  const data: number[][] = [];
  const mask: number[][] = [];

  for (let i = 0; i < ny; i++) {
    const lat = lat_max - i * dlat;
    const y = (lat - RADAR_SITE.lat) * 111.0;
    const row: number[] = [];
    const maskRow: number[] = [];

    for (let j = 0; j < nx; j++) {
      const lon = lon_min + j * dlon;
      const x = (lon - RADAR_SITE.lon) * 102.5;

      const rRadar = Math.hypot(x, y);
      const isInsideRadar = rRadar <= RADAR_SITE.range_km;
      maskRow.push(isInsideRadar ? 1.0 : 0.0);

      const dx = x - xc;
      const dy = y - yc;
      const dMotion = dx * sinDir + dy * cosDir;
      const dLine = dx * cosDir - dy * sinDir;
      const dFront = dMotion - 0.002 * dLine * dLine;

      let val = -32.0;

      if (fieldType === "reflectivity") {
        if (isInsideRadar) {
          let echo = 0;

          // Main squall line
          if (dLine >= -75 && dLine <= 85 && dFront >= -55 && dFront <= 6) {
            const forwardCutoff = dFront > 0 ? Math.exp(-Math.pow(dFront / 2.0, 2)) : 1.0;
            let baseZ = 28 + 5 * Math.exp(dFront / 18);
            if (dFront < -35) baseZ *= Math.exp((dFront + 35) / 10);

            // Core 1 (CELL_KOL_01): intense convective core with severe hail
            const core1 = 34 * Math.exp(-Math.pow((dFront + 2) / 6.0, 2) - Math.pow((dLine + 10) / 14, 2));
            // Core 2 (CELL_KOL_02): northern flank
            const core2 = 20 * Math.exp(-Math.pow((dFront + 3) / 6.5, 2) - Math.pow((dLine - 45) / 16, 2));

            echo = (baseZ + core1 + core2) * forwardCutoff;
          }

          // Pre-frontal popcorn convective cells ahead of line
          const p1 = 34 * Math.exp(-((x - 25) * (x - 25) + (y + 20) * (y + 20)) / 32);
          const p2 = 31 * Math.exp(-((x - 48) * (x - 48) + (y - 20) * (y - 20)) / 36);
          const p3 = 29 * Math.exp(-((x - 65) * (x - 65) + (y + 35) * (y + 35)) / 28);
          echo = Math.max(echo, p1, p2, p3);

          // CELL_KOL_03_CI emergence
          if (ciDbz > 0) {
            const ciDist2 = (x - ciX) * (x - ciX) + (y - ciY) * (y - ciY);
            const ciEcho = ciDbz * Math.exp(-ciDist2 / 32);
            echo = Math.max(echo, ciEcho);
          }

          if (echo >= 12.0) {
            const noise = getFractalNoise(x, y);
            val = Math.max(12.0, Math.min(65.0, echo + noise));
          }
        }
      } else if (fieldType === "rain_rate") {
        // Marshall-Palmer Z = 200 * R^1.6 => R = (10^(Z/10) / 200)^(1/1.6)
        if (isInsideRadar) {
          let refZ = 0;
          if (dLine >= -75 && dLine <= 85 && dFront >= -55 && dFront <= 6) {
            const forwardCutoff = dFront > 0 ? Math.exp(-Math.pow(dFront / 2.0, 2)) : 1.0;
            const core1 = 34 * Math.exp(-Math.pow((dFront + 2) / 6.0, 2) - Math.pow((dLine + 10) / 14, 2));
            const baseZ = 28 + 5 * Math.exp(dFront / 18);
            refZ = (baseZ + core1) * forwardCutoff;
          }
          if (refZ >= 20.0) {
            const rr = Math.pow(Math.pow(10, refZ / 10) / 200, 1 / 1.6);
            val = Math.min(135.0, rr * (1 + 0.15 * Math.sin(x * 0.1 + y * 0.1)));
          } else {
            val = 0.0;
          }
        } else {
          val = 0.0;
        }
      } else if (fieldType === "ir_temperature") {
        // INSAT-3DS Cold cloud tops (< 220 K in convective overshoot)
        let coldAnomaly = 0;
        if (dLine >= -80 && dLine <= 90 && dFront >= -60 && dFront <= 10) {
          coldAnomaly = 75 * Math.exp(-Math.pow(dFront / 18, 2) - Math.pow(dLine / 55, 2));
        }
        // CI cold anomaly visible even before radar echo
        const ciDist2 = (x - ciX) * (x - ciX) + (y - ciY) * (y - ciY);
        const ciCold = 72 * Math.exp(-ciDist2 / 50);
        coldAnomaly = Math.max(coldAnomaly, ciCold);

        val = 292.0 - coldAnomaly + getFractalNoise(x * 0.5, y * 0.5) * 1.5;
      } else if (fieldType === "lightning_density") {
        let flashRate = 0;
        if (dLine >= -75 && dLine <= 85 && dFront >= -30 && dFront <= 4) {
          flashRate = 35 * Math.exp(-Math.pow((dFront + 2) / 7.0, 2) - Math.pow((dLine + 10) / 20, 2));
        }
        val = Math.max(0.0, flashRate * (1 + 0.25 * getFractalNoise(x, y)));
      } else if (fieldType === "hail_prob") {
        let poh = 0;
        if (dLine >= -75 && dLine <= 85 && dFront >= -25 && dFront <= 4) {
          poh = 95 * Math.exp(-Math.pow((dFront + 2) / 6.0, 2) - Math.pow((dLine + 10) / 16, 2));
        }
        val = Math.min(100.0, Math.max(0.0, poh));
      } else if (fieldType === "downburst_prob") {
        let gust = 0;
        if (dLine >= -75 && dLine <= 85 && dFront >= -15 && dFront <= 5) {
          gust = 28.5 * Math.exp(-Math.pow((dFront - 1) / 5.0, 2) - Math.pow((dLine + 10) / 18, 2));
        }
        val = Math.max(0.0, gust);
      } else if (fieldType === "convective_initiation") {
        // Satellite Cooling Index (K / 15 min)
        const ciDist2 = (x - ciX) * (x - ciX) + (y - ciY) * (y - ciY);
        val = -8.5 * Math.exp(-ciDist2 / 45);
      }

      row.push(parseFloat(val.toFixed(2)));
    }
    data.push(row);
    mask.push(maskRow);
  }

  const flat = data.flat();
  return {
    field_type: fieldType,
    lead_minutes: lead,
    provenance: "SIMULATED / REPLAY",
    confidence,
    timestamp: getSimulatedTimestamp(step),
    unit:
      fieldType === "reflectivity"
        ? "dBZ"
        : fieldType === "rain_rate"
        ? "mm/h"
        : fieldType === "ir_temperature"
        ? "K"
        : fieldType === "downburst_prob"
        ? "m/s"
        : fieldType === "lightning_density"
        ? "flashes/km²/h"
        : fieldType === "convective_initiation"
        ? "K/15m"
        : "%",
    min_value: Math.min(...flat),
    max_value: Math.max(...flat),
    bounds: {
      lat_min,
      lat_max,
      lon_min,
      lon_max,
      ny,
      nx,
    },
    data,
    radar_coverage_mask: mask,
    label: "Guidance for IMD forecasters — not a public warning",
  };
}

// ---------------------------------------------------------------------------
// 6. LIGHTNING FLASHES GENERATOR (Where Z > 45 dBZ)
// ---------------------------------------------------------------------------
export function getLightningFlashes(step: number = globalSimState.stepIndex) {
  const T = step * 5;
  const rad = Math.PI / 180;
  const s0 = 0.767 * T;
  const xc = -35.0 + s0 * Math.sin(115 * rad);
  const yc = 15.0 + s0 * Math.cos(115 * rad);

  const rng = mulberry32(0x1337 + step);
  const flashes = [];

  // Generate 18 realistic strokes centered on the severe convective cores
  for (let i = 0; i < 18; i++) {
    const ageMin = rng() * 15.0; // Fades over 15 min
    const dLine = (rng() - 0.5) * 45.0 - 5.0;
    const dFront = (rng() - 0.5) * 12.0 - 2.0;

    const x = xc + dLine * Math.cos(115 * rad) + dFront * Math.sin(115 * rad);
    const y = yc - dLine * Math.sin(115 * rad) + dFront * Math.cos(115 * rad);

    const lat = Number((RADAR_SITE.lat + y / 111.0).toFixed(4));
    const lon = Number((RADAR_SITE.lon + x / 102.5).toFixed(4));

    flashes.push({
      id: `FL_${step}_${i}`,
      lat,
      lon,
      age_min: Number(ageMin.toFixed(1)),
      opacity: Number(Math.max(0.15, 1.0 - ageMin / 15.0).toFixed(2)),
      peak_ka: Number((15 + rng() * 65).toFixed(1)),
      flash_type: rng() > 0.35 ? ("CG" as const) : ("IC" as const),
    });
  }

  return flashes;
}

export function getHazardsData(region: string = "kolkata") {
  return {
    region,
    provenance: "SIMULATED / REPLAY",
    hazards: {
      hail: {
        detected: true,
        poh_pct: 88.0,
        mesh_mm: 32.5,
        severity: "SEVERE",
        freezing_level_km: 4.6,
        echo_top_45dbz_km: 9.4,
      },
      downburst: {
        detected: true,
        delta_v_ms: 28.5,
        speed_kmh: 102.6,
        severity: "WARNING",
        separation_km: 5.8,
      },
      cloudburst: {
        detected: true,
        max_rain_rate_mmh: 124.0,
        cluster_area_km2: 24.2,
        meets_imd_criteria: true,
        severity: "DANGER",
      },
      lightning_jump: {
        detected: true,
        surge_rate_per_min: 19.0,
        historical_sigma: 2.7,
        severity: "URGENT",
      },
    },
    downburst_events: [
      {
        event_id: "DB_KOL_01",
        outflow_speed_ms: 28.5,
        outflow_speed_kmh: 102.6,
        divergence_ms: 28.5,
        lead_time_min: 24,
      },
    ],
    hail_max_prob: 0.88,
    convective_initiation_candidates: [
      {
        ci_id: "CI_KOL_NORTH_01",
        cooling_rate_k_15min: -8.5,
        estimated_time_to_echo_min: 15,
      },
    ],
  };
}

export function getVerificationData(region: string = "kolkata") {
  return {
    status: "COMPUTED",
    sample_event: `${region}_norwester_convective_sequence`,
    provenance: "REPLAY / SIMULATED",
    label: "Guidance for IMD forecasters — not a public warning",
    lead_time_gain_summary: "VAJRA achieves an average +18 min lead-time gain over optical-flow baseline",
    skill_curve: [
      { lead_minutes: 15, csi: 0.78, pod: 0.88, far: 0.12, fss_by_scale: [{ scale_km: 1, fss: 0.82 }], brier_score: 0.11, vajra_csi: 0.78, pysteps_baseline_csi: 0.74, lead_time_gain_minutes: 6, eta_timing_error_minutes: 2.1 },
      { lead_minutes: 30, csi: 0.65, pod: 0.79, far: 0.19, fss_by_scale: [{ scale_km: 1, fss: 0.71 }], brier_score: 0.16, vajra_csi: 0.65, pysteps_baseline_csi: 0.58, lead_time_gain_minutes: 14, eta_timing_error_minutes: 3.4 },
      { lead_minutes: 45, csi: 0.54, pod: 0.71, far: 0.26, fss_by_scale: [{ scale_km: 1, fss: 0.61 }], brier_score: 0.21, vajra_csi: 0.54, pysteps_baseline_csi: 0.44, lead_time_gain_minutes: 19, eta_timing_error_minutes: 4.8 },
      { lead_minutes: 60, csi: 0.46, pod: 0.64, far: 0.32, fss_by_scale: [{ scale_km: 1, fss: 0.52 }], brier_score: 0.25, vajra_csi: 0.46, pysteps_baseline_csi: 0.35, lead_time_gain_minutes: 22, eta_timing_error_minutes: 5.9 },
      { lead_minutes: 90, csi: 0.35, pod: 0.53, far: 0.41, fss_by_scale: [{ scale_km: 1, fss: 0.42 }], brier_score: 0.31, vajra_csi: 0.35, pysteps_baseline_csi: 0.22, lead_time_gain_minutes: 24, eta_timing_error_minutes: 8.2 },
      { lead_minutes: 120, csi: 0.28, pod: 0.46, far: 0.49, fss_by_scale: [{ scale_km: 1, fss: 0.36 }], brier_score: 0.36, vajra_csi: 0.28, pysteps_baseline_csi: 0.15, lead_time_gain_minutes: 25, eta_timing_error_minutes: 11.0 },
      { lead_minutes: 180, csi: 0.21, pod: 0.38, far: 0.57, fss_by_scale: [{ scale_km: 1, fss: 0.29 }], brier_score: 0.41, vajra_csi: 0.21, pysteps_baseline_csi: 0.08, lead_time_gain_minutes: 26, eta_timing_error_minutes: 15.5 },
      { lead_minutes: 240, csi: 0.18, pod: 0.33, far: 0.62, fss_by_scale: [{ scale_km: 1, fss: 0.26 }], brier_score: 0.44, vajra_csi: 0.18, pysteps_baseline_csi: 0.04, lead_time_gain_minutes: 26, eta_timing_error_minutes: 20.0 },
      { lead_minutes: 360, csi: 0.15, pod: 0.29, far: 0.67, fss_by_scale: [{ scale_km: 1, fss: 0.22 }], brier_score: 0.48, vajra_csi: 0.15, pysteps_baseline_csi: 0.01, lead_time_gain_minutes: 26, eta_timing_error_minutes: 28.0 },
    ],
  };
}

export const activeAlertsStore = [
  {
    alert_id: "VAJRA-ALERT-KOL-20260515-001",
    event: "Severe Thunderstorm, Hail & Downburst Wind",
    headline: "Severe Thunderstorm with Hail & Downburst winds approaching Kolkata / Howrah",
    severity: "Severe",
    urgency: "Expected",
    probability: 0.85,
    onset: "2026-05-15T15:45:00Z",
    polygon: [
      [22.95, 88.15],
      [22.80, 88.55],
      [22.45, 88.40],
      [22.60, 88.00],
      [22.95, 88.15],
    ] as [number, number][],
    approval_status: "PENDING_IMD_APPROVAL" as "PENDING_IMD_APPROVAL" | "APPROVED" | "REJECTED",
    approved_by: null as string | null,
    approved_at: null as string | null,
    cap_xml: `<?xml version="1.0" encoding="UTF-8"?>
<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
  <identifier>VAJRA-ALERT-KOL-20260515-001</identifier>
  <sender>imd-nowcasting@vajra.imd.gov.in</sender>
  <sent>2026-05-15T15:35:00Z</sent>
  <status>Actual</status>
  <msgType>Alert</msgType>
  <scope>Public</scope>
  <info>
    <category>Met</category>
    <event>Severe Thunderstorm, Hail &amp; Downburst Wind</event>
    <urgency>Expected</urgency>
    <severity>Severe</severity>
    <certainty>Likely</certainty>
    <eventCode><valueName>IMD_CODE</valueName><value>THUNDERSTORM_SQUALL</value></eventCode>
    <headline>Severe Thunderstorm with Hail &amp; Downburst winds approaching Kolkata / Howrah</headline>
    <description>Doppler radar and INSAT-3DS multi-source fusion detected severe cell CELL_KOL_01 with 63.5 dBZ core, MESH 32.5 mm hail, and 28.5 m/s divergence dipole.</description>
    <area>
      <areaDesc>Kolkata Urban, Howrah, Hooghly, North 24 Parganas</areaDesc>
      <polygon>22.95,88.15 22.80,88.55 22.45,88.40 22.60,88.00 22.95,88.15</polygon>
    </area>
  </info>
</alert>`,
    sms: {
      en: "IMD-VAJRA ALERT: Severe thunderstorm approaching Kolkata/Howrah with hail and winds exceeding 70 km/h in 35-55 mins. Take shelter immediately.",
      hi: "आईएमडी-वज्र चेतावनी: अगले 35-55 मिनट में कोलकाता/हावड़ा में ओलावृष्टि और 70 किमी/घंटा से अधिक हवाओं के साथ भयंकर आंधी की संभावना। तत्काल सुरक्षित स्थान पर रहें।",
      bn: "আইএমডি-বজ্র সতর্কতা: আগামী ৩৫-৫৫ মিনিটের মধ্যে কলকাতা ও হাওড়ায় শিলাবৃষ্টি ও ৭০ কিমি/ঘণ্টার বেশি বেগে কালবৈশাখী ঝড়ের আশঙ্কা। অবিলম্বে নিরাপদ স্থানে আশ্রয় নিন।",
      kn: "ಐಎಂಡಿ-ವಜ್ರ ಎಚ್ಚರಿಕೆ: ಮುಂದಿನ 35-55 ನಿಮಿಷಗಳಲ್ಲಿ ಕೋಲ್ಕತ್ತಾ/ಹೌರಾದಲ್ಲಿ ಆಲಿಕಲ್ಲು ಮಳೆ ಮತ್ತು 70 ಕಿ.ಮೀ/ಗಂಟೆ ವೇಗದ ಬಿರುಗಾಳಿ ಸಹಿತ ತೀವ್ರ ಗುಡುಗು-ಮಿಂಚಿನ ಸಾಧ್ಯತೆ. ತಕ್ಷಣ ಸುರಕ್ಷಿತ ಸ್ಥಳಕ್ಕೆ ತೆರಳಿ.",
    },
    ivr: {
      en: "This is an urgent weather bulletin from the India Meteorological Department. A severe thunderstorm with hail is approaching your area within 45 minutes.",
      hi: "यह भारत मौसम विज्ञान विभाग से एक आवश्यक मौसम बुलेटिन है। अगले 45 मिनट में आपके क्षेत्र में ओलावृष्टि और तेज हवाओं के साथ भयंकर आंधी की संभावना है।",
      bn: "এটি ভারতীয় আবহাওয়া অধিদপ্তর থেকে একটি জরুরী আবহাওয়া বার্তা। আগামী ৪৫ মিনিটের মধ্যে আপনার এলাকায় তীব্র কালবৈশাখী ঝড় ও শিলাবৃষ্টির সম্ভাবনা রয়েছে।",
      kn: "ಇದು ಭಾರತೀಯ ಹವಾಮಾನ ಇಲಾಖೆಯಿಂದ ತುರ್ತು ಹವಾಮಾನ ಮುನ್ಸೂಚನೆ. ಮುಂದಿನ 45 ನಿಮಿಷಗಳಲ್ಲಿ ನಿಮ್ಮ ಪ್ರದೇಶದಲ್ಲಿ ತೀವ್ರ ಆಲಿಕಲ್ಲು ಸಹಿತ ಬಿರುಗಾಳಿ ಬೀಸುವ ಸಾಧ್ಯತೆಯಿದೆ.",
    },
  },
];
