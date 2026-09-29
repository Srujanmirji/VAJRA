# Architecture

## Components

| Component | Responsibility | Technology |
|---|---|---|
| Stream ingest | Read radar volumes, INSAT HDF5, lightning strokes; track latency | Python, message queue (Kafka/Redis), wradlib / Py-ART, h5py |
| Fusion grid | QC, regrid to 1 km on a 5-minute clock, coverage mask | xarray, numpy, scipy |
| CI detector | Satellite cloud-top cooling → new-storm probability | numpy, scikit-image |
| Nowcast engines | PySTEPS optical flow + STEPS ensemble; multi-source ML (0–2 h) | pysteps, PyTorch |
| Blending | Skill-weighted blend with the latest NWP (2–6 h); NWP only read | numpy |
| Hazard diagnostics | Lightning, hail, downburst outflow, cloudburst, initiation | numpy, scipy.ndimage |
| Tracking & countdowns | Cell tracking, arrival-time distributions, live countdowns | scipy |
| Alert API | REST + WebSocket, CAP 1.2 generation, approval workflow | FastAPI |
| Dashboard | GIS console with countdowns, hazards, skill, alerts | Next.js, MapLibre GL |
| Storage | Runs, cells, alerts, verification | PostgreSQL + PostGIS |

## Data flow (every 5 minutes)

1. New radar volume arrives → ingest timestamp recorded.
2. QC and regrid; merge latest IR frame and lightning strokes.
3. CI detection on IR; nowcast ensemble; blend with latest NWP.
4. Hazard diagnostics; cell tracking; countdowns for configured places.
5. Publish via WebSocket; generate CAP drafts for warning-level hazards.
6. Log per-stage timings against the ≤5-minute latency target.

## Deployment

- **Development / demo:** Docker Compose (db, api, web), replay mode.
- **Pilot:** one radar + INSAT + lightning on a single GPU server.
- **National:** one worker per radar group; results merged into a national mosaic.
