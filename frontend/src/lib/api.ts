/**
 * VAJRA API Client
 * Interacts with FastAPI backend (/api/v1).
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

async function safeFetch(path: string, init?: RequestInit): Promise<any> {
  const target = API_BASE ? `${API_BASE}${path}` : path;
  try {
    const res = await fetch(target, init);
    if (res.ok) return await res.json();
    throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    if (API_BASE && typeof window !== "undefined") {
      try {
        const fallbackRes = await fetch(path, init);
        if (fallbackRes.ok) return await fallbackRes.json();
      } catch (_) {}
    }
    throw err;
  }
}

export interface SourceInfo {
  id: string;
  name: string;
  type: string;
  latency_seconds: number;
  coverage_pct: number;
  status: string;
}

export interface StageTiming {
  stage_name: string;
  duration_ms: number;
  status: string;
}

export interface CycleLatestResponse {
  region_id: string;
  region_name: string;
  timestamp: string;
  step_index: number;
  provenance: string;
  label: string;
  target_latency_seconds: number;
  meets_target_latency: boolean;
  stages: StageTiming[];
  active_cells_count: number;
  active_alerts_count: number;
  ci_candidates_count: number;
  downburst_count: number;
}

export interface FieldLayerData {
  field_type: string;
  lead_minutes: number;
  provenance: string;
  confidence: string;
  timestamp: string;
  unit: string;
  min_value: number;
  max_value: number;
  bounds: {
    lat_min: number;
    lat_max: number;
    lon_min: number;
    lon_max: number;
    ny: number;
    nx: number;
  };
  data: number[][];
  radar_coverage_mask: number[][];
  label: string;
}

export interface StormCellData {
  cell_id: string;
  lat: number;
  lon: number;
  area_km2: number;
  max_dbz: number;
  motion: string;
  speed_kmh: number;
  direction_deg: number;
  direction_cardinal: string;
  trend: "INTENSIFYING" | "STEADY" | "WEAKENING";
  severity: "MODERATE" | "SEVERE" | "EXTREME";
  active_hazards: string[];
  reflectivity_sparkline: number[];
  forecast_track: {
    lead_minutes: number;
    lat: number;
    lon: number;
    semi_major_km: number;
    semi_minor_km: number;
  }[];
  polygon: [number, number][];
}

export interface PlaceCountdownData {
  place_name: string;
  place_code: string;
  place_type: string;
  lat: number;
  lon: number;
  approaching: boolean;
  countdown_seconds: number | null;
  countdown_display: string;
  window_display: string;
  window_min: [number, number] | null;
  probability_pct: number;
  threat_severity: string;
  primary_hazard: string;
}

export interface AlertData {
  alert_id: string;
  event: string;
  headline: string;
  severity: string;
  urgency: string;
  probability: number;
  onset: string;
  polygon: [number, number][];
  approval_status: "PENDING_IMD_APPROVAL" | "APPROVED" | "REJECTED";
  approved_by: string | null;
  approved_at: string | null;
  cap_xml: string;
  sms: Record<string, string>;
  ivr: Record<string, string>;
}

export interface VerificationLeadSkill {
  lead_minutes: number;
  csi: number;
  pod: number;
  far: number;
  fss_by_scale: { scale_km: number; fss: number }[];
  brier_score: number;
  vajra_csi: number;
  pysteps_baseline_csi: number;
  lead_time_gain_minutes: number;
  eta_timing_error_minutes: number;
}

export async function fetchHealth() {
  return safeFetch("/api/v1/health");
}

export async function fetchSources(region: string = "kolkata"): Promise<{ sources: SourceInfo[]; provenance: string }> {
  return safeFetch(`/api/v1/sources?region=${region}`);
}

export async function fetchLatestCycle(region: string = "kolkata"): Promise<CycleLatestResponse> {
  return safeFetch(`/api/v1/cycle/latest?region=${region}`);
}

export async function fetchField(
  fieldType: string,
  lead: number = 0,
  region: string = "kolkata",
  downsample: number = 1
): Promise<FieldLayerData> {
  return safeFetch(`/api/v1/fields/${fieldType}?lead=${lead}&region=${region}&downsample=${downsample}`);
}

export async function fetchCells(region: string = "kolkata"): Promise<{ cells: StormCellData[]; provenance: string }> {
  return safeFetch(`/api/v1/cells?region=${region}`);
}

export async function fetchCountdowns(
  region: string = "kolkata",
  place?: string
): Promise<{ countdowns: PlaceCountdownData[]; provenance: string }> {
  const url = place
    ? `/api/v1/countdowns?region=${region}&place=${encodeURIComponent(place)}`
    : `/api/v1/countdowns?region=${region}`;
  return safeFetch(url);
}

export async function fetchHazards(region: string = "kolkata") {
  return safeFetch(`/api/v1/hazards?region=${region}`);
}

export async function fetchConfidenceTable(region: string = "kolkata") {
  return safeFetch(`/api/v1/confidence-table?region=${region}`);
}

export async function fetchAlerts(region: string = "kolkata"): Promise<{ alerts: AlertData[] }> {
  return safeFetch(`/api/v1/alerts?region=${region}`);
}

export async function approveAlert(alertId: string, region: string = "kolkata") {
  return safeFetch(`/api/v1/alerts/${alertId}/approve?region=${region}`, {
    method: "POST",
  });
}

export async function rejectAlert(alertId: string, reason?: string, region: string = "kolkata") {
  return safeFetch(
    `/api/v1/alerts/${alertId}/reject?region=${region}&reason=${encodeURIComponent(reason || "")}`,
    { method: "POST" }
  );
}

export async function fetchVerification(region: string = "kolkata"): Promise<{
  skill_curve: VerificationLeadSkill[];
  lead_time_gain_summary: string;
  provenance: string;
}> {
  return safeFetch(`/api/v1/verification?region=${region}`);
}

export async function stepReplay(region: string = "kolkata") {
  return safeFetch(`/api/v1/replay/step?region=${region}`, { method: "POST" });
}

export async function setReplaySpeed(speed: number) {
  return safeFetch(`/api/v1/replay/speed?speed=${speed}`, { method: "POST" });
}

export async function pauseReplay() {
  return safeFetch("/api/v1/replay/pause", { method: "POST" });
}

export async function startReplay() {
  return safeFetch("/api/v1/replay/start", { method: "POST" });
}
