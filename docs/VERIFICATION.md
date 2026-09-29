# Verification

| Question | Metric |
|---|---|
| Are storm areas forecast correctly? | CSI, POD, FAR at reflectivity / rain thresholds |
| At what scale is it skilful? | Fractions Skill Score by neighbourhood and lead |
| Are hazard probabilities reliable? | Brier score, reliability diagrams |
| How much lead time is gained? | Lead where skill drops below threshold, vs PySTEPS baseline |
| Are countdowns accurate? | Share of arrivals inside the window; timing error |
| Is it fast enough? | Per-stage and end-to-end latency vs the 5-minute target |

**Protocol:** evaluate on held-out events; report results by hazard and lead time; compare every model against the PySTEPS baseline; publish losses as well as gains.
