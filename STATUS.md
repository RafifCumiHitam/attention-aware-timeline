# Project Status — Attention-Aware Timeline

**Last updated:** 2026-08-06  
**Stage:** Advanced prototype / thesis MVP (not full production)

## Implemented

| Area | Status | Notes |
|------|--------|--------|
| Monorepo + Docker | Done | `apps/web`, `apps/api`, `apps/ai`, compose dev/prod |
| Frontend shell | Done | Auth pages, dashboard, sidebar, theme, skeletons |
| Video player | Done | HTML5, speed, seek, fullscreen, keyboard, callbacks |
| Event logger | Done | Debounce, offline queue, retry, Axios → `/events` |
| Analytics UI | Done | Recharts charts; **data still mock** |
| WebSocket adaptive | Done | Rule-based playback rate from attention/emotion strings |
| AI Face (server) | Done | MediaPipe Face Landmarker, `POST /face/analyze` |
| AI Face (browser) | Done | `@mediapipe/tasks-vision` ~30 FPS; modules face/eye/pose/blink |
| AI Emotion / Summary | Mock only | Protocol + DI ready to swap |
| Alembic baseline | Done | `20260806_0001_initial_schema` — run `alembic upgrade head` |
| Auth/Users/Videos services | Partial | Routers + services exist; domain entities mostly empty |

## Not done / known gaps

- Full end-to-end: face → WS telemetry → adaptive speed on the same session ID
- Analytics wired to real DB events
- Emotion recognition models
- Rich domain/use-case layer (folders exist, mostly empty)
- Comprehensive tests (only AI face tests today)

## Local run (web face camera)

```bash
cd apps/web
npm install
npm run dev
# open /learn → Start camera
```

## DB migrate

```bash
cd apps/api
alembic upgrade head
```
