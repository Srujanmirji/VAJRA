# VAJRA (वज्र) — Pitch Deck & Slide Notes
**Smart India Hackathon 2026 · Problem Statement 26084**  
*Convective Scale Nowcasting for Thunderstorms, Hail & Cloudbursts (0–6 h)*  
**NCMRWF / Ministry of Earth Sciences · Team CodeX_2026 (ID: 159951)**

---

## 📽️ Slide Overview & Master Outline

```
Slide 1: Title & The Mission Statement
Slide 2: The Operational Dilemma (Why Nowcasting is Hard in India)
Slide 3: The VAJRA Solution: Synchronized 3-Source Fusion (1 km Grid)
Slide 4: Early Convective Initiation (Detecting Storms Before First Echo)
Slide 5: Severe Hazard Diagnostic Engines (Hail, Downburst, Cloudburst, Lightning)
Slide 6: Cell Tracking & Live Arrival Countdowns (Windows & Probabilities)
Slide 7: Physics-Grounded Lead-Time Blending (0–6 h & NWP Hand-off)
Slide 8: Mission Control Dashboard (Interactive Cockpit Demonstration)
Slide 9: Multi-Lingual CAP 1.2 Dissemination (Forecaster Sign-Off)
Slide 10: Empirical Verification & Usable Lead-Time Gain (+18 Minutes)
Slide 11: Deployment Architecture & Mission Mausam Alignment
Slide 12: Team CodeX_2026 & Concluding Vision
```

---

## Slide 1: Title & Operational Mission
- **Slide Title:** **VAJRA (वज्र)** — Multi-Source Convective Nowcasting System for India (0–6 h)
- **Sub-header:** Convective Scale Nowcasting for Thunderstorms, Hail & Cloudbursts (0–6 h)
- **Ministry / Sponsor:** National Centre for Medium Range Weather Forecasting (NCMRWF) & Ministry of Earth Sciences (MoES)
- **Team:** CodeX_2026 (Team ID: 159951)
- **Key Badge:** *Guidance for IMD forecasters — not an autonomous public siren system.*
- **Speaker Notes:**  
  *"Good morning, esteemed jury members and scientists from NCMRWF and IMD. We are Team CodeX_2026, presenting VAJRA—a real-time, multi-source convective nowcasting system that bridges the critical gap between raw radar pulses and actionable, life-saving disaster warnings."*

---

## Slide 2: The Operational Dilemma
- **Slide Title:** Why Nowcasting is Exceptionally Hard in India
- **Visuals:** 3 Problem Cards
  1. *Radar Blind Spots:* Coverage gaps across interior India and mountain shadows; pure radar advection fails when storms exit the Doppler cone.
  2. *Explosive Convective Growth:* 25–35 minutes from clear sky to 55+ dBZ severe Nor'westers; optical flow cannot extrapolate storm intensification.
  3. *Complex Himalayan Orography:* Beam blockage behind high ridges; rapid cloudbursts ($\ge 100\text{ mm/h}$) in narrow catchments.
- **Speaker Notes:**  
  *"In tropical India, deep convection operates on timescales faster than numerical models can compute. Meanwhile, pure radar extrapolation blindly shifts past motion and misses rapid in-situ intensification or collapse. No single sensor can solve this alone."*

---

## Slide 3: The 3-Source Fusion Architecture
- **Slide Title:** Synchronized Ingest on a Unified 1 km Grid
- **Visuals:** 3 Sensor Feeds into 1 km Cartesian Matrix
  - **Doppler Weather Radar (DWR):** 1 km reflectivity ($Z$) + radial velocity ($V$) | S/C/X Bands | Speckle & Clutter Filtered | Hitschfeld-Bordan Attenuation Corrected.
  - **INSAT-3DR / 3DS Satellites:** 4 km Thermal Infrared (TIR-1 10.8 µm) | Full Subcontinent Surveillance | MOSDAC Calibrated.
  - **Ground Lightning Network:** Point stroke coordinates (CG + IC) | $<20\text{ s}$ stream latency | Updraft acceleration proxy.
- **Speaker Notes:**  
  *"VAJRA synchronizes Doppler radars, geostationary INSAT infrared, and ground lightning strokes onto a unified 1 km Cartesian grid every 5 minutes. Dual-radar overlap is blended using inverse distance weighting, while areas outside radar coverage gracefully degrade to satellite-lightning guidance."*

---

## Slide 4: Pre-Echo Convective Initiation
- **Slide Title:** Catching the Storm 20 Minutes Before First Radar Echo
- **Visuals:** Infrared Cooling Diagram vs Radar Reflectivity Graph
  - Criterion: $\frac{dT_b}{dt} \le -4.0\text{ K / 15 min}$ with $T_b < 265\text{ K}$ and $Z < 30\text{ dBZ}$.
  - Outcome: Convective initiation flagged 15–25 minutes prior to severe radar echo formation.
- **Speaker Notes:**  
  *"Traditional systems wait for raindrops to grow large enough to reflect radar beams. By that time, severe downdrafts may already be developing aloft. VAJRA's satellite diagnostic engine detects rapid cloud-top thermal cooling, alerting forecasters 20 minutes before first echo."*

---

## Slide 5: Four Physical Hazard Diagnostic Engines
- **Slide Title:** Physics-Grounded Hazard Diagnostics (Never Conflated)
- **Visuals:** 4 Diagnostic Cards with Mathematical Formulas
  - **Hail Engine (Waldvogel):** Height of 45 dBZ core above freezing level $\Delta H = H_{45} - H_0$. Computes POH (%) and MESH ($\ge 25\text{ mm}$ severe hail).
  - **Downburst Divergence:** Radial velocity dipole $|\Delta v| \ge 20\text{ m/s}$ ($72\text{ km/h}$) within $\le 10\text{ km}$.
  - **IMD Cloudburst Cluster:** Rainfall rate $\ge 100\text{ mm/h}$ over contiguous spatial cluster $\ge 20\text{ km}^2$.
  - **Lightning Flash Jump:** Schultz $2\sigma$ algorithm ($\Delta f \ge 10\text{ flashes/min}$ surge).
- **Speaker Notes:**  
  *"VAJRA isolates distinct convective microphysical signatures. We do not output generic 'bad weather' indices. Forecasters see separate probabilities and severity metrics for hail, downburst wind, cloudburst, and lightning surges."*

---

## Slide 6: Cell Tracking & Live Arrival Countdowns
- **Slide Title:** Scientifically Honest Arrival Windows (Not Single Numbers)
- **Visuals:** Map with Storm Vector, 15/30/45/60 min Uncertainty Ellipses, and Countdown Table
  - Real Example: *"Kolkata (NSCBI Airport) · starts in 34:12 · window 35–55 min · 70% probability"*.
  - Rationale: Atmospheric turbulence and cell steering make exact point-in-time predictions dishonest.
- **Speaker Notes:**  
  *"Saying a thunderstorm will hit an airport at exactly 17:42 is scientifically dishonest. VAJRA computes arrival distributions across a 16-member ensemble, providing a 10th-to-90th percentile window and calibrated probability for actionable airport and emergency decisions."*

---

## Slide 7: Physics-Grounded Lead-Time Blending (0–6 h)
- **Slide Title:** Honest Lead Times & Seamless NWP Blending
- **Visuals:** Sigmoid Weight Curve ($w_{\text{radar}}$ dropping 1.0 $\rightarrow$ 0.0; $w_{\text{nwp}}$ rising 0.0 $\rightarrow$ 1.0)
  - **0–1 h (High Confidence):** Radar advection + lightning jump dominant.
  - **1–2 h (Medium Confidence):** STEPS 16-member stochastic ensemble + ML U-Net.
  - **2–6 h (Lower Confidence):** Observation skill fades; IMD-HRRR / NCUM-R smoothly takes over.
  - Rule: NWP is strictly read-only and never modified on-demand.
- **Speaker Notes:**  
  *"Radar advection has a physical predictability horizon of roughly 2 hours. VAJRA smoothly and mathematically fades observation weights down to zero, letting high-resolution NWP models take over regional guidance. Zero abrupt discontinuities."*

---

## Slide 8: Mission Control Dashboard
- **Slide Title:** Production Forecaster Mission Control Console (`/console`)
- **Visuals:** Screenshot of Console UI
  - Interactive WebGL/SVG radar map with pan/zoom and click-to-pin.
  - 0–360 min lead time scrubber with dynamic confidence badges.
  - Active storms panel with real-time dBZ sparklines and trend indicators.
  - Multi-layer switchboard (dBZ, rain rate, IR, lightning, CI, hail, downburst).
- **Speaker Notes:**  
  *"Built with Next.js 14 and Tailwind CSS, our mission control cockpit was designed specifically for dark radar operational rooms, giving forecasters instant situational awareness with sub-second responsiveness."*

---

## Slide 9: Forecaster Sign-Off & Multi-Lingual CAP 1.2 Bulletins
- **Slide Title:** Official Dissemination via OASIS CAP 1.2
- **Visuals:** CAP XML Modal + Local Language Tabs (English, Hindi, Bengali, Kannada)
  - Approval Status: `PENDING_IMD_APPROVAL` $\rightarrow$ Forecaster Clicks Approve $\rightarrow$ `APPROVED`.
  - Dissemination Targets: NDMA SACHET, DAMINI, SMS/IVR gateways, State Disaster Management Authorities.
- **Speaker Notes:**  
  *"When a hazard threshold is breached, VAJRA generates an OASIS CAP 1.2 XML bulletin with precise polygon coordinates. In compliance with MoES protocol, it requires forecaster sign-off. Once approved, localized SMS and voice templates are instantly ready in English, Hindi, Bengali, and Kannada."*

---

## Slide 10: Empirical Verification & +18 Minute Gain
- **Slide Title:** Verified Skill Metrics (Computed on Real Replay Data)
- **Visuals:** CSI Curve Comparison Chart
  - VAJRA vs PySTEPS Baseline: Maintains $\text{CSI} \ge 0.40$ out to 68 minutes vs 50 minutes for baseline.
  - Usable Lead-Time Gain: **+18 minutes**.
  - All metrics computed live from contingency tables ($Z \ge 35\text{ dBZ}$) across the Kolkata Nor'wester sequence.
- **Speaker Notes:**  
  *"Every metric in our verification tab is computed live. VAJRA delivers an average +18 minute lead-time gain over optical flow baselines, with 86% of storm arrivals occurring strictly within our predicted arrival windows."*

---

## Slide 11: Deployment Architecture & Mission Mausam Alignment
- **Slide Title:** Seamless Deployment Pathway
- **Visuals:** 3-Phase Roadmap (Prototype $\rightarrow$ Pilot $\rightarrow$ National)
  - End-to-end 5-min cycle runtime: **~2.2 seconds** (well within the 60 s SLA).
  - Native support for standard ODIM HDF5 radar formats and MOSDAC HDF5.
  - Direct alignment with MoES **Mission Mausam** national radar expansion.
- **Speaker Notes:**  
  *"VAJRA requires no exotic hardware: its entire 5-minute cycle finishes in under 3 seconds. It is fully containerized and ready for pilot deployment at RMC Kolkata and Dehradun during the upcoming 2027 Nor'wester season."*

---

## Slide 12: Conclusion & Team CodeX_2026
- **Slide Title:** Protecting Lives Across India
- **Summary Statement:** Combining speed, physical rigor, multi-sensor synergy, and absolute scientific honesty.
- **Live Demo Link:** `http://localhost:3000/console`
- **GitHub Repository:** `https://github.com/Srujanmirji/VAJRA.git`
- **Speaker Notes:**  
  *"VAJRA gives India's forecasters the tools they need to see the storm before it arrives. Thank you for your time and guidance. We look forward to your questions."*
