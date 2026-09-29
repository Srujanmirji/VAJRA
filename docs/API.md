# API (FastAPI, `/api/v1`)

| Method | Endpoint | Returns |
|---|---|---|
| GET | `/health` | Service status |
| GET | `/sources` | Source status and latency |
| GET | `/cycle/latest` | Latest cycle metadata and stage timings |
| GET | `/fields/{type}?lead=` | Gridded field (reflectivity, IR, hazard probability) |
| GET | `/cells` · `/cells/{id}` | Tracked cells, motion, trend, hazards |
| GET | `/countdowns?place=` | Window, probability, countdown to window start |
| GET | `/hazards?type=&lead=` | Hazard probabilities; downburst outflow m/s |
| GET | `/confidence-table` | Per-hazard confidence by lead time |
| GET | `/alerts` · POST `/alerts/{id}/approve` | CAP alerts and approval |
| GET | `/verification` | Skill metrics |
| WS | `/ws/cycle` | Push updates each cycle |

Example countdown response:

```json
{
  "place": "Kolkata",
  "window_min": [35, 55],
  "p_arrival_60min": 0.70,
  "countdown_seconds": 2052,
  "confidence": "high (0-1 h)",
  "provenance": "SIMULATED",
  "label": "Guidance for IMD forecasters"
}
```
