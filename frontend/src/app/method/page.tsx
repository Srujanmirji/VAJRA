"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Sliders,
  Layers,
  Cpu,
  ShieldAlert,
  AlertTriangle,
  Zap,
  Wind,
  CloudRain,
  Radio,
  Satellite,
  HelpCircle,
  CheckCircle,
  XCircle,
  ArrowRight,
  Info,
} from "lucide-react";

export default function MethodPage() {
  const [sliderLeadMin, setSliderLeadMin] = useState<number>(60);

  // Compute blend weights using identical sigmoid transition formula from backend blend/weights.py
  // w_radar = 1.0 / (1.0 + exp((t - 120.0) / 30.0))
  const computeRadarWeight = (t: number): number => {
    if (t <= 30) return 1.0;
    if (t >= 300) return 0.0;
    const w = 1.0 / (1.0 + Math.exp((t - 120.0) / 30.0));
    return parseFloat(w.toFixed(3));
  };

  const radarWeight = computeRadarWeight(sliderLeadMin);
  const nwpWeight = parseFloat((1.0 - radarWeight).toFixed(3));

  const getConfidenceLevel = (t: number) => {
    if (t <= 60) return { label: "HIGH", color: "text-emerald-400", bg: "bg-emerald-500/15 border-emerald-500/30" };
    if (t <= 120) return { label: "MEDIUM", color: "text-amber-400", bg: "bg-amber-500/15 border-amber-500/30" };
    return { label: "LOWER", color: "text-blue-400", bg: "bg-blue-500/15 border-blue-500/30" };
  };

  const conf = getConfidenceLevel(sliderLeadMin);

  return (
    <div className="flex-1 bg-background text-slate-100 py-10 px-4 sm:px-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-10 text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-panel-card border border-panel-border text-xs font-mono text-vajra-orange mb-3">
          <Cpu className="w-3.5 h-3.5" />
          <span>Scientific Principles &amp; Algorithms</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-display font-extrabold text-white">
          How VAJRA Works
        </h1>
        <p className="mt-3 text-sm text-slate-400 leading-relaxed">
          From multi-sensor ingest to physical hazard diagnostics and stochastic scale-decomposed advection.
          An open, mathematically honest methodology designed for operational IMD forecasters.
        </p>
      </div>

      {/* Section 1: Optical Flow vs STEPS vs Deep Learning */}
      <section className="mb-14 p-6 sm:p-8 rounded-2xl bg-panel-card border border-panel-border">
        <h2 className="text-xl font-display font-bold text-white flex items-center space-x-2">
          <Layers className="w-5 h-5 text-vajra-orange" />
          <span>1. Nowcasting Paradigms: Why Pure Advection Fails for Deep Convection</span>
        </h2>
        <p className="mt-2 text-xs sm:text-sm text-slate-400 leading-relaxed">
          Traditional radar extrapolation assumes <em>Lagrangian persistence</em>: that precipitation features maintain constant intensity 
          while advecting along the motion field. In tropical convective storms, this assumption collapses.
        </p>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="p-5 rounded-xl bg-panel border border-panel-border flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-200">Optical Flow</span>
                <span className="text-[11px] px-2 py-0.5 rounded bg-slate-700/50 text-slate-300 font-mono">Lucas-Kanade</span>
              </div>
              <div className="mt-3 text-xs text-slate-400 space-y-2">
                <p><strong>Core Concept:</strong> Solves the optical flow advection equation on consecutive radar reflectivity fields.</p>
                <p><strong>Strengths:</strong> Extremely fast (&lt; 100 ms), high spatial accuracy for large stratiform rainbands over 0–45 min.</p>
                <p className="text-red-400"><strong>Fatal Flaw:</strong> Completely blind to cell growth, new convective initiation, and storm dissipation.</p>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-panel-border text-[11px] text-slate-500 font-mono">
              Lead time skill limit: ~60 min
            </div>
          </div>

          <div className="p-5 rounded-xl bg-panel border border-vajra-orange/30 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-vajra-orange">STEPS Ensemble</span>
                <span className="text-[11px] px-2 py-0.5 rounded bg-vajra-orange/15 text-vajra-orange font-mono">Stochastic Cascade</span>
              </div>
              <div className="mt-3 text-xs text-slate-400 space-y-2">
                <p><strong>Core Concept:</strong> Decomposes radar reflectivity into 5 spatial scale cascades via 2D Fast Fourier Transforms (FFT). Smaller scales decorrelate faster than synoptic scales.</p>
                <p><strong>Strengths:</strong> Generates 16 stochastic realizations with autoregressive noise (AR-2), providing honest probability envelopes for extreme rainfall.</p>
                <p className="text-emerald-400"><strong>VAJRA Role:</strong> Forms our core probabilistic nowcast engine for lead times 30–120 min.</p>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-panel-border text-[11px] text-slate-500 font-mono">
              Lead time skill limit: ~120 min
            </div>
          </div>

          <div className="p-5 rounded-xl bg-panel border border-panel-border flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-200">Physics-Informed ML</span>
                <span className="text-[11px] px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 font-mono">U-Net 9-Channel</span>
              </div>
              <div className="mt-3 text-xs text-slate-400 space-y-2">
                <p><strong>Core Concept:</strong> Deep convolutional U-Net conditioned on 9 physical channels (3 radar lag frames, 2 satellite IR frames, 2 lightning stroke fields, topography &amp; CAPE).</p>
                <p><strong>Strengths:</strong> Learns non-linear convective intensification patterns from historical SEVIR and India storm sequences.</p>
                <p className="text-amber-400"><strong>Guardrail:</strong> Blended with STEPS to prevent hallucination of unphysical echo bursts.</p>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-panel-border text-[11px] text-slate-500 font-mono">
              Lead time skill limit: ~90 min
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Interactive Blending Weight Slider */}
      <section className="mb-14 p-6 sm:p-8 rounded-2xl bg-panel-card border border-panel-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-display font-bold text-white flex items-center space-x-2">
              <Sliders className="w-5 h-5 text-vajra-orange" />
              <span>2. Interactive Observation-to-NWP Blending Slider</span>
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Drag the lead time to observe how VAJRA smoothly shifts authority from radar observations to NWP models.
            </p>
          </div>
          <div className={`px-3 py-1.5 rounded-lg border font-mono text-xs font-bold flex items-center space-x-2 ${conf.bg}`}>
            <span className="text-slate-400">Forecaster Confidence:</span>
            <span className={conf.color}>{conf.label}</span>
          </div>
        </div>

        {/* Slider Controls */}
        <div className="mt-8 bg-panel p-6 rounded-xl border border-panel-border">
          <div className="flex items-center justify-between font-mono text-xs text-slate-400 mb-2">
            <span>Nowcast T+0 min</span>
            <span className="text-base font-bold text-vajra-orange">{sliderLeadMin} minutes ({(sliderLeadMin / 60).toFixed(1)} h)</span>
            <span>Forecast T+360 min (6 h)</span>
          </div>

          <input
            type="range"
            min={0}
            max={360}
            step={5}
            value={sliderLeadMin}
            onChange={(e) => setSliderLeadMin(parseInt(e.target.value))}
            className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-vajra-orange"
          />

          {/* Preset Buttons */}
          <div className="mt-4 flex flex-wrap gap-2">
            {[0, 15, 30, 45, 60, 90, 120, 180, 240, 360].map((step) => (
              <button
                key={step}
                onClick={() => setSliderLeadMin(step)}
                className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                  sliderLeadMin === step
                    ? "bg-vajra-orange text-slate-950 font-bold"
                    : "bg-panel-card border border-panel-border text-slate-400 hover:text-white"
                }`}
              >
                +{step}m
              </button>
            ))}
          </div>

          {/* Interactive Weight Visualizer Bar */}
          <div className="mt-8">
            <div className="text-xs font-mono text-slate-300 mb-2 flex justify-between">
              <span>Weights Distribution at T+{sliderLeadMin}m:</span>
              <span>
                Radar: <strong className="text-vajra-orange">{(radarWeight * 100).toFixed(1)}%</strong> | NWP (IMD-HRRR): <strong className="text-blue-400">{(nwpWeight * 100).toFixed(1)}%</strong>
              </span>
            </div>

            <div className="w-full h-8 rounded-lg overflow-hidden flex border border-panel-border bg-slate-900">
              <div
                style={{ width: `${radarWeight * 100}%` }}
                className="bg-gradient-to-r from-orange-500 to-amber-500 flex items-center justify-center text-[11px] font-bold text-slate-950 font-mono transition-all duration-150"
              >
                {radarWeight >= 0.15 ? `Radar / Satellite (${(radarWeight * 100).toFixed(0)}%)` : ""}
              </div>
              <div
                style={{ width: `${nwpWeight * 100}%` }}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center text-[11px] font-bold text-white font-mono transition-all duration-150"
              >
                {nwpWeight >= 0.15 ? `IMD-HRRR / NCUM-R (${(nwpWeight * 100).toFixed(0)}%)` : ""}
              </div>
            </div>

            <div className="mt-4 p-3 rounded-lg bg-panel-card border border-panel-border text-xs text-slate-300 font-mono leading-relaxed">
              <strong>Mathematical Formulation:</strong> <br />
              <code className="text-vajra-orange">w_radar(t) = 1.0 / (1.0 + exp((t - 120.0) / 30.0))</code> &nbsp;|&nbsp; 
              <code className="text-blue-400">w_nwp(t) = 1.0 - w_radar(t)</code> <br />
              <span className="text-slate-400 text-[11px]">
                Ensures w_radar + w_nwp = 1.0 at all lead steps. NWP model is strictly read-only and never modified.
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Hazard Diagnostics Explained in Plain Language */}
      <section className="mb-14 p-6 sm:p-8 rounded-2xl bg-panel-card border border-panel-border">
        <h2 className="text-xl font-display font-bold text-white flex items-center space-x-2">
          <AlertTriangle className="w-5 h-5 text-vajra-orange" />
          <span>3. Hazard Diagnostic Engines Explained in Plain Language</span>
        </h2>
        <p className="mt-2 text-xs sm:text-sm text-slate-400 leading-relaxed">
          VAJRA isolates distinct convective microphysical signatures using peer-reviewed meteorological methods.
        </p>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Hail */}
          <div className="p-5 rounded-xl bg-panel border border-panel-border">
            <div className="flex items-center space-x-2 text-white font-bold text-sm">
              <div className="w-7 h-7 rounded bg-amber-500/20 text-amber-400 flex items-center justify-center">
                ❄️
              </div>
              <span>Hail Diagnostics (POH &amp; MESH)</span>
            </div>
            <div className="mt-3 text-xs text-slate-300 space-y-2 leading-relaxed">
              <p>
                <strong>Method:</strong> Waldvogel Technique. Calculates how far the 45 dBZ reflectivity core penetrates 
                above the environmental freezing level (0°C isotherm, typically 4.5 km AGL in India).
              </p>
              <div className="p-2.5 rounded bg-slate-900 font-mono text-[11px] text-amber-300">
                &Delta;H = H_45dBZ - H_0C <br />
                POH = 1 / (1 + exp(-1.2 * (&Delta;H - 1.5))) &times; 100% <br />
                MESH = 2.54 &times; (SHI)^0.5 &nbsp;[Maximum Expected Severe Hail size in mm]
              </div>
              <p className="text-slate-400 text-[11px]">
                Identifies dangerous hail supercells with MESH &ge; 25 mm before stones reach the ground.
              </p>
            </div>
          </div>

          {/* Downburst */}
          <div className="p-5 rounded-xl bg-panel border border-panel-border">
            <div className="flex items-center space-x-2 text-white font-bold text-sm">
              <div className="w-7 h-7 rounded bg-blue-500/20 text-blue-400 flex items-center justify-center">
                <Wind className="w-4 h-4 text-blue-400" />
              </div>
              <span>Downburst &amp; Microburst Divergence</span>
            </div>
            <div className="mt-3 text-xs text-slate-300 space-y-2 leading-relaxed">
              <p>
                <strong>Method:</strong> Radial Velocity Dipole Analysis. When a dense rain downdraft hits the ground, 
                it splashes out radially, producing adjacent inbound (-v) and outbound (+v) Doppler signatures.
              </p>
              <div className="p-2.5 rounded bg-slate-900 font-mono text-[11px] text-blue-300">
                &Delta;v = |v_outbound - v_inbound| &ge; 20 m/s (~72 km/h) <br />
                within separation distance &le; 10 km
              </div>
              <p className="text-slate-400 text-[11px]">
                Triggers severe surface wind shear warnings essential for airport runway safety (e.g. Kolkata NSCBI Airport).
              </p>
            </div>
          </div>

          {/* Cloudburst */}
          <div className="p-5 rounded-xl bg-panel border border-panel-border">
            <div className="flex items-center space-x-2 text-white font-bold text-sm">
              <div className="w-7 h-7 rounded bg-purple-500/20 text-purple-400 flex items-center justify-center">
                <CloudRain className="w-4 h-4 text-purple-400" />
              </div>
              <span>IMD Cloudburst Detection</span>
            </div>
            <div className="mt-3 text-xs text-slate-300 space-y-2 leading-relaxed">
              <p>
                <strong>Official IMD Standard:</strong> Rainfall rate of &ge; 100 mm/h occurring over a contiguous spatial area of &ge; 20 km&sup2;.
              </p>
              <div className="p-2.5 rounded bg-slate-900 font-mono text-[11px] text-purple-300">
                Z-R Convective: Z = 300 &times; R^1.4 &rarr; 56 dBZ &asymp; 170 mm/h <br />
                Connected component clustering on 1 km grid
              </div>
              <p className="text-slate-400 text-[11px]">
                Monitors flash flood basins across Uttarakhand, Himachal Pradesh, and Western Ghats.
              </p>
            </div>
          </div>

          {/* Lightning Jump */}
          <div className="p-5 rounded-xl bg-panel border border-panel-border">
            <div className="flex items-center space-x-2 text-white font-bold text-sm">
              <div className="w-7 h-7 rounded bg-yellow-500/20 text-yellow-400 flex items-center justify-center">
                <Zap className="w-4 h-4 text-yellow-400" />
              </div>
              <span>Lightning Jump (Schultz 2&sigma; Algorithm)</span>
            </div>
            <div className="mt-3 text-xs text-slate-300 space-y-2 leading-relaxed">
              <p>
                <strong>Method:</strong> Rapid surge in total lightning flash rate (CG + IC) caused by intense mixed-phase 
                charging in storm updrafts before severe weather strikes the ground.
              </p>
              <div className="p-2.5 rounded bg-slate-900 font-mono text-[11px] text-yellow-300">
                &Delta;f = f(t) - f(t-5min) &ge; 10 flashes/min <br />
                and &Delta;f &ge; 2 &times; &sigma;_(historical rate)
              </div>
              <p className="text-slate-400 text-[11px]">
                Provides a crucial 15–25 minute lead time prior to tornado, severe hail, or destructive downburst touchdown.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 4: Data Source Specifications */}
      <section className="mb-14 p-6 sm:p-8 rounded-2xl bg-panel-card border border-panel-border">
        <h2 className="text-xl font-display font-bold text-white flex items-center space-x-2">
          <Satellite className="w-5 h-5 text-vajra-orange" />
          <span>4. Ingest Specifications &amp; Sensor Calibration</span>
        </h2>
        
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300 border-collapse">
            <thead>
              <tr className="border-b border-panel-border text-slate-400 font-mono">
                <th className="py-2 px-3">Sensor Feed</th>
                <th className="py-2 px-3">Bands / Frequencies</th>
                <th className="py-2 px-3">Native Resolution</th>
                <th className="py-2 px-3">Update Cadence</th>
                <th className="py-2 px-3">Role in VAJRA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-panel-border font-sans">
              <tr>
                <td className="py-2.5 px-3 font-semibold text-white">IMD DWR (S-Band)</td>
                <td className="py-2.5 px-3 font-mono">2.7 – 2.9 GHz</td>
                <td className="py-2.5 px-3">250 m radial &times; 1&deg;</td>
                <td className="py-2.5 px-3">5 min</td>
                <td className="py-2.5 px-3 text-slate-400">Deep monsoon penetration, zero attenuation</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold text-white">IMD DWR (C-Band)</td>
                <td className="py-2.5 px-3 font-mono">5.6 GHz</td>
                <td className="py-2.5 px-3">250 m radial &times; 1&deg;</td>
                <td className="py-2.5 px-3">5 min</td>
                <td className="py-2.5 px-3 text-slate-400">Inland severe storm surveillance</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold text-white">IMD DWR (X-Band)</td>
                <td className="py-2.5 px-3 font-mono">9.3 GHz</td>
                <td className="py-2.5 px-3">75 m radial &times; 0.5&deg;</td>
                <td className="py-2.5 px-3">2–5 min</td>
                <td className="py-2.5 px-3 text-slate-400">Mountain terrain &amp; urban microburst coverage</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold text-white">INSAT-3DS / 3DR (MOSDAC)</td>
                <td className="py-2.5 px-3 font-mono">TIR-1 (10.8 &micro;m), WV (6.8 &micro;m)</td>
                <td className="py-2.5 px-3">4 km nadir</td>
                <td className="py-2.5 px-3">15 min</td>
                <td className="py-2.5 px-3 text-slate-400">Pre-echo convective initiation detection</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold text-white">Lightning Stroke Stream</td>
                <td className="py-2.5 px-3 font-mono">VLF / LF / Optical (GLM)</td>
                <td className="py-2.5 px-3">&sim;500 m accuracy</td>
                <td className="py-2.5 px-3">Real-time (&lt; 20 s)</td>
                <td className="py-2.5 px-3 text-slate-400">Updraft acceleration &amp; flash jump warnings</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold text-white">IMD-HRRR / NCUM-R</td>
                <td className="py-2.5 px-3 font-mono">Hydrostatic / Convective-Permitting</td>
                <td className="py-2.5 px-3">1.5 – 4 km</td>
                <td className="py-2.5 px-3">6-hourly run</td>
                <td className="py-2.5 px-3 text-slate-400">Read-only synoptic guidance for 2–6 h blend</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Section 5: Honest Scientific Limitations */}
      <section className="p-6 sm:p-8 rounded-2xl bg-panel-card border border-panel-border">
        <h2 className="text-xl font-display font-bold text-white flex items-center space-x-2">
          <ShieldAlert className="w-5 h-5 text-amber-400" />
          <span>5. Honest Limitations: What VAJRA Cannot Do</span>
        </h2>
        <p className="mt-2 text-xs sm:text-sm text-slate-400 leading-relaxed">
          Operational safety demands total transparency. VAJRA explicitly documents its physical boundaries:
        </p>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-panel border border-red-500/20 flex items-start space-x-3">
            <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-bold text-white">Microbursts Outside Radar Doppler Cone</div>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                Doppler radial velocity can only measure divergence along the radar beam axis within &sim;150 km. 
                Beyond this range or in blind spots, downburst winds cannot be confirmed by radar alone.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-panel border border-red-500/20 flex items-start space-x-3">
            <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-bold text-white">Convective Initiation Under Cirrus Anvils</div>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                If an explosive new cell develops beneath a pre-existing thick cold cirrus shield (T_b &lt; 220 K), 
                satellite infrared cannot see the thermal contrast of cloud-top cooling.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-panel border border-red-500/20 flex items-start space-x-3">
            <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-bold text-white">Himalayan Beam Blockage Shadow Zones</div>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                Mountain ranges over 5,000 m block the radar beam completely. Deep valleys behind the ridge line 
                rely on satellite cloud-top cooling and numerical models rather than direct radar reflectivity.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-panel border border-red-500/20 flex items-start space-x-3">
            <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-bold text-white">Autonomous Public Sirens</div>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                VAJRA generates structured candidate alerts in CAP 1.2 format. To prevent false alarms, 
                every alert requires explicit IMD forecaster sign-off before downstream dissemination to NDMA or relief authorities.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
