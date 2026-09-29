## Description
Briefly explain the changes introduced in this Pull Request.

## Problem Statement & Phase Alignment
- [ ] Problem Statement 26084 (Convective scale nowcasting 0–6 h)
- [ ] Phase 1–2: Ingest, QC & 1 km Fusion Grid
- [ ] Phase 3: Physical Hazard Engines (Hail, Downburst, Cloudburst, Lightning)
- [ ] Phase 4: Blending & Verification
- [ ] Phase 5: REST API & CAP Alerts
- [ ] Phase 6: Next.js Forecaster Console & Vercel
- [ ] Phase 7: Documentation & Testing

## Scientific & Honesty Compliance
- [ ] Every metric displayed is computed, never invented.
- [ ] Proper provenance (`LIVE` / `REPLAY` / `SIMULATED`) is attached.
- [ ] NWP models remain strictly read-only.
- [ ] Forecaster sign-off workflow preserved for CAP 1.2 alerts.

## Testing Checklist
- [ ] All backend pytest unit tests pass (`make test`).
- [ ] Next.js frontend builds without errors (`npm run build`).
