# VAJRA backend

Starter implementation of the core, testable logic. The full pipeline (ingest, nowcast engines, API, replay loop) is generated from `../prompts/PROTOTYPE_PROMPT.md` and grows around these modules.

| Module | Status |
|---|---|
| `app/hazards/cloudburst.py` | ✅ Working — IMD cloudburst cluster detection |
| `app/tracking/countdown.py` | ✅ Working — arrival windows, probability, countdown |
| `app/blend/weights.py` | ✅ Working — skill-based, normalised blend weights |
| `app/alerts/cap.py` | ✅ Working — CAP 1.2 XML generation |
| `app/adapters/base.py` | Interface for radar / satellite / lightning / NWP sources |
| `app/api/main.py` | Minimal FastAPI app (health + countdown endpoint) |

```bash
pip install -r requirements.txt
pytest -q
uvicorn app.api.main:app --reload
```
