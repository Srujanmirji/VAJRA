# VAJRA REST & WebSocket API Reference (`/api/v1`)

The VAJRA backend exposes a high-performance FastAPI service designed for sub-second responses, real-time WebSocket cycle streaming, and integration with National Disaster Management Authority (NDMA) alerting pipelines.

Base URL: `http://localhost:8000/api/v1`

---

## 📡 Endpoints Overview

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Service health, active region, team metadata |
| `GET` | `/sources` | Real-time ingest health, latencies, and valid pixel coverage |
| `GET` | `/cycle/latest` | Latest 5-minute nowcast cycle summary with stage-by-stage timings |
| `GET` | `/fields/{type}` | 2D georeferenced scalar field matrices (dBZ, mm/h, Tb, lightning, hazards) |
| `GET` | `/cells` | Tracked storm cells with centroid, velocity, area, sparklines, and forecast tracks |
| `GET` | `/cells/{id}` | Detailed properties for an individual tracked convective cell |
| `GET` | `/countdowns` | Probabilistic arrival countdowns for configured target locations |
| `GET` | `/hazards` | Active severe convective hazard zones (Hail, Downburst, Cloudburst, Lightning) |
| `GET` | `/confidence-table` | Forecaster confidence levels derived from empirical verification |
| `GET` | `/alerts` | OASIS CAP 1.2 XML bulletins with approval status and multi-lingual templates |
| `POST` | `/alerts/{id}/approve` | Forecaster authorization to approve a candidate alert for broadcast |
| `POST` | `/alerts/{id}/reject` | Forecaster rejection with recorded operational rationale |
| `GET` | `/verification` | CSI, POD, FAR, FSS by scale, Brier score, and lead-time gain curves |
| `POST` | `/replay/step` | Advance replay stream by exactly one 5-minute cycle |
| `POST` | `/replay/speed` | Set replay playback speed multiplier (`1.0`, `5.0`, `10.0`, `30.0`, `60.0`) |
| `POST` | `/replay/pause` | Pause continuous replay stream |
| `POST` | `/replay/start` | Resume continuous replay stream |
| `WS` | `/ws/cycle` | Asynchronous WebSocket push updates on every new cycle |

---

## 🔍 Detailed Endpoint Documentation

### 1. System Health
```http
GET /api/v1/health
```
**Response:**
```json
{
  "status": "healthy",
  "system": "VAJRA (वज्र) Real-Time Convective Nowcasting",
  "team": "CodeX_2026",
  "problem_statement": "26084 (Convective scale nowcasting 0-6 h)",
  "label": "Guidance for IMD forecasters — not a public warning",
  "active_region": "kolkata",
  "available_regions": ["kolkata", "uttarakhand", "delhi", "mumbai", "bengaluru"]
}
```

---

### 2. Multi-Sensor Sources Health
```http
GET /api/v1/sources?region=kolkata
```
**Response:**
```json
{
  "region": "kolkata",
  "provenance": "REPLAY (Kolkata Nor'wester Sequence)",
  "label": "Guidance for IMD forecasters — not a public warning",
  "sources": [
    {
      "id": "radar",
      "name": "VECC Kolkata (S-Band DWR)",
      "type": "Doppler Weather Radar (Reflectivity + Radial Velocity)",
      "latency_seconds": 12.0,
      "coverage_pct": 99.4,
      "status": "LIVE / SYNCHRONIZED"
    },
    {
      "id": "satellite",
      "name": "INSAT-3DS / 3DR (TIR-1 10.8µm)",
      "type": "Geostationary Infrared Imagery",
      "latency_seconds": 45.0,
      "coverage_pct": 100.0,
      "status": "SYNCHRONIZED (MOSDAC format)"
    },
    {
      "id": "lightning",
      "name": "Ground Lightning Detection Network / GLM",
      "type": "Total Lightning Strokes (CG + IC)",
      "latency_seconds": 5.0,
      "coverage_pct": 100.0,
      "status": "REAL-TIME STREAM"
    },
    {
      "id": "nwp",
      "name": "IMD-HRRR / NCUM-R Operational (Read-Only)",
      "type": "Numerical Weather Prediction (0-6h Blend)",
      "latency_seconds": 0.0,
      "coverage_pct": 100.0,
      "status": "LATEST_CYCLE_READ_ONLY"
    }
  ]
}
```

---

### 3. Arrival Countdowns
```http
GET /api/v1/countdowns?region=kolkata&place=Kolkata
```
**Response:**
```json
{
  "region": "kolkata",
  "provenance": "REPLAY",
  "countdowns": [
    {
      "place_name": "Kolkata (NSCBI Airport / Alipore)",
      "place_code": "CCU",
      "place_type": "AIRPORT_METRO",
      "lat": 22.65,
      "lon": 88.45,
      "approaching": true,
      "countdown_seconds": 2052,
      "countdown_display": "34:12",
      "window_display": "35–55 min",
      "window_min": [35, 55],
      "probability_pct": 70.0,
      "threat_severity": "SEVERE",
      "primary_hazard": "Hail + Downburst Outflow"
    }
  ]
}
```

---

### 4. Gridded Field Matrices
```http
GET /api/v1/fields/{field_type}?lead=30&region=kolkata&downsample=2
```
Supported `field_type`:
- `reflectivity` (dBZ)
- `rain_rate` (mm/h)
- `ir_temperature` (Kelvin)
- `lightning_density` (strokes / km²)
- `hail_prob` (POH %)
- `downburst_prob` (0 to 1.0)
- `cloudburst_cluster` (binary cluster mask)
- `convective_initiation` (cooling rate K/15m)

**Response:**
```json
{
  "field_type": "reflectivity",
  "lead_minutes": 30,
  "provenance": "REPLAY",
  "confidence": "HIGH (Radar dominant)",
  "timestamp": "2026-05-15T15:30:00Z",
  "unit": "dBZ",
  "min_value": -32.0,
  "max_value": 56.4,
  "bounds": {
    "lat_min": 21.3,
    "lat_max": 24.0,
    "lon_min": 87.0,
    "lon_max": 89.8,
    "ny": 150,
    "nx": 150
  },
  "data": [[...]],
  "radar_coverage_mask": [[...]],
  "label": "Guidance for IMD forecasters — not a public warning"
}
```

---

### 5. Common Alerting Protocol (CAP 1.2) Bulletins
```http
GET /api/v1/alerts?region=kolkata
```
**Response:**
```json
{
  "alerts": [
    {
      "alert_id": "VAJRA-ALERT-KOL-20260515-001",
      "event": "Severe Thunderstorm, Hail & Downburst Wind",
      "headline": "Severe Thunderstorm with Hail & Downburst winds detected approaching Kolkata / Howrah",
      "severity": "Severe",
      "urgency": "Expected",
      "probability": 0.85,
      "onset": "2026-05-15T15:45:00Z",
      "polygon": [[22.95, 88.15], [22.80, 88.55], [22.45, 88.40], [22.60, 88.00], [22.95, 88.15]],
      "approval_status": "PENDING_IMD_APPROVAL",
      "approved_by": null,
      "approved_at": null,
      "cap_xml": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<alert xmlns=\"urn:oasis:names:tc:emergency:cap:1.2\">...</alert>",
      "sms": {
        "en": "IMD-VAJRA ALERT: Severe thunderstorm approaching Kolkata/Howrah with hail and winds exceeding 70 km/h in 35-55 mins. Take shelter.",
        "hi": "आईएमडी-वज्र चेतावनी: अगले 35-55 मिनट में कोलकाता/हावड़ा में ओलावृष्टि और 70 किमी/घंटा से अधिक हवाओं के साथ भयंकर आंधी की संभावना।",
        "bn": "আইএমডি-বজ্র সতর্কতা: আগামী ৩৫-৫৫ মিনিটের মধ্যে কলকাতা ও হাওড়ায় শিলাবৃষ্টি ও ৭০ কিমি/ঘণ্টার বেশি বেগে কালবৈশাখী ঝড়ের আশঙ্কা। নিরাপদ স্থানে থাকুন।",
        "kn": "ಐಎಂಡಿ-ವಜ್ರ ಎಚ್ಚರಿಕೆ: ಮುಂದಿನ 35-55 ನಿಮಿಷಗಳಲ್ಲಿ ಕೋಲ್ಕತ್ತಾ/ಹೌರಾದಲ್ಲಿ ಆಲಿಕಲ್ಲು ಮಳೆ ಮತ್ತು ಬಿರುಗಾಳಿ ಸಹಿತ ತೀವ್ರ ಗುಡುಗು-ಮಿಂಚಿನ ಸಾಧ್ಯತೆ."
      },
      "ivr": {
        "en": "This is an urgent weather bulletin from the India Meteorological Department...",
        "hi": "यह भारत मौसम विज्ञान विभाग से एक आवश्यक मौसम बुलेटिन है...",
        "bn": "এটি ভারতীয় আবহাওয়া অধিদপ্তর থেকে একটি জরুরী সতর্কবার্তা...",
        "kn": "ಇದು ಭಾರತೀಯ ಹವಾಮಾನ ಇಲಾಖೆಯಿಂದ ತುರ್ತು ಹವಾಮಾನ ಮುನ್ಸೂಚನೆ..."
      }
    }
  ]
}
```

#### Approve Alert
```http
POST /api/v1/alerts/{alert_id}/approve?region=kolkata&forecaster_id=IMD_FORECASTER_KOLKATA_04
```
**Response:**
```json
{
  "status": "APPROVED",
  "alert_id": "VAJRA-ALERT-KOL-20260515-001",
  "approved_by": "IMD_FORECASTER_KOLKATA_04"
}
```

---

### 6. WebSocket Streaming (`/ws/cycle`)
Connect to `ws://localhost:8000/ws/cycle`.
On every completed 5-minute cycle, the backend pushes:
```json
{
  "type": "CYCLE_UPDATE",
  "timestamp": "2026-05-15T15:35:00Z",
  "step_index": 4,
  "region": "kolkata",
  "active_cells": 3,
  "active_alerts": 1
}
```
Client can send keepalive ping or region switch command:
```json
{
  "action": "switch_region",
  "region": "uttarakhand"
}
```
