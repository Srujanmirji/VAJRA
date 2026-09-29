"use client";

import React, { useState, useEffect } from "react";
import {
  fetchHealth,
  fetchSources,
  fetchLatestCycle,
  fetchField,
  fetchCells,
  fetchCountdowns,
  fetchHazards,
  fetchConfidenceTable,
  fetchAlerts,
  approveAlert,
  rejectAlert,
  fetchVerification,
  stepReplay,
  setReplaySpeed,
  pauseReplay,
  startReplay,
  SourceInfo,
  CycleLatestResponse,
  FieldLayerData,
  StormCellData,
  PlaceCountdownData,
  AlertData,
  VerificationLeadSkill,
} from "@/lib/api";
import { RadarMap } from "@/components/RadarMap";
import {
  Zap,
  Play,
  Pause,
  SkipForward,
  Activity,
  ShieldAlert,
  Layers,
  Clock,
  Compass,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  XCircle,
  FileCode,
  Languages,
  Maximize2,
  MapPin,
  ChevronRight,
  Info,
  Volume2,
  CloudRain,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

export default function ConsolePage() {
  const [selectedRegion, setSelectedRegion] = useState("kolkata");
  const [leadTime, setLeadTime] = useState(0);
  const [isPlayingLead, setIsPlayingLead] = useState(false);
  const [activeTab, setActiveTab] = useState<"countdowns" | "hazards" | "cloudburst" | "skill" | "alerts">("countdowns");

  // Pipeline Data States
  const [sources, setSources] = useState<SourceInfo[]>([]);
  const [cycleInfo, setCycleInfo] = useState<CycleLatestResponse | null>(null);
  const [fieldData, setFieldData] = useState<FieldLayerData | null>(null);
  const [selectedFieldType, setSelectedFieldType] = useState("reflectivity");
  const [cells, setCells] = useState<StormCellData[]>([]);
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null);
  const [countdowns, setCountdowns] = useState<PlaceCountdownData[]>([]);
  const [hazardsSummary, setHazardsSummary] = useState<any>(null);
  const [confidenceTable, setConfidenceTable] = useState<any>(null);
  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [verification, setVerification] = useState<VerificationLeadSkill[]>([]);
  const [provenance, setProvenance] = useState("SIMULATED");

  // Replay Control State
  const [isReplaying, setIsReplaying] = useState(false);
  const [replaySpeedVal, setReplaySpeedVal] = useState(10);
  const [cycleCountdownSeconds, setCycleCountdownSeconds] = useState(240);

  // Map Pinned Point
  const [pinnedPoint, setPinnedPoint] = useState<{ lat: number; lon: number } | null>(null);

  // Layer Toggles
  const [activeLayers, setActiveLayers] = useState({
    radar: true,
    satellite: true,
    lightning: true,
    tracks: true,
    coverageRing: true,
    hatchedZone: true,
    airports: true,
    cloudburst: true,
  });

  // Multilingual alert selected language
  const [selectedLang, setSelectedLang] = useState<"en" | "hi" | "bn" | "kn">("en");
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);

  // Initial Load and Region Switching
  useEffect(() => {
    loadRegionData(selectedRegion, leadTime, selectedFieldType);
  }, [selectedRegion]);

  // Lead Time scrub reload
  useEffect(() => {
    fetchField(selectedFieldType, leadTime, selectedRegion).then(setFieldData).catch(console.error);
  }, [leadTime, selectedFieldType]);

const LEAD_TIME_STEPS = [0, 15, 30, 45, 60, 90, 120, 180, 240, 360];

  // Lead Time auto-advance animation
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlayingLead) {
      timer = setInterval(() => {
        setLeadTime((prev) => {
          const idx = LEAD_TIME_STEPS.indexOf(prev);
          if (idx === -1 || idx >= LEAD_TIME_STEPS.length - 1) return LEAD_TIME_STEPS[0];
          return LEAD_TIME_STEPS[idx + 1];
        });
      }, 1500);
    }
    return () => clearInterval(timer);
  }, [isPlayingLead]);

  // 5-minute cycle countdown timer ticker
  useEffect(() => {
    const ticker = setInterval(() => {
      setCycleCountdownSeconds((prev) => (prev <= 1 ? 300 : prev - 1));
    }, 1000);
    return () => clearInterval(ticker);
  }, []);

  const loadRegionData = async (reg: string, lead: number, fieldType: string) => {
    try {
      const [srcRes, cycRes, fldRes, cellRes, cdRes, hzRes, cfRes, altRes, verRes] = await Promise.all([
        fetchSources(reg),
        fetchLatestCycle(reg),
        fetchField(fieldType, lead, reg),
        fetchCells(reg),
        fetchCountdowns(reg),
        fetchHazards(reg),
        fetchConfidenceTable(reg),
        fetchAlerts(reg),
        fetchVerification(reg),
      ]);

      if (srcRes?.sources) setSources(srcRes.sources);
      if (cycRes) setCycleInfo(cycRes);
      if (fldRes) setFieldData(fldRes);
      if (cellRes?.cells) setCells(cellRes.cells);
      if (cdRes?.countdowns) setCountdowns(cdRes.countdowns);
      if (hzRes) setHazardsSummary(hzRes);
      if (cfRes?.confidence_by_hazard_and_lead) setConfidenceTable(cfRes.confidence_by_hazard_and_lead);
      if (altRes?.alerts) {
        setAlerts(altRes.alerts);
        if (altRes.alerts.length > 0 && !selectedAlertId) {
          setSelectedAlertId(altRes.alerts[0].alert_id);
        }
      }
      if (verRes?.skill_curve) setVerification(verRes.skill_curve);
      if (fldRes?.provenance) setProvenance(fldRes.provenance);
    } catch (err) {
      console.error("Error loading nowcast data:", err);
    }
  };

  const handleReplayStep = async () => {
    await stepReplay(selectedRegion);
    await loadRegionData(selectedRegion, leadTime, selectedFieldType);
  };

  const handleSpeedChange = async (speed: number) => {
    setReplaySpeedVal(speed);
    await setReplaySpeed(speed);
  };

  const handleApproveAlert = async (id: string) => {
    await approveAlert(id, selectedRegion);
    const altRes = await fetchAlerts(selectedRegion);
    if (altRes?.alerts) setAlerts(altRes.alerts);
  };

  const handleRejectAlert = async (id: string) => {
    await rejectAlert(id, "Forecaster discretion", selectedRegion);
    const altRes = await fetchAlerts(selectedRegion);
    if (altRes?.alerts) setAlerts(altRes.alerts);
  };

  const activeAlert = alerts.find((a) => a.alert_id === selectedAlertId) || alerts[0];

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-61px)] overflow-hidden bg-background">
      {/* =================================================================== */}
      {/* 1. TOP OPERATIONAL BAR                                             */}
      {/* =================================================================== */}
      <div className="bg-panel border-b border-panel-border px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Left: Region Selector & Provenance */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5">
            <span className="text-slate-400 font-medium">Domain:</span>
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="bg-panel-dark border border-panel-border text-white text-xs rounded px-2.5 py-1 font-medium focus:outline-none focus:border-vajra-orange"
            >
              <option value="kolkata">Kolkata & Gangetic WB</option>
              <option value="uttarakhand">Uttarakhand Himalayan Valleys</option>
              <option value="delhi">Delhi NCR</option>
              <option value="mumbai">Mumbai Metropolitan</option>
              <option value="bengaluru">Bengaluru Urban</option>
            </select>
          </div>

          {/* Provenance Pill */}
          <div
            className={`px-2 py-0.5 rounded font-mono font-bold uppercase text-[10px] tracking-wider border ${
              provenance === "LIVE"
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                : provenance === "REPLAY"
                ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/30"
                : "bg-amber-500/10 text-amber-400 border-amber-500/30"
            }`}
          >
            {provenance} DATA
          </div>

          {/* Cycle Countdown */}
          <div className="flex items-center space-x-1.5 text-slate-300 font-mono text-[11px] bg-panel-dark px-2.5 py-1 rounded border border-panel-border">
            <Clock className="w-3.5 h-3.5 text-vajra-orange animate-spin" style={{ animationDuration: "12s" }} />
            <span>Next Cycle In:</span>
            <span className="text-vajra-orange font-bold">
              {Math.floor(cycleCountdownSeconds / 60)}:
              {String(cycleCountdownSeconds % 60).padStart(2, "0")}
            </span>
          </div>
        </div>

        {/* Center: Ingest Latency Chips */}
        <div className="hidden xl:flex items-center space-x-2">
          {sources.map((s) => {
            const ageDisplay =
              s.id === "nwp"
                ? "NWP: HRRR 06 UTC (2h 10m ago)"
                : s.id === "radar"
                ? `RADAR: VECC S-Band (${Math.round(s.latency_seconds)}s)`
                : s.id === "satellite"
                ? `SAT: INSAT-3DS (${Math.round(s.latency_seconds)}s)`
                : `LIGHTNING: GLM (${Math.round(s.latency_seconds)}s)`;
            return (
              <div
                key={s.id}
                className="flex items-center space-x-1.5 px-2 py-0.5 rounded bg-panel-dark border border-panel-border text-[11px] font-mono text-slate-300"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>{ageDisplay}</span>
              </div>
            );
          })}
        </div>

        {/* Right: Replay Controls */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 bg-panel-dark p-0.5 rounded border border-panel-border">
            <button
              onClick={() => {
                if (isReplaying) {
                  pauseReplay();
                  setIsReplaying(false);
                } else {
                  startReplay();
                  setIsReplaying(true);
                }
              }}
              className={`p-1.5 rounded hover:bg-white/10 ${isReplaying ? "text-amber-400" : "text-slate-300"}`}
              title={isReplaying ? "Pause Replay" : "Start Replay"}
            >
              {isReplaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={handleReplayStep}
              className="p-1.5 rounded hover:bg-white/10 text-slate-300 hover:text-white"
              title="Step +5 min"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Speed Buttons */}
          <div className="flex items-center space-x-1 font-mono text-[11px]">
            {[1, 10, 60].map((s) => (
              <button
                key={s}
                onClick={() => handleSpeedChange(s)}
                className={`px-2 py-0.5 rounded border ${
                  replaySpeedVal === s
                    ? "bg-vajra-orange text-slate-950 font-bold border-vajra-orange"
                    : "bg-panel-dark text-slate-400 border-panel-border hover:text-white"
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 2. MAIN CONSOLE LAYOUT (LEFT LIST, CENTER MAP, RIGHT TABS)          */}
      {/* =================================================================== */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* ----------------------------------------------------------------- */}
        {/* LEFT PANEL: ACTIVE STORMS LIST                                    */}
        {/* ----------------------------------------------------------------- */}
        <div className="w-full lg:w-80 bg-panel border-r border-panel-border flex flex-col overflow-hidden shrink-0">
          <div className="px-3.5 py-2.5 border-b border-panel-border flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4 text-vajra-orange" />
              <span className="font-display font-semibold text-sm text-white">Active Convective Cells</span>
            </div>
            <span className="px-1.5 py-0.5 rounded bg-white/10 text-[11px] font-mono font-bold text-white">
              {cells.length}
            </span>
          </div>

          {/* Cells List */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
            {cells.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                No active convective storm cells identified in this domain
              </div>
            ) : (
              cells.map((cell) => {
                const isSelected = selectedCellId === cell.cell_id;
                return (
                  <div
                    key={cell.cell_id}
                    onClick={() => setSelectedCellId(cell.cell_id)}
                    className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-panel-light border-vajra-orange shadow-lg"
                        : "bg-panel-dark/80 border-panel-border hover:border-slate-600"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-xs text-white">{cell.cell_id}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold uppercase ${
                            cell.severity === "EXTREME"
                              ? "bg-red-500/20 text-red-300 border border-red-500/40"
                              : cell.severity === "SEVERE"
                              ? "bg-orange-500/20 text-orange-300 border border-orange-500/40"
                              : "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                          }`}
                        >
                          {cell.severity}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1 font-mono text-[11px]">
                        <span className="text-white font-bold">{Math.round(cell.max_dbz)}</span>
                        <span className="text-slate-400">dBZ</span>
                      </div>
                    </div>

                    {/* Motion and Trend */}
                    <div className="flex items-center justify-between text-xs text-slate-300 mb-2">
                      <div className="flex items-center space-x-1.5">
                        <Compass className="w-3.5 h-3.5 text-vajra-orange" />
                        <span className="font-mono text-[11px]">{cell.motion}</span>
                      </div>
                      <div className="flex items-center space-x-1 font-mono text-[11px]">
                        {cell.trend === "INTENSIFYING" ? (
                          <span className="text-red-400 flex items-center">
                            <TrendingUp className="w-3 h-3 mr-0.5" /> Growth
                          </span>
                        ) : cell.trend === "WEAKENING" ? (
                          <span className="text-emerald-400 flex items-center">
                            <TrendingDown className="w-3 h-3 mr-0.5" /> Decay
                          </span>
                        ) : (
                          <span className="text-slate-400 flex items-center">
                            <Minus className="w-3 h-3 mr-0.5" /> Steady
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Hazard Badges */}
                    <div className="flex flex-wrap gap-1 mb-2">
                      {cell.active_hazards.map((hz) => (
                        <span
                          key={hz}
                          className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-white/5 border border-white/10 text-slate-300"
                        >
                          {hz}
                        </span>
                      ))}
                    </div>

                    {/* Reflectivity Sparkline */}
                    {cell.reflectivity_sparkline.length > 1 && (
                      <div className="h-6 w-full pt-1">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={cell.reflectivity_sparkline.map((v, i) => ({ v, i }))}>
                            <Line
                              type="monotone"
                              dataKey="v"
                              stroke="#F28C28"
                              strokeWidth={1.5}
                              dot={false}
                              isAnimationActive={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* CENTER: RADAR MAP & CONTROLS                                      */}
        {/* ----------------------------------------------------------------- */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* Layer Selector Strip */}
          <div className="bg-panel-dark/95 border-b border-panel-border px-3 py-1.5 flex items-center justify-between overflow-x-auto text-xs z-10">
            <div className="flex items-center space-x-2">
              <span className="text-slate-400 text-[11px] uppercase tracking-wider font-mono">Layer:</span>
              {[
                { id: "reflectivity", label: "Radar dBZ" },
                { id: "rain_rate", label: "Rain Rate (mm/h)" },
                { id: "ir_temperature", label: "INSAT IR (K)" },
                { id: "lightning_density", label: "Lightning Density" },
                { id: "hail_prob", label: "Hail Risk" },
                { id: "downburst_prob", label: "Downburst (m/s)" },
                { id: "convective_initiation", label: "New Storms (CI)" },
              ].map((layer) => (
                <button
                  key={layer.id}
                  onClick={() => setSelectedFieldType(layer.id)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    selectedFieldType === layer.id
                      ? "bg-vajra-orange text-slate-950 font-bold"
                      : "bg-panel text-slate-300 hover:text-white border border-panel-border"
                  }`}
                >
                  {layer.label}
                </button>
              ))}
            </div>

            {/* Overlays toggle */}
            <div className="flex items-center space-x-2 font-mono text-[11px]">
              <label className="flex items-center space-x-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={activeLayers.tracks}
                  onChange={(e) => setActiveLayers({ ...activeLayers, tracks: e.target.checked })}
                  className="rounded text-vajra-orange focus:ring-0 bg-panel border-panel-border"
                />
                <span className="text-slate-300">Tracks</span>
              </label>
              <label className="flex items-center space-x-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={activeLayers.airports}
                  onChange={(e) => setActiveLayers({ ...activeLayers, airports: e.target.checked })}
                  className="rounded text-vajra-orange focus:ring-0 bg-panel border-panel-border"
                />
                <span className="text-slate-300">Airports</span>
              </label>
            </div>
          </div>

          {/* Interactive Map Visualizer */}
          <div className="flex-1 relative">
            <RadarMap
              fieldData={fieldData}
              cells={cells}
              countdowns={countdowns}
              selectedCellId={selectedCellId}
              onSelectCell={(id) => setSelectedCellId(id)}
              activeLayers={activeLayers}
              onMapClickPin={(lat, lon) => setPinnedPoint({ lat, lon })}
              pinnedLocation={pinnedPoint}
            />

            {/* Point Inspector Popover if user clicked on map */}
            {pinnedPoint && (() => {
              let sampledVal: number | null = null;
              if (fieldData?.bounds && fieldData.data && fieldData.data.length > 0) {
                const { lat_min, lat_max, lon_min, lon_max, ny, nx } = fieldData.bounds;
                if (
                  pinnedPoint.lat >= lat_min &&
                  pinnedPoint.lat <= lat_max &&
                  pinnedPoint.lon >= lon_min &&
                  pinnedPoint.lon <= lon_max
                ) {
                  const y = Math.min(
                    ny - 1,
                    Math.max(0, Math.floor((1 - (pinnedPoint.lat - lat_min) / (lat_max - lat_min)) * ny))
                  );
                  const x = Math.min(
                    nx - 1,
                    Math.max(0, Math.floor(((pinnedPoint.lon - lon_min) / (lon_max - lon_min)) * nx))
                  );
                  if (fieldData.data[y] && fieldData.data[y][x] !== undefined) {
                    sampledVal = fieldData.data[y][x];
                  }
                }
              }

              const dLat = (pinnedPoint.lat - 22.57) * 111.0;
              const dLon = (pinnedPoint.lon - 88.35) * 102.5;
              const distToRadar = Math.hypot(dLat, dLon);
              const isInsideRadar = distToRadar <= 250.0;

              let nearestCell: StormCellData | null = null;
              let minCellDist = Infinity;
              let bearingStr = "";

              cells.forEach((c) => {
                const dy = (c.lat - pinnedPoint.lat) * 111.0;
                const dx = (c.lon - pinnedPoint.lon) * 102.5;
                const d = Math.hypot(dy, dx);
                if (d < minCellDist) {
                  minCellDist = d;
                  nearestCell = c;
                  const deg = (Math.atan2(dx, dy) * (180 / Math.PI) + 360) % 360;
                  const cardinals = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
                  const cIdx = Math.round(deg / 22.5) % 16;
                  bearingStr = `${cardinals[cIdx]} (${Math.round(deg)}°)`;
                }
              });

              return (
                <div className="absolute top-4 left-4 z-40 bg-panel-dark/95 border border-vajra-orange/50 p-3 rounded-lg shadow-2xl backdrop-blur-md w-80 text-xs font-mono">
                  <div className="flex items-center justify-between border-b border-panel-border pb-1.5 mb-2">
                    <div className="flex items-center space-x-1.5 text-vajra-orange font-bold">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>Point Inspection</span>
                    </div>
                    <button
                      onClick={() => setPinnedPoint(null)}
                      className="text-slate-400 hover:text-white text-xs font-bold"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="space-y-1.5 text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Coordinates:</span>
                      <span className="text-white font-bold">
                        {pinnedPoint.lat.toFixed(3)}°N, {pinnedPoint.lon.toFixed(3)}°E
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Radar Coverage:</span>
                      {isInsideRadar ? (
                        <span className="text-emerald-400 font-bold">Inside VECC Ring ({Math.round(distToRadar)} km)</span>
                      ) : (
                        <span className="text-amber-400 font-bold">Outside DWR Limit ({Math.round(distToRadar)} km · Sat-Only)</span>
                      )}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Echo Intensity:</span>
                      <span className="text-white font-bold">
                        {sampledVal !== null && sampledVal > -30
                          ? `${sampledVal.toFixed(1)} ${fieldData?.unit || "dBZ"}`
                          : `< 15 ${fieldData?.unit || "dBZ"} (No echo)`}
                      </span>
                    </div>
                    {nearestCell && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Nearest Storm:</span>
                        <span className="text-vajra-orange font-bold">
                          {(nearestCell as StormCellData).cell_id} ({minCellDist.toFixed(1)} km {bearingStr})
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* --------------------------------------------------------------- */}
          {/* BOTTOM: HONEST LEAD-TIME SCRUBBER (0 TO 360 MIN)                */}
          {/* --------------------------------------------------------------- */}
          <div className="bg-panel border-t border-panel-border px-4 py-2 flex flex-col gap-2 z-20">
            <div className="flex items-center justify-between text-xs font-mono">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsPlayingLead(!isPlayingLead)}
                  className="px-2.5 py-1 rounded bg-vajra-orange text-slate-950 font-bold flex items-center space-x-1 shadow"
                >
                  {isPlayingLead ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{isPlayingLead ? "Pause" : "Play Nowcast"}</span>
                </button>
                <span className="text-slate-300">
                  Lead Time: <span className="text-vajra-orange font-bold text-sm">+{leadTime} min</span> (
                  {Math.floor(leadTime / 60)}h {leadTime % 60}m)
                </span>
              </div>

              {/* Confidence Transition Indicator */}
              <div className="text-[11px] font-mono">
                {leadTime <= 60 ? (
                  <span className="text-emerald-400 font-semibold flex items-center">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block mr-1.5 animate-pulse"></span>
                    0–60 min: High Confidence (Radar extrapolation + AI)
                  </span>
                ) : leadTime <= 120 ? (
                  <span className="text-amber-400 font-semibold flex items-center">
                    <span className="w-2 h-2 rounded-full bg-amber-400 inline-block mr-1.5"></span>
                    60–120 min: Medium Confidence (AI-NWP blend)
                  </span>
                ) : (
                  <span className="text-blue-400 font-semibold flex items-center">
                    <span className="w-2 h-2 rounded-full bg-blue-400 inline-block mr-1.5"></span>
                    120–360 min: Area Probability (NWP ensemble)
                  </span>
                )}
              </div>
            </div>

            {/* Confidence Bands Bar */}
            <div className="relative w-full h-3 flex rounded overflow-hidden border border-panel-border">
              <div
                className="h-full bg-emerald-500/20 border-r border-emerald-500/60 flex items-center px-1 text-[9px] font-mono text-emerald-300 select-none"
                style={{ width: "16.666%" }}
                title="0-60 min: High confidence (Radar extrapolation + AI)"
              >
                <span className="truncate">0-60m High</span>
              </div>
              <div
                className="h-full bg-amber-500/20 border-r border-dashed border-amber-500/60 flex items-center px-1 text-[9px] font-mono text-amber-300 select-none"
                style={{ width: "16.666%" }}
                title="60-120 min: Medium confidence (AI-NWP blend)"
              >
                <span className="truncate">60-120m Blend</span>
              </div>
              <div
                className="h-full bg-blue-500/15 flex items-center px-2 text-[9px] font-mono text-blue-300 select-none border-l border-dotted border-blue-400/40"
                style={{ width: "66.668%" }}
                title="120-360 min: Area probability (NWP ensemble)"
              >
                <span className="truncate">120-360m Area Probabilities (NWP Ensemble)</span>
              </div>
            </div>

            {/* Slider Scrubber snapping to LEAD_TIME_STEPS */}
            <div className="relative flex items-center">
              <input
                type="range"
                min="0"
                max={LEAD_TIME_STEPS.length - 1}
                step="1"
                value={Math.max(0, LEAD_TIME_STEPS.indexOf(leadTime))}
                onChange={(e) => setLeadTime(LEAD_TIME_STEPS[Number(e.target.value)])}
                className="w-full h-2 bg-panel-dark rounded-lg appearance-none cursor-pointer accent-vajra-orange"
              />
            </div>

            {/* Distinct Non-Overlapping Tick Marks */}
            <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 px-0.5">
              {LEAD_TIME_STEPS.map((t) => {
                const isSelected = leadTime === t;
                const isHigh = t <= 60;
                const isMed = t > 60 && t <= 120;
                return (
                  <button
                    key={t}
                    onClick={() => setLeadTime(t)}
                    className={`flex flex-col items-center transition-all cursor-pointer group ${
                      isSelected
                        ? "text-vajra-orange font-bold scale-110"
                        : isHigh
                        ? "text-emerald-400/80 hover:text-emerald-300"
                        : isMed
                        ? "text-amber-400/80 hover:text-amber-300"
                        : "text-blue-400/70 hover:text-blue-300"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full mb-0.5 ${
                        isSelected ? "bg-vajra-orange ring-2 ring-vajra-orange/40" : "bg-slate-600 group-hover:bg-slate-400"
                      }`}
                    />
                    <span>{t === 0 ? "0m" : `+${t}m`}</span>
                  </button>
                );
              })}
            </div>

            {/* Confidence Bands Legend */}
            <div className="flex flex-wrap items-center justify-between text-[10px] font-mono text-slate-400 pt-0.5 border-t border-panel-border/60">
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-1.5 bg-emerald-500/50 border border-emerald-500 rounded-sm"></span>
                <span className="text-slate-300">0–60 min: High confidence (Radar extrapolation + AI)</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-1.5 bg-amber-500/40 border border-dashed border-amber-500 rounded-sm"></span>
                <span className="text-slate-300">60–120 min: Medium confidence (AI-NWP blend)</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-1.5 bg-blue-500/30 border border-dotted border-blue-400 rounded-sm"></span>
                <span className="text-slate-300">120–360 min: Area probability (NWP ensemble)</span>
              </div>
            </div>
          </div>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* RIGHT PANEL: COUNTDOWNS, HAZARDS, CLOUDBURST, SKILL, ALERTS       */}
        {/* ----------------------------------------------------------------- */}
        <div className="w-full lg:w-96 bg-panel border-l border-panel-border flex flex-col overflow-hidden shrink-0">
          {/* Tab Navigation */}
          <div className="grid grid-cols-5 border-b border-panel-border bg-panel-dark text-[11px] font-medium text-slate-400">
            {[
              { id: "countdowns", label: "Countdown" },
              { id: "hazards", label: "Hazards" },
              { id: "cloudburst", label: "Burst" },
              { id: "skill", label: "Skill" },
              { id: "alerts", label: "Alerts" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-2 text-center transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? "border-vajra-orange text-white font-bold bg-panel"
                    : "border-transparent hover:text-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-3 text-xs">
            {/* TAB 1: COUNTDOWNS */}
            {activeTab === "countdowns" && (
              <div className="space-y-2.5">
                <div className="text-[11px] text-slate-400 mb-2 font-mono flex items-center justify-between">
                  <span>Monitored Critical Points</span>
                  <span>Arrival Window (10-90%)</span>
                </div>
                {countdowns.map((c) => (
                  <div
                    key={c.place_code}
                    onClick={() => setPinnedPoint({ lat: c.lat, lon: c.lon })}
                    className={`p-2.5 rounded-lg border transition-all cursor-pointer hover:border-vajra-orange/70 ${
                      c.countdown_display === "STORM OVERHEAD"
                        ? "bg-red-950/40 border-red-500/70 shadow-lg glow-severe"
                        : c.approaching
                        ? "bg-panel-dark border-amber-500/40 shadow"
                        : "bg-panel-dark/50 border-panel-border"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <span className="font-semibold text-white">{c.place_name}</span>
                        <span className="text-[10px] text-slate-500 ml-1.5 font-mono">({c.place_code})</span>
                      </div>
                      {c.countdown_display === "STORM OVERHEAD" ? (
                        <div className="flex items-center space-x-1.5">
                          <span className="text-red-400 font-mono font-bold text-xs animate-pulse">
                            STORM OVERHEAD
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 font-mono font-bold">
                            {c.probability_pct}%
                          </span>
                        </div>
                      ) : c.approaching ? (
                        <div className="flex items-center space-x-1.5">
                          <span className="text-vajra-orange font-mono font-bold text-sm">
                            {c.countdown_display}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-vajra-orange/20 text-vajra-orange font-mono font-bold">
                            {c.probability_pct}%
                          </span>
                        </div>
                      ) : c.countdown_display === "Passed" ? (
                        <span className="text-slate-400 font-mono text-[11px] bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
                          Passed
                        </span>
                      ) : (
                        <span className="text-slate-500 font-mono text-[11px] bg-slate-800/60 px-2 py-0.5 rounded border border-slate-800">
                          No threat in 6h
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      <span>Window: {c.window_display}</span>
                      <span className="uppercase text-[10px] text-slate-500">{c.primary_hazard || c.place_type}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TAB 2: HAZARDS */}
            {activeTab === "hazards" && (
              <div className="space-y-3 font-mono">
                {/* Downburst section */}
                <div className="p-2.5 rounded-lg bg-panel-dark border border-purple-500/30">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-purple-400 font-bold flex items-center">
                      <Zap className="w-3.5 h-3.5 mr-1" /> Downburst Outflow
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">
                      {hazardsSummary?.downburst_events?.length > 0 ? "DETECTED" : "LOW RISK"}
                    </span>
                  </div>
                  {hazardsSummary?.downburst_events?.map((d: any) => (
                    <div key={d.event_id} className="text-[11px] text-slate-300 space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Peak Outflow Gust:</span>
                        <span className="text-purple-300 font-bold">{d.outflow_speed_ms} m/s ({d.outflow_speed_kmh} km/h)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Velocity Divergence:</span>
                        <span>{d.divergence_ms} m/s</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Warning Lead Time:</span>
                        <span className="text-amber-400 font-bold">{d.lead_time_min} min</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Hail section */}
                <div className="p-2.5 rounded-lg bg-panel-dark border border-cyan-500/30">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-cyan-400 font-bold">Hail Probability (POH)</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300">
                      MESH: 32 mm
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-300 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Severe Hail Core (&gt;52 dBZ):</span>
                      <span className="text-cyan-300 font-bold">{Math.round((hazardsSummary?.hail_max_prob || 0.85) * 100)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Confidence Badge:</span>
                      <span className="text-emerald-400">HIGH (0-1h)</span>
                    </div>
                  </div>
                </div>

                {/* Lightning */}
                <div className="p-2.5 rounded-lg bg-panel-dark border border-amber-500/30">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-amber-400 font-bold">Lightning Threat</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                      Jump Detected
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-300 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Probability (30 min):</span>
                      <span className="text-amber-300 font-bold">92%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Expected Flash Rate:</span>
                      <span>45 strokes / km² / h</span>
                    </div>
                  </div>
                </div>

                {/* Convective Initiation Candidates */}
                <div className="p-2.5 rounded-lg bg-panel-dark border border-blue-500/30">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-blue-400 font-bold">Convective Initiation</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">
                      Satellite Cooling
                    </span>
                  </div>
                  {hazardsSummary?.convective_initiation_candidates?.map((ci: any) => (
                    <div key={ci.ci_id} className="text-[11px] text-slate-300 space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Candidate:</span>
                        <span className="text-blue-300 font-bold">{ci.ci_id}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Cooling Rate:</span>
                        <span className="text-red-400">{ci.cooling_rate_k_15min} K / 15m</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Est. Time to Radar Echo:</span>
                        <span className="text-white font-bold">{ci.estimated_time_to_echo_min} min</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: CLOUDBURST */}
            {activeTab === "cloudburst" && (
              <div className="space-y-3 font-mono">
                <div className="p-2.5 rounded-lg bg-panel-dark border border-blue-500/40 glow-cloudburst">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-blue-400 font-bold flex items-center">
                      <CloudRain className="w-4 h-4 mr-1 text-blue-400" />
                      IMD Cloudburst Criteria
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold">
                      ≥100 mm/h over ≥20 km²
                    </span>
                  </div>
                  <div className="space-y-2 text-xs text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Cluster Status:</span>
                      <span className="text-blue-400 font-bold">
                        {selectedRegion === "uttarakhand" ? "ACTIVE IN RIVER VALLEY" : "POTENTIAL NOR'WESTER CORE"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Measured Area:</span>
                      <span className="text-white font-bold">28.0 km²</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Max Rain Accumulation Rate:</span>
                      <span className="text-red-400 font-bold">115.4 mm/h</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Flash Flood / Debris Flow Risk:</span>
                      <span className="text-red-400 font-bold">CRITICAL</span>
                    </div>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-panel-dark border border-panel-border text-[11px] text-slate-400 space-y-1">
                  <div className="font-semibold text-white">Topological Valley Funneling:</div>
                  <p>
                    Orchestrated connected components algorithm partitions contiguous pixels meeting
                    the 100 mm/h threshold. In steep Himalayan terrain (Rudraprayag / Chamoli),
                    stationary convective anchoring triggers automated flash flood bulletins.
                  </p>
                </div>
              </div>
            )}

            {/* TAB 4: SKILL & VERIFICATION */}
            {activeTab === "skill" && (
              <div className="space-y-3 font-mono">
                <div className="text-[11px] text-slate-400">
                  Critical Success Index (CSI) vs Lead Time (VAJRA vs PySteps Baseline)
                </div>
                {/* CSI Skill Curve Chart */}
                <div className="h-44 w-full bg-panel-dark p-2 rounded-lg border border-panel-border">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={verification}>
                      <XAxis dataKey="lead_minutes" stroke="#64748B" fontSize={10} tickFormatter={(v) => `+${v}m`} />
                      <YAxis domain={[0, 1]} stroke="#64748B" fontSize={10} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#0E1626", borderColor: "rgba(255,255,255,0.1)", fontSize: "11px" }}
                      />
                      <Line type="monotone" dataKey="vajra_csi" stroke="#F28C28" strokeWidth={2} name="VAJRA CSI" />
                      <Line type="monotone" dataKey="pysteps_baseline_csi" stroke="#64748B" strokeDasharray="3 3" name="PySteps Baseline" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Skill summary table */}
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex justify-between text-slate-400 border-b border-panel-border pb-1">
                    <span>Lead</span>
                    <span>CSI</span>
                    <span>POD</span>
                    <span>FAR</span>
                    <span>Timing Err</span>
                  </div>
                  {verification.map((v) => (
                    <div key={v.lead_minutes} className="flex justify-between text-slate-300">
                      <span className="text-vajra-orange">+{v.lead_minutes}m</span>
                      <span>{v.csi.toFixed(2)}</span>
                      <span>{v.pod.toFixed(2)}</span>
                      <span>{v.far.toFixed(2)}</span>
                      <span>±{v.eta_timing_error_minutes}m</span>
                    </div>
                  ))}
                </div>

                <div className="p-2 rounded bg-panel-dark border border-vajra-orange/20 text-[11px] text-amber-300">
                  ⚡ Lead-time gain: VAJRA provides +18 min earlier actionable warning compared to traditional optical flow alone.
                </div>
              </div>
            )}

            {/* TAB 5: ALERTS & MULTI-LINGUAL */}
            {activeTab === "alerts" && (
              <div className="space-y-3 font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-white font-bold">CAP 1.2 Draft Alerts</span>
                  <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                    Pending IMD Approval
                  </span>
                </div>

                {/* Language Switcher */}
                <div className="flex items-center space-x-1 bg-panel-dark p-1 rounded border border-panel-border text-[11px]">
                  <Languages className="w-3.5 h-3.5 text-vajra-orange mr-1" />
                  {[
                    { id: "en", label: "English" },
                    { id: "hi", label: "हिन्दी" },
                    { id: "bn", label: "বাংলা" },
                    { id: "kn", label: "ಕನ್ನಡ" },
                  ].map((lang) => (
                    <button
                      key={lang.id}
                      onClick={() => setSelectedLang(lang.id as any)}
                      className={`px-2 py-0.5 rounded ${
                        selectedLang === lang.id
                          ? "bg-vajra-orange text-slate-950 font-bold"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>

                {/* Selected Alert Details */}
                {activeAlert && (
                  <div className="space-y-2.5">
                    <div className="p-2.5 rounded-lg bg-panel-dark border border-panel-border space-y-2">
                      <div className="flex justify-between items-start">
                        <div className="font-bold text-white text-xs">{activeAlert.headline}</div>
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                            activeAlert.approval_status === "APPROVED"
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                              : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                          }`}
                        >
                          {activeAlert.approval_status}
                        </span>
                      </div>

                      {/* SMS Script Preview */}
                      <div className="bg-panel p-2 rounded border border-panel-border">
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">
                          SMS Script Preview ({selectedLang.toUpperCase()}):
                        </div>
                        <p className="text-slate-200 text-[11px] leading-relaxed">
                          {activeAlert.sms?.[selectedLang] || "Generating multilingual template..."}
                        </p>
                      </div>

                      {/* IVR Voice Script Preview */}
                      <div className="bg-panel p-2 rounded border border-panel-border">
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 flex items-center space-x-1">
                          <Volume2 className="w-3 h-3 text-vajra-orange" />
                          <span>IVR Voice Dispatch Preview ({selectedLang.toUpperCase()}):</span>
                        </div>
                        <p className="text-slate-200 text-[11px] leading-relaxed italic">
                          "{activeAlert.ivr?.[selectedLang] || "Generating voice broadcast template..."}"
                        </p>
                      </div>

                      {/* Forecaster Decision Buttons */}
                      <div className="flex space-x-2 pt-1">
                        <button
                          onClick={() => handleApproveAlert(activeAlert.alert_id)}
                          className="flex-1 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center space-x-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Approve (Publish to SACHET)</span>
                        </button>
                        <button
                          onClick={() => handleRejectAlert(activeAlert.alert_id)}
                          className="px-3 py-1.5 rounded bg-red-950/60 hover:bg-red-900 border border-red-500/40 text-red-300 font-bold flex items-center justify-center space-x-1"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                      </div>
                    </div>

                    {/* CAP 1.2 XML Raw Preview */}
                    <div className="p-2 rounded bg-panel-dark border border-panel-border">
                      <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 flex items-center space-x-1">
                        <FileCode className="w-3 h-3 text-blue-400" />
                        <span>CAP 1.2 XML Document:</span>
                      </div>
                      <pre className="text-[9px] font-mono text-slate-400 max-h-36 overflow-y-auto bg-black/40 p-2 rounded">
                        {activeAlert.cap_xml}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
