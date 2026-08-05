# AI Microservice

FastAPI service for **Emotion Detection**, **Eye Tracking**, **Attention Scoring**, and **Session Summaries**.

> Current stage: **REST + interfaces + mock JSON**. No model inference yet.

## Structure

```
app/
├── api/v1/          # REST routers
├── services/        # Orchestration (DI consumers)
├── emotion/         # EmotionDetector protocol + Mock
├── gaze/            # GazeTracker protocol + Mock
├── attention/       # AttentionScorer protocol + Mock
├── summary/         # SummaryGenerator protocol + Mock
├── models/          # Pydantic schemas
├── utils/           # Image helpers
├── core/            # Config & logging
├── dependencies.py  # FastAPI Depends wiring
└── main.py
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/health` | Liveness |
| GET | `/api/v1/ready` | Readiness |
| POST | `/api/v1/emotion/detect` | Emotion detection |
| POST | `/api/v1/gaze/track` | Gaze / eye tracking |
| POST | `/api/v1/attention/score` | Attention score 0–100 |
| POST | `/api/v1/summary/generate` | Session summary |

## Run

```bash
cd apps/ai
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```

OpenAPI: http://localhost:8001/docs

## Dependency Injection

Routers depend on **services**; services depend on **protocols**.

Swap mocks in `app/dependencies.py`:

```python
# from app.emotion.mock import MockEmotionDetector
# from app.emotion.pytorch_model import PyTorchEmotionDetector

@lru_cache
def get_emotion_detector() -> EmotionDetector:
    return PyTorchEmotionDetector(...)  # real model
```

Routers stay unchanged.
