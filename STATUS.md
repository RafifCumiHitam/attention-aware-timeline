# Project Status — Attention-Aware Timeline

**Last updated:** 2026-08-08  
**Stage:** Advanced prototype / thesis MVP (not full production)

## Implemented

| Area | Status | Notes |
|------|--------|--------|
| Monorepo + Docker | Done | `apps/web`, `apps/api`, `apps/ai`, compose dev/prod |
| Frontend shell | Done | Auth pages, dashboard, sidebar, theme, skeletons |
| Video player | Done | HTML5, speed, seek, fullscreen, keyboard, `externalPlaybackRate` |
| Event logger | Done | Debounce, offline queue, retry, Axios → `/events` |
| Analytics UI | Done | Recharts charts; **data still mock** |
| WebSocket adaptive | Done | Rule engine; seek+difficult+low attention → **0.8x** |
| **Core Attention Pipeline** | Done | Face → score → session telemetry → WS → player rate |
| AI Face (server) | Done | MediaPipe Face Landmarker, `POST /face/analyze` |
| AI Face (browser) | Done | CDN WASM ~30 FPS; modules face/eye/pose/blink |
| AI Emotion / Summary | Mock only | Protocol + DI ready to swap |
| Alembic baseline | Done | `20260806_0001_initial_schema` |
| Auth/Users/Videos services | Partial | Routers + services exist; domain entities mostly empty |

## Core pipeline (this sprint)

```
Camera → Face Landmarker → eye/gaze/pose/blink
  → attentionScoreFromFace (heuristic)
  → useAttentionPipeline (session_id bound)
  → WS telemetry (video time + wall_clock_ms)
  → evaluate_adaptive_playback
  → AdaptivePlaybackCommand (0.8x on SEEK_FORWARD + difficult + low attention)
  → VideoPlayer.externalPlaybackRate
```

- **Video time** = `progress_seconds` / player `currentTime`
- **Wall-clock** = `wall_clock_ms` / event ISO timestamps
- **Difficult section** heuristic: progress 40–80% (until Difficulty Timeline DB is wired)

## Not done / known gaps

- Analytics wired to real DB events
- Emotion recognition models
- Difficulty Timeline from PostgreSQL (currently heuristic band)
- Session REST create + JWT-required WS
- Rich domain/use-case layer
- Comprehensive tests

## Local run

```bash
# API (WS at /api/v1/ws/learning)
cd apps/api && uvicorn app.main:app --reload --port 8000

# Web
cd apps/web && npm run dev
# open /learn → Start camera → play/seek video
```
