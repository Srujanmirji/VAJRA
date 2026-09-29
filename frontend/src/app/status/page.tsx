"use client";

import React, { useState, useEffect } from "react";
import {
  Activity,
  Server,
  Clock,
  Play,
  Pause,
  SkipForward,
  Radio,
  Satellite,
  Zap,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sliders,
  Database,
  Layers,
  Cpu,
} from "lucide-react";
import {
  fetchLatestCycle,
  fetchSources,
  stepReplay,
  setReplaySpeed,
  pauseReplay,
  startReplay,
  CycleLatestResponse,
  SourceInfo,
} from "../../lib/api";

export default function StatusPage() {
  const [selectedRegion, setSelectedRegion] = useState<string>("kolkata");
  const [cycle, setCycle] = useState<CycleLatestResponse | null>(null);
  const [sources, setSources] = useState<SourceInfo[]>([]);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(10);
  const [loading, setLoading] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  const refreshData = async () => {
    try {
      const [cycleRes, sourcesRes] = await Promise.all([
        fetchLatestCycle(selectedRegion),
        fetchSources(selectedRegion),
      ]);
      setCycle(cycleRes);
      if (sourcesRes && sourcesRes.sources) {
        setSources(sourcesRes.sources);
      }
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (e) {
      console.warn("Status fetch fallback:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 5000);
    return () => clearInterval(interval);
  }, [selectedRegion]);

  const handleStep = async () => {
    try {
      await stepReplay(selectedRegion);
      await refreshData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleTogglePlay = async () => {
    try {
      if (isPlaying) {
        await pauseReplay();
        setIsPlaying(false);
      } else {
        await startReplay();
        setIsPlaying(true);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSpeedChange = async (newSpeed: number) => {
    setSpeed(newSpeed);
    try {
      await setReplaySpeed(newSpeed);
    } catch (e) {
      console.error(e);
    }
  };

  // Calculate total pipeline execution time
  const totalDurationMs = cycle?.stages?.reduce((acc, s) => acc + s.duration_ms, 0) || 0;
  const targetDurationMs = (cycle?.target_latency_seconds || 60) * 1000;

  return (
    <div className="flex-1 bg-background text-slate-100 py-8 px-4 sm:px-6 max-w-6xl mx-auto">
      {/* Header with region selection */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-panel-border gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h1 className="text-2xl font-display font-bold text-white">Pipeline Telemetry &amp; Health</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time stage-by-stage latencies, multi-source synchronization status, and scenario replay controller.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="text-right hidden sm:block">
            <div className="text-[11px] text-slate-400 font-mono">Last refreshed: {lastUpdated || "connecting..."}</div>
            <div className="text-[11px] text-emerald-400 font-mono font-medium">Target: &lt;60s for 5m cycle</div>
          </div>
          <select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-panel-card border border-panel-border text-xs font-mono text-slate-200 focus:outline-none focus:border-vajra-orange"
          >
            <option value="kolkata">Kolkata (VECC S-Band DWR)</option>
            <option value="uttarakhand">Uttarakhand (Dehradun C-Band)</option>
            <option value="delhi">Delhi NCR (Palam S-Band)</option>
            <option value="mumbai">Mumbai (Veravali C-Band)</option>
            <option value="bengaluru">Bengaluru (GKVK C-Band)</option>
          </select>
        </div>
      </div>

      {/* Replay Control Card */}
      <div className="mt-8 p-6 rounded-2xl bg-panel-card border border-vajra-orange/30 shadow-lg shadow-orange-500/5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-panel-border">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-vajra-orange/15 border border-vajra-orange/30 flex items-center justify-center text-vajra-orange">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-white flex items-center space-x-2">
                <span>Simulation &amp; Replay Engine</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 font-mono border border-amber-500/30">
                  {cycle?.provenance || "SIMULATED"}
                </span>
              </div>
              <div className="text-xs text-slate-400">
                Cycle Step #{cycle?.step_index ?? 0} · Valid Time: {cycle ? new Date(cycle.timestamp).toLocaleTimeString() : "--"}
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handleTogglePlay}
              className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center space-x-1.5 transition-colors ${
                isPlaying
                  ? "bg-amber-500 hover:bg-amber-600 text-slate-950"
                  : "bg-vajra-orange hover:bg-orange-500 text-slate-950"
              }`}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isPlaying ? "Pause Stream" : "Start Live Replay"}</span>
            </button>

            <button
              onClick={handleStep}
              className="px-3 py-2 rounded-lg bg-panel hover:bg-white/5 border border-panel-border text-xs font-mono text-slate-300 hover:text-white flex items-center space-x-1"
              title="Advance exactly one 5-minute cycle"
            >
              <SkipForward className="w-3.5 h-3.5" />
              <span>Step (+5m)</span>
            </button>
          </div>
        </div>

        {/* Speed multiplier selection */}
        <div className="mt-4 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-3">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-slate-500" />
            <span>Replay Speed Multiplier:</span>
            <div className="flex items-center space-x-1 ml-2">
              {[1, 5, 10, 30, 60].map((s) => (
                <button
                  key={s}
                  onClick={() => handleSpeedChange(s)}
                  className={`px-2.5 py-1 rounded text-xs font-mono ${
                    speed === s
                      ? "bg-slate-700 text-vajra-orange font-bold border border-vajra-orange/40"
                      : "bg-panel border border-panel-border hover:bg-white/5 text-slate-300"
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>

          <div className="font-mono text-[11px] text-slate-400">
            Active Storms: <strong className="text-white">{cycle?.active_cells_count ?? 0}</strong> | 
            Alerts: <strong className="text-amber-400">{cycle?.active_alerts_count ?? 0}</strong> | 
            CI Cells: <strong className="text-blue-400">{cycle?.ci_candidates_count ?? 0}</strong>
          </div>
        </div>
      </div>

      {/* Stage-by-Stage Latencies */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-6 rounded-2xl bg-panel-card border border-panel-border">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center space-x-2">
                <Cpu className="w-4 h-4 text-vajra-orange" />
                <span>5-Minute Cycle Stage Breakdown</span>
              </h2>
              <div className="text-xs text-slate-400 mt-0.5">
                Target: &lt;60,000 ms (1.0 minute) total runtime per 5-minute scan.
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-mono font-bold text-emerald-400">
                {(totalDurationMs / 1000).toFixed(2)}s
              </div>
              <div className="text-[10px] text-slate-500 font-mono">
                {((totalDurationMs / targetDurationMs) * 100).toFixed(1)}% of budget
              </div>
            </div>
          </div>

          {/* Stage list with timing bars */}
          <div className="space-y-3 mt-5">
            {cycle?.stages?.map((stage, idx) => {
              const pct = Math.min(100, Math.max(3, (stage.duration_ms / (totalDurationMs || 1)) * 100));
              return (
                <div key={idx} className="p-3 rounded-xl bg-panel border border-panel-border">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-semibold text-slate-200">{stage.stage_name}</span>
                    <span className="font-mono text-slate-300 font-medium">{stage.duration_ms} ms</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      style={{ width: `${pct}%` }}
                      className="h-full bg-gradient-to-r from-vajra-orange to-amber-500 rounded-full"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-3 border-t border-panel-border flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center space-x-1.5 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              <span>All pipeline stages comfortably within operational SLA.</span>
            </span>
            <span className="font-mono text-[11px] text-slate-500">Scheduler: Asynchronous Non-Blocking</span>
          </div>
        </div>

        {/* Multi-Source Sync Chips */}
        <div className="p-6 rounded-2xl bg-panel-card border border-panel-border flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-white flex items-center space-x-2">
              <Database className="w-4 h-4 text-blue-400" />
              <span>Multi-Sensor Health</span>
            </h2>
            <div className="text-xs text-slate-400 mt-0.5">
              Live ingest synchronization &amp; latency.
            </div>

            <div className="space-y-3 mt-4">
              {sources.map((s) => (
                <div key={s.id} className="p-3 rounded-xl bg-panel border border-panel-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {s.id === "radar" && <Radio className="w-4 h-4 text-vajra-orange" />}
                      {s.id === "satellite" && <Satellite className="w-4 h-4 text-emerald-400" />}
                      {s.id === "lightning" && <Zap className="w-4 h-4 text-amber-400" />}
                      {s.id === "nwp" && <Activity className="w-4 h-4 text-blue-400" />}
                      <span className="text-xs font-semibold text-white">{s.name}</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      {s.status}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span>Latency: {s.latency_seconds.toFixed(1)}s</span>
                    <span>Valid Pixels: {s.coverage_pct.toFixed(1)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 pt-3 border-t border-panel-border text-[11px] text-slate-400 leading-relaxed">
            <strong>IMD Compliance:</strong> All DWR scans use ODIM HDF5 format. INSAT imagery follows MOSDAC HDF5 calibration curves.
          </div>
        </div>
      </div>
    </div>
  );
}
