# VAJRA — Complete Documentation Index

This directory contains the complete technical, scientific, operational, and presentation library for **VAJRA (वज्र)** (Smart India Hackathon 2026, Problem Statement 26084, NCMRWF / Ministry of Earth Sciences).

---

## 📚 Master Document Catalog

### 1. Reports & Official Publications
| Document | Format | Description |
|---|---|---|
| [Detailed Technical Report (PDF)](report/VAJRA_Detailed_Report.pdf) | PDF (1.7 MB) | Comprehensive technical report covering system architecture, mathematical methods, hazard engines, pilot plan, risks, and references |
| [Report Markdown Source](report/report.md) | Markdown | Source document for the formal technical report |
| [Report Typography & CSS](report/report.css) | CSS | Print and digital styling sheet for report rendering |

---

### 2. Scientific & Meteorological Research (`docs/research/`)
| Document | Description |
|---|---|
| [Literature Survey](research/LITERATURE_SURVEY.md) | Comprehensive review of 20+ foundational papers: optical flow (Lucas-Kanade, PySTEPS), stochastic cascades (STEPS), generative deep learning (DGMR, NowcastNet, Earthformer), satellite CI (Mecikalski & Bedka), and benchmark comparison with SWIRLS-2, WDSS-II, and INCA |
| [Meteorological Foundations](research/METEOROLOGICAL_FOUNDATIONS.md) | Atmospheric physics of Indian deep convection: pre-monsoon Nor'westers (Kalbaishakhi), Himalayan orographic cloudburst dynamics, downburst microphysics, and non-inductive lightning charging |
| [Research Notes](research/PS26084_RESEARCH_NOTES.md) | Evaluator-safe research summary, physical constraints, and initial evidence |

---

### 3. Architecture, Engineering & Methodology
| Document | Description |
|---|---|
| [System Architecture](ARCHITECTURE.md) | Architectural topology, microservice interactions, data flow, and 5-minute cycle SLA timing budgets |
| [Scientific Methodology](METHODS.md) | In-depth mathematical formulations: Hitschfeld-Bordan attenuation, $Z = 300 R^{1.4}$, Satellite CI cooling, Waldvogel hail POH/MESH, Doppler downburst dipoles, IMD cloudburst clusters, and Schultz $2\sigma$ lightning jump |
| [Verification Protocol](VERIFICATION.md) | Mathematical definitions and empirical benchmark tables: CSI, POD, FAR, FSS across scales, Brier score, and verified **+18 min lead-time gain** |
| [REST & WebSocket API Reference](API.md) | Full schemas, parameters, and response payloads for all 14 REST endpoints, WebSocket `/ws/cycle`, and CAP alert workflows |
| [Data Sources & Sensors](DATA_SOURCES.md) | Ingest specifications for IMD DWR, MOSDAC INSAT-3DS, lightning networks, NWP, and intellectual property terms |
| [Operational Roadmap](ROADMAP.md) | Gantt chart and milestone exit criteria spanning Hackathon prototype, Regional Operational Pilot, and National Scale |

---

### 4. Presentation & Executive Briefings (`docs/presentation/`)
| Document | Format | Description |
|---|---|---|
| [SIH Presentation Deck (PDF)](presentation/VAJRA_SIH2026_26084.pdf) | PDF (1.0 MB) | Formal SIH 2026 idea-submission slide deck |
| [Master Slide Deck Notes](presentation/SLIDE_DECK.md) | Markdown | 12-slide layout, key talking points, time stamps, speaker notes, and anticipated jury Q&A |
| [Executive Briefing Memo](presentation/EXECUTIVE_ONE_PAGER.md) | Markdown | High-level 1-page briefing memorandum for NCMRWF and MoES leadership |
| [3-Minute Demo Pitch Script](DEMO_SCRIPT.md) | Markdown | Word-for-word, 180-second live demonstration script with exact button clicks and screen cues |

---

### 5. Operations & Production Deployment
| Document | Description |
|---|---|
| [Operational Forecaster Manual (SOP)](OPERATIONAL_MANUAL.md) | Standard Operating Procedures for IMD forecasters on duty, shift handover checklists, alert approval protocols, and sensor contingency plans |
| [Deployment & Engineering Guide](DEPLOYMENT_GUIDE.md) | Linux hardware requirements, Docker Compose, Kubernetes cluster manifests, radar SFTP network ingest, and security hardening |

---

## 🖼️ Architectural & Illustrative Figures (`docs/figures/`)

| Figure | Description |
|---|---|
| ![Pipeline](figures/pipeline.png) | End-to-end multi-sensor ingest, QC, hazard calculation, and dissemination pipeline |
| ![Architecture](figures/system_architecture.png) | High-level system architecture and microservices communication flow |
| ![Nowcast Map](figures/nowcast_map_illustrative.png) | Illustrative multi-hazard nowcast map with arrival vectors and confidence bands |
| ![Blend Weights](figures/blend_weights_schematic.png) | Schematic of observation-to-NWP sigmoid weight transition over 0–6 h lead times |
