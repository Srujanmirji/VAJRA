# VAJRA prototype build prompt

Paste the prompt below into Claude Code or Cursor at the repository root. It extends the starter modules in `backend/app/` (cloudburst, countdown, weights, CAP) rather than replacing them. For a dashboard-only build (Lovable / Bolt), use Part C alone.

```
You are a senior full-stack engineer and radar meteorologist. Extend this
repository into a production-quality prototype of "VAJRA" (वज्र) — a
real-time, multi-source convective nowcasting system for India (SIH 2026,
PS 26084, NCMRWF / MoES, Team CodeX_2026). Keep and reuse the existing
modules in backend/app/ (hazards/cloudburst.py, tracking/countdown.py,
blend/weights.py, alerts/cap.py) and their tests.

Work in phases (Part E). After each phase, run tests and summarise.
Never invent skill numbers. Every dataset and panel shows provenance:
LIVE / REPLAY (real data) / SIMULATED.

PART A — WHAT VAJRA DOES
Every 5 minutes: ingest Doppler radar (reflectivity + radial velocity),
INSAT-3DR/3DS IR imagery and ground lightning → QC and fuse on a common
1 km grid → detect new storms from satellite cloud-top cooling → nowcast
0–2 h (optical flow + ML) → blend with the LATEST existing NWP output
(IMD-HRRR / NCUM-R) for 2–6 h (no NWP run on demand) → hazards: lightning
density, hail probability, downburst outflow speed (m/s), cloudburst
(IMD: ≥100 mm/1 h over ~20–30 km²), initiation → track cells → LIVE
COUNTDOWN to each place's arrival window with range and probability →
GIS dashboard, API and CAP alerts (IMD approval → SACHET / SMS / IVR /
DAMINI in local languages). Guidance for IMD forecasters only.
Honesty rules: 1 km only inside radar coverage (satellite-only areas
hatched, ~4 km, "lower confidence"); per-hazard confidence by lead time
from verification; countdowns always show window + probability.

PART B — BACKEND (Python 3.11): xarray, numpy, scipy, pysteps, wradlib /
Py-ART, h5py, netCDF4, scikit-image, PyTorch, FastAPI + WebSockets,
APScheduler, PostgreSQL + PostGIS, pytest, Docker Compose.
B1 Adapters (app/adapters/base.py interface): pysteps example radar data
   (REPLAY-REAL), SEVIR events (VIL, IR, GLM lightning), INDIA-SIM
   scenarios, INSAT-3DR/3DS HDF5 reader (MOSDAC files), IMD DWR stub,
   NWP reader.
B2 Radar QC (clutter, speckle, attenuation hook), regrid to 1 km, 5-min
   clock, coverage mask, Z–R rain rate with gauge-correction hook.
B3 CI detector from IR cooling rate, BT thresholds, cold-area growth.
B4 Nowcast: pysteps Lucas–Kanade + semi-Lagrangian + STEPS ensemble;
   small PyTorch U-Net/ConvLSTM on radar+IR+lightning (SEVIR); STEPS-style
   blend with NWP using app/blend/weights.py.
B5 Hazards: lightning, hail (VIL density / MESH-style), downburst outflow
   m/s from low-level divergence, cloudburst via app/hazards/cloudburst.py,
   initiation.
B6 Tracking (connected components + overlap matching, motion, trend);
   countdowns via app/tracking/countdown.py for places in
   config/config.example.yaml.
B7 INDIA-SIM: Kolkata nor'wester moving ESE (hail cell, weakening cell,
   new CI cell), lightning, a downburst, an Uttarakhand cloudburst
   (Dehradun, Rudraprayag, Chamoli); tagged SIMULATED.
B8 Real-time loop + replay (1×/10×/60×) publishing to WebSocket; log
   per-stage latency against the ≤5-min target.
B9 Alerts via app/alerts/cap.py; approve/reject; SMS/IVR text previews in
   en, hi, bn, kn.
B10 Verification: CSI/POD/FAR, FSS by scale/lead, Brier + reliability,
   countdown window coverage, lead-time gain vs pysteps.
B11 API per docs/API.md.

PART C — DASHBOARD (Next.js + TypeScript + Tailwind + shadcn/ui +
MapLibre GL + Recharts + Framer Motion)
Dark mission-control theme (#070B14 background, #0E1626 panels, accent
#F28C28; hazards: lightning #FFD400, hail #67E8F9, downburst #A855F7,
cloudburst #1E88E5, severe #C0182D). Provenance pills and "Guidance for
IMD forecasters — not a public warning" on every screen.
/ landing (animated storms, the gap, fusion, honest lead times, CTA).
/console: top bar (analysis time, next-cycle countdown, source chips with
latency, region selector, replay controls); left active-storm list;
map layers (reflectivity, IR, lightning, hazard probability, tracks with
+30/+60 min ellipses, radar ring, hatched satellite-only area, CI markers,
airport approach zones, cloudburst clusters); lead slider 0–360 min
(area probabilities beyond 120 min); right tabs: Countdowns (live ticking
to window start + window bar + %), Hazards (with confidence badges,
downburst m/s), Cloudburst, Skill (vs pysteps), Alerts (CAP preview,
approve, SMS/IVR previews). Click map → point countdown.
/method explainers; /status per-stage latency and data completeness.
Responsive; WCAG AA; reduced-motion support.

PART D — QUALITY: tests for fusion, cloudburst, countdowns, CAP, weights;
no invented metrics; README + DEMO_SCRIPT kept up to date; `make demo`
runs INDIA-SIM offline.

PART E — PHASES: 1 adapters + INDIA-SIM · 2 QC/fusion + pysteps ·
3 CI, hazards, tracking, countdowns · 4 blending, ML, verification ·
5 API, WebSocket, replay, alerts · 6 dashboard · 7 polish.
Start with Phase 1. Ask before downloading anything larger than 2 GB.
```
