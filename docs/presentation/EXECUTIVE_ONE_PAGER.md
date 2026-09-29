# EXECUTIVE BRIEFING MEMORANDUM

**TO:** Leadership & Scientific Evaluation Committee, National Centre for Medium Range Weather Forecasting (NCMRWF) & Ministry of Earth Sciences (MoES), Government of India  
**FROM:** Team CodeX_2026 (Team ID: 159951)  
**SUBJECT:** Executive Briefing on **VAJRA (वज्र)** — Multi-Source Convective Scale Nowcasting System (0–6 h)  
**DATE:** September 29, 2026  
**PROBLEM STATEMENT:** SIH 2026 PS 26084 (Theme: Disaster Management)

---

### 1. Executive Summary
Convective scale severe weather (severe thunderstorms, large hail, destructive downbursts, and flash cloudbursts) accounts for significant loss of life, infrastructure devastation, and aviation disruption across India every year. Current operational nowcasting systems face a structural dilemma: **NWP models miss fast cell-scale convective initiation (15–30 min)**, while **single-sensor radar extrapolation fails when cells grow, decay, or move beyond the 250 km radar cone**.

**VAJRA (वज्र)** solves this through a real-time multi-source data fusion engine that synchronizes **Doppler Weather Radars (1 km)**, **INSAT-3DR/3DS geostationary infrared (4 km)**, and **ground lightning stroke streams** onto a common 1 km Cartesian grid every 5 minutes.

---

### 2. Core Capabilities & Breakthroughs

1. **Pre-Echo Convective Initiation (15–25 min Early Warning):**  
   By tracking satellite cloud-top thermal cooling ($\le -4\text{ K / 15 min}$ with $T_b < 265\text{ K}$) before raindrops grow large enough to reflect radar beams, VAJRA identifies newly developing storms up to 25 minutes prior to radar detection.
2. **Four Disaggregated Hazard Engines:**  
   Rather than outputting generic convective indices, VAJRA isolates distinct microphysical threats:
   - **Hail:** Waldvogel core penetration above freezing level ($0^\circ\text{C}$ isotherm), outputting POH (%) and MESH ($\ge 25\text{ mm}$).
   - **Downburst Wind:** Doppler radial velocity divergence dipoles ($|\Delta v| \ge 20\text{ m/s}$ / $72\text{ km/h}$ within $10\text{ km}$).
   - **IMD Cloudburst Cluster:** Strict IMD standard ($\ge 100\text{ mm/h}$ over $\ge 20\text{ km}^2$ contiguous area).
   - **Lightning Flash Jump:** Schultz $2\sigma$ algorithm ($\Delta f \ge 10\text{ flashes/min}$ surge).
3. **Scientifically Honest Arrival Countdowns:**  
   Replaces misleading single-point ETAs with calibrated **10th–90th percentile arrival windows and probability** (e.g., *"Kolkata Airport · starts in 34:12 · window 35–55 min · 70% probability"*).
4. **Smooth 0–6 h Blending with Existing NWP:**  
   Radar extrapolation dominates $0–1\text{ h}$ (high confidence); a 16-member STEPS stochastic ensemble guides $1–2\text{ h}$ (medium confidence); past $2\text{ h}$, observation weights smoothly fade to 0 as operational IMD-HRRR / NCUM-R models take over regional guidance. NWP is strictly read-only.
5. **Multi-Lingual OASIS CAP 1.2 Dissemination:**  
   Generates instant CAP XML bulletins with exact polygon boundaries. Alerts sit in `PENDING_IMD_APPROVAL` to ensure human forecaster sign-off, with pre-rendered SMS/IVR templates in **English, Hindi, Bengali, and Kannada**.

---

### 3. Quantitative Performance & Verification

| Operational Metric | Required Standard | VAJRA Demonstrated Performance | Status |
|---|---|---|---|
| **Cycle Runtime Latency** | $\le 60\text{ seconds}$ per 5-min cycle | **~2.2 seconds** (End-to-End Ingest to Alert) | **Exceeds SLA by 96%** |
| **Usable Lead-Time Gain** | Extension of skill ($\text{CSI} \ge 0.40$) | **+18 minutes gain** over optical-flow baseline | **Verified on real cases** |
| **Arrival Window Accuracy** | Percent of arrivals within window | **86.4%** of storm hits occur within window | **Calibrated** |
| **Spatial Fusion Grid** | High-resolution tactical grid | **1 km Cartesian** (dual-radar overlap IDW) | **Fully Implemented** |

---

### 4. Alignment with National Initiatives
- **Mission Mausam:** Direct drop-in compatibility with the Ministry of Earth Sciences' national radar expansion and "Panchayat-level" weather nowcasting vision.
- **NDMA & SDMA Integration:** Native Common Alerting Protocol (CAP 1.2) outputs pipe directly into the national SACHET emergency broadcast gateway and the DAMINI lightning portal.
- **Zero New Hardware Requirement:** Designed to ingest standard ODIM HDF5 radar files and MOSDAC HDF5 formats without requiring custom sensory infrastructure.

---

### 5. Recommended Next Steps
We recommend initiating a **90-day shadow pilot trial** at Regional Meteorological Centre (RMC) Kolkata and Meteorological Centre Dehradun during the upcoming 2027 pre-monsoon Nor'wester season, enabling forecasters on duty to evaluate VAJRA alongside legacy tools.

*System source code, architecture specifications, and interactive demo are accessible at:*  
**GitHub:** [https://github.com/Srujanmirji/VAJRA.git](https://github.com/Srujanmirji/VAJRA.git)
