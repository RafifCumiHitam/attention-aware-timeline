# Attention-Aware Timeline

**Deep Learning-based Adaptive Learning Platform**

Monorepo for an adaptive learning system that uses computer vision (gaze, attention, head pose) to personalize learning timelines in real time.

> **Current stage:** Advanced prototype / thesis MVP. Core UX, face landmarker (browser + server), WebSocket adaptive playback, event logging, and analytics UI are implemented. Emotion models and full analytics↔DB wiring remain. See [`STATUS.md`](./STATUS.md).

---

## Tech Stack

| Layer | Technologies |
|-------|----------------|
| **Frontend** | Next.js 15 (App Router), TypeScript, Tailwind, Shadcn UI, Zustand, Axios, Framer Motion, Recharts, **@mediapipe/tasks-vision** |
| **Backend** | FastAPI, SQLAlchemy 2.0, PostgreSQL, Alembic, Pydantic v2, JWT, WebSocket |
| **AI Service** | FastAPI, MediaPipe, OpenCV, NumPy (emotion/summary still mock via DI) |
| **Deploy** | Docker Compose, Nginx |

---

## Quick Start

```bash
cp .env.example .env
docker compose up --build
# Web  http://localhost:3000
# API  http://localhost:8000/docs
# AI   http://localhost:8001/docs
```

**Frontend only (browser face tracking):**

```bash
cd apps/web && npm install && npm run dev
# /learn → Start camera (MediaPipe WASM, ~30 FPS)
```

**API migrations:**

```bash
cd apps/api
alembic upgrade head
```

---

## What works today

1. **Learn page** — video player + event logger + realtime panel + **Attention Camera** (browser Face Landmarker).
2. **Face contract (browser & server):**
   ```json
   { "gaze": {"x":0.5,"y":0.5}, "eye_open": {"left":1,"right":1}, "yaw":0, "pitch":0, "roll":0, "timestamp": 0 }
   ```
3. **Adaptive WebSocket** — `WS /learning` adjusts playback rate from attention score + emotion label.
4. **AI** — real MediaPipe face analyze; emotion/gaze/attention/summary REST still mock-swappable.

---

## Monorepo layout

```
apps/web   Next.js frontend (features/learn, features/analytics, features/attention)
apps/api   FastAPI Clean Architecture layout + WebSocket
apps/ai    Inference service (face real; others mock)
infra/     Dockerfiles, nginx, postgres
docs/      ERD, schema.sql
```

---

## Honest roadmap

1. Bind face attention score → WebSocket telemetry on one session id  
2. Replace analytics mock with `/api/v1/analytics` queries  
3. Autogenerate Alembic sync against live models  
4. Emotion model behind existing Protocol  
5. Tests for auth, events, face, websocket  

---

## License

Proprietary – All rights reserved.
