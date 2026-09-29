# Production Architecture & Deployment

VAJRA is designed as an asynchronous, modular, and fault-tolerant pipeline capable of executing full 5-minute ingest-to-alert cycles in under 45 seconds on standard hardware.

---

## 🏗️ Architectural Topology

```mermaid
flowchart TB
    subgraph INGEST_LAYER ["Ingest & Quality Control"]
        DWR["DWR Receiver<br/>(ODIM HDF5)"]
        SAT["MOSDAC Receiver<br/>(INSAT-3DR/3DS)"]
        LTG["Lightning Stream<br/>(TOA Strokes)"]
        NWP_IN["NWP Reader<br/>(IMD-HRRR NetCDF)"]
        QC_ENG["QC & Attenuation Engine<br/>Speckle · Clutter · Hitschfeld-Bordan"]
        DWR --> QC_ENG
    end

    subgraph FUSION_LAYER ["1 km Fusion Grid"]
        GRID_1KM["Cartesian Grid Projector<br/>IDW Polar-to-Cartesian (1 km)"]
        QC_ENG --> GRID_1KM
        SAT --> GRID_1KM
        LTG --> GRID_1KM
    end

    subgraph COMPUTATION_ENGINE ["Parallel Analytics Pipeline"]
        CI_DET["Convective Initiation<br/>dTb/dt ≤ -4K/15m"]
        HAIL_ENG["Waldvogel Hail<br/>POH · MESH"]
        WIND_ENG["Downburst Dipole<br/>|Δv| ≥ 20 m/s"]
        BURST_ENG["IMD Cloudburst<br/>≥100 mm/h ≥20 km²"]
        TRACK_ENG["Cell Tracker & Countdowns<br/>Connected Components"]
        STEPS_ENG["STEPS 16-Member Ensemble<br/>FFT Scale Cascade"]
        ML_ENG["VajraNowcastUNet<br/>9-Channel Convective Growth"]
        BLEND_ENG["NWP Sigmoid Blender<br/>Radar 1.0 → 0.0 (0-6h)"]
        
        GRID_1KM --> CI_DET
        GRID_1KM --> HAIL_ENG
        GRID_1KM --> WIND_ENG
        GRID_1KM --> BURST_ENG
        GRID_1KM --> STEPS_ENG
        GRID_1KM --> ML_ENG
        STEPS_ENG --> BLEND_ENG
        ML_ENG --> BLEND_ENG
        NWP_IN --> BLEND_ENG
        BLEND_ENG --> TRACK_ENG
        HAIL_ENG --> TRACK_ENG
        WIND_ENG --> TRACK_ENG
        BURST_ENG --> TRACK_ENG
    end

    subgraph SERVING_LAYER ["FastAPI & WebSocket Server"]
        API["FastAPI Engine (/api/v1)<br/>Fields · Countdowns · Verification"]
        WS["WebSocket Hub (/ws/cycle)<br/>Real-Time Broadcasts"]
        CAP_GEN["CAP 1.2 XML Generator<br/>Multi-Lingual SMS/IVR"]
        TRACK_ENG --> API
        TRACK_ENG --> CAP_GEN
        TRACK_ENG --> WS
    end

    subgraph CLIENT_LAYER ["Forecaster Mission Control"]
        WEB["Next.js 14 Web Application<br/>Interactive Radar Map · Scrubber"]
        API --> WEB
        WS --> WEB
        WEB -->|Forecaster Sign-Off| CAP_GEN
    end
```

---

## ⏱️ 5-Minute Cycle SLA Breakdown

Target latency: **< 60.0 seconds** total execution per 5-minute radar scan cycle.

| Stage Name | Component | Typical Duration | Maximum Budget |
|---|---|---|---|
| **Stage 1** | Ingest & Multi-Sensor Synchronization | ~180 ms | 5,000 ms |
| **Stage 2** | Speckle, Clutter QC & Hitschfeld-Bordan Attenuation | ~320 ms | 5,000 ms |
| **Stage 3** | IDW Projection onto 1 km Fusion Grid | ~240 ms | 5,000 ms |
| **Stage 4** | Satellite Convective Initiation (CI) Detection | ~85 ms | 2,000 ms |
| **Stage 5** | Physical Hazards (Hail, Downburst, Cloudburst, Lightning) | ~195 ms | 5,000 ms |
| **Stage 6** | Connected-Component Tracking & Arrival Countdowns | ~140 ms | 3,000 ms |
| **Stage 7** | STEPS 16-Member Ensemble & PyTorch ML U-Net | ~850 ms | 25,000 ms |
| **Stage 8** | NWP Sigmoid Blending (0–6 h) | ~110 ms | 5,000 ms |
| **Stage 9** | CAP 1.2 XML Generation & Multi-Lingual Templates | ~45 ms | 2,000 ms |
| **Stage 10**| WebSocket Broadcast to Active Forecasters | ~12 ms | 1,000 ms |
| **Total** | **End-to-End Pipeline Loop** | **~2,177 ms (~2.2 s)** | **< 60,000 ms (60 s)** |

All operations run well within the operational SLA budget, leaving ample headroom for national multi-radar mosaics.

---

## 🐳 Containerization & Deployment Modes

### 1. Development & Hackathon Demo Mode
Run directly on local workstation via native Python and Node.js:
```bash
make demo
```

### 2. Standalone Docker Compose Deployment
```bash
docker compose up --build
```
- Service `api`: Python 3.11 container with OpenCV, PyTorch, PySteps, SciPy, and FastAPI on port `8000`.
- Service `web`: Node 20 container serving Next.js production frontend on port `3000`.

### 3. Operational Pilot Architecture (Single DWR Site)
- Dedicated GPU server (NVIDIA RTX 4090 or A4000) deployed at local Regional Meteorological Centre (RMC Kolkata / Dehradun).
- Direct local S-band / C-band DWR receiver via SFTP / socket connection.
- Direct MOSDAC 15-minute INSAT-3DS stream ingestion.

### 4. National Scaled Deployment (Mission Mausam)
- **Worker Clusters:** One containerized ingest & QC worker per DWR cluster (37+ radar sites across India).
- **National Mosaic Server:** Assembles 1 km composite mosaic across India.
- **Dissemination Gateway:** Direct secure REST API hook into NDMA SACHET, DAMINI lightning app, and State Disaster Management Authorities (SDMA).
