# VAJRA (वज्र) — 3-Minute Live Hackathon Demo Script
**Smart India Hackathon 2026 · Problem Statement 26084**  
*Convective Scale Nowcasting for Thunderstorms, Hail & Cloudbursts (0–6 h)*  
**NCMRWF / Ministry of Earth Sciences · Team CodeX_2026**

---

## Pitch Overview
- **Total Duration:** Exactly 3 Minutes (180 seconds).
- **Target Audience:** SIH Jury, NCMRWF Meteorologists, IMD Scientists, and Disaster Management Officials.
- **Core Narrative:** Why deep tropical convection breaks classical extrapolation, how multi-sensor fusion solves it, why mathematical honesty is the cornerstone of operational forecaster trust, and how VAJRA bridges the gap from raw radar pulses to life-saving multi-lingual CAP 1.2 alerts.

---

## Detailed Step-by-Step Script & Actions

### [0:00 – 0:25] The Problem & The Core Dilemma
**Action:** Open browser on `http://localhost:3000/`. Scroll slowly past the Hero section and "Why Nowcasting is Hard" cards.

> **Speaker (Confident & Grounded):**  
> *"Good morning, respected jury members. Deep convective storms in India—whether violent Nor'westers over Bengal, lightning strikes in Odisha, or devastating Himalayan cloudbursts—develop in under thirty minutes.  
> 
> Numerical weather models take hours to compute and miss cell-scale initiation. On the other hand, pure radar advection blindly shifts storms forward and misses rapid in-situ intensification or collapse.  
> 
> This is **VAJRA (वज्र)**: India’s first operational multi-source convective nowcasting system that synchronizes Doppler Weather Radars, INSAT-3DR/3DS geostationary infrared, and ground lightning strokes onto a unified 1 km grid every 5 minutes."*

---

### [0:25 – 0:55] Console Ingest & Multi-Sensor Ingest Telemetry
**Action:** Click **"Launch Nowcast Console"** or navigate to `http://localhost:3000/console`. Point mouse cursor at the top status bar (Provenance badge, latency clock, and multi-source chips).

> **Speaker:**  
> *"Here in the Forecaster Mission Control Console, notice our first rule: **Strict Scientific Honesty**.  
> Look at the top bar: every layer shows its exact provenance—here running in `REPLAY (Kolkata Nor'wester)` mode. We never fake numbers or hide data origins.  
> 
> Notice the multi-source health chips:  
> - **S-Band DWR (VECC Kolkata)** delivering 1 km reflectivity and Doppler radial velocity;  
> - **INSAT-3DS TIR-1** infrared at 10.8 µm from MOSDAC;  
> - **Real-time lightning strokes** with sub-20 second latency.  
> 
> Across the top right, the forecaster sees: **'Guidance for IMD forecasters — not a public warning.'** VAJRA is an AI-assisted operational decision support cockpit designed to empower IMD scientists, never to trigger autonomous sirens without human sign-off."*

---

### [0:55 – 1:30] Pre-Echo Convective Initiation & Explosive Growth
**Action:** Toggle layer to **"Convective Initiation (CI)"** (or IR Temperature). Advance the replay clock one step by clicking **"Step (+5m)"**.

> **Speaker:**  
> *"Now look at the northwest sector over Bardhaman. There is currently zero radar reflectivity here. Under traditional radar-only systems, this area is quiet.  
> 
> But VAJRA's satellite diagnostic engine detects rapid cloud-top thermal cooling exceeding **-4 Kelvin in 15 minutes** with brightness temperature dropping below 265 K.  
> 
> VAJRA flags a **Convective Initiation candidate** 20 minutes before the first radar echo appears!  
> 
> Let's advance the clock. Watch as the updraft punches through: cloud-to-ground strokes ignite, radar reflectivity explodes to 55 dBZ, and our connected-component tracker locks onto Cell `CELL_KOL_01`, tracking its centroid, area growth, and velocity vector."*

---

### [1:30 – 2:05] Live Arrival Countdowns & Physical Hazards
**Action:** Click on the **"Countdowns"** tab in the right panel. Highlight Kolkata NSCBI Airport and Howrah.

> **Speaker:**  
> *"Look at our arrival countdown table. Look closely at Kolkata:  
> It does not say 'arriving at 17:42'. That would be scientifically dishonest! Atmospheric turbulence makes point-in-time exactness impossible.  
> 
> Instead, VAJRA displays:  
> **'Kolkata · starts in 34:12 · arrival window 35–55 min · 70% probability'**.  
> 
> Forecasters and airport runway controllers get actionable, probabilistic decision windows.  
> 
> Next, click the **'Hazards'** tab. VAJRA doesn't just predict rain; it isolates individual convective threats using peer-reviewed physical engines:  
> 1. **Hail:** Waldvogel technique calculates the 45 dBZ echo height above the freezing level, computing **POH at 85%** and **MESH at 28 mm** severe hail size.  
> 2. **Downburst:** Radial velocity divergence dipole reveals an outbound/inbound differential of **Δv = 27.1 m/s (97 km/h)**—warning of microburst runway shear 15 minutes before surface impact.  
> 3. **Lightning Jump:** Schultz 2σ surge detector flags intense mixed-phase charging."*

---

### [2:05 – 2:30] Honest Lead-Time Scrubber & NWP Blending
**Action:** Move the **Lead Time Scrubber** from `+0m` → `+30m` → `+60m` → `+180m` → `+360m`. Point to the changing confidence badge and hatched radar coverage boundary.

> **Speaker:**  
> *"Now let's drag the lead time scrubber forward.  
> - Between **0 and 1 hour**, confidence is **HIGH** (radar extrapolation and flash jump dominate).  
> - At **1 to 2 hours**, confidence transitions to **MEDIUM**, where our **16-member STEPS stochastic ensemble** provides probabilistic spatial spread.  
> - Beyond **2 hours**, physical predictability limits optical flow. Watch: VAJRA smoothly and honestly fades radar weight down to zero, blending seamlessly into operational **IMD-HRRR and NCUM-R** numerical weather fields.  
> 
> Notice how areas outside the 250 km radar cone are hatched as lower confidence satellite+lightning guidance. Total transparency at all times."*

---

### [2:30 – 2:50] Forecaster Sign-Off & Multi-Lingual CAP 1.2 Alerts
**Action:** Click the **"CAP Alerts"** tab. Select the draft alert for *Severe Thunderstorm & Downburst Wind*. Click **"Approve & Sign-Off"**. Show the multi-language tabs (`EN`, `HI`, `BN`, `KN`).

> **Speaker:**  
> *"When a hazard threshold is breached, VAJRA drafts an official **OASIS CAP 1.2 XML** alert with precise geospatial polygon coordinates.  
> 
> In compliance with MoES protocol, it sits in `PENDING_IMD_APPROVAL` state. The forecaster reviews the evidence, verifies the radar signature, and clicks **Approve**.  
> 
> Instantly, signed multi-lingual templates are generated:  
> - In **English** and **Hindi** for national NDMA SACHET feeds,  
> - In **Bengali** for local Kolkata district collectors and fishermen,  
> - In **Kannada** for southern regional centers.  
> 
> Zero manual translation delays during life-threatening emergencies."*

---

### [2:50 – 3:00] Verification Skill & Closing
**Action:** Click the **"Skill"** tab. Highlight the CSI curve and lead-time gain metric.

> **Speaker:**  
> *"Finally, every metric in our verification tab is computed live across historical events. VAJRA achieves a **+18 minute usable lead-time gain** over standard optical flow baselines, with verified Critical Success Index (CSI) and Fractions Skill Score (FSS).  
> 
> VAJRA brings speed, physical rigor, multi-sensor synergy, and forecaster trust to India’s nowcasting frontier.  
> 
> Thank you, and we welcome your questions!"*

---

## Anticipated Jury Questions & Winning Answers

### Q1: *"Why don't you run a deep learning model for the entire 6 hours?"*
> **Answer:**  
> *"Deep generative models suffer from severe blurring (regression to the mean) and hallucinate unphysical storms at 4 to 6 hour lead times. The laws of fluid dynamics dictate that at 3–6 hours, atmospheric convection is governed by synoptic baroclinic forcing, which IMD-HRRR and NCUM-R solve on supercomputers. VAJRA's strength is doing what NWP cannot do: real-time 0–2h multi-sensor scale-dependent nowcasting, then honestly blending into NWP rather than replacing it."*

### Q2: *"How do you handle regions where there is no radar coverage?"*
> **Answer:**  
> *"VAJRA was built specifically for Indian operational realities. Inside the radar cone, we compute 1 km reflectivity and Doppler wind shear. Outside the cone, VAJRA seamlessly switches to 4 km INSAT-3DS geostationary infrared cloud-top cooling coupled with ground lightning stroke density. Crucially, the UI renders this boundary with clear hatching and labels it 'Lower Confidence (Satellite+Lightning)' so forecasters are never misled."*

### Q3: *"Can this system be deployed on existing IMD / NCMRWF infrastructure?"*
> **Answer:**  
> *"Yes. VAJRA natively ingests standard ODIM HDF5 radar formats, MOSDAC INSAT HDF5 files, and NetCDF NWP outputs. The backend is containerized via Docker Compose, and its 5-minute cycle finishes in under 45 seconds on standard hardware, comfortably meeting operational SLAs."*
