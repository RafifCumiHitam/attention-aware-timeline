# Project Status — Attention-Aware Timeline

**Last updated:** 2026-08-08  
**Stage:** Advanced prototype / thesis MVP (not full production)

## Implemented

| Area | Status | Notes |
|------|--------|--------|
| Monorepo + Docker | Done | `apps/web`, `apps/api`, `apps/ai` |
| Video player | Done | HTML5 + `externalPlaybackRate` |
| Event logger | Done | Debounce, offline queue, `session_id` context |
| **Session sync (Sprint 14)** | Done | ACTIVE/PAUSED/ENDED lifecycle, recover, timeline |
| WebSocket adaptive | Done | Seek+difficult+low attention → 0.8x |
| Core Attention Pipeline | Done | Face → score → session telemetry → player |
| Browser Face Landmarker | Done | CDN WASM ~30 FPS |
| Alembic | Done | `20260806_0001` + `20260808_0002_session_sync` |

## Session contract

- **One `session_id`** for player events, attention samples, adaptive decisions, and WS telemetry.
- Lifecycle: `START → ACTIVE ↔ PAUSED → ENDED|ABANDONED`
- Writable statuses: `active`, `paused`
- Closed sessions reject new event writes (422)
- Reconstruction: `GET /api/v1/sessions/{id}/timeline` ordered by `video_timestamp`

## Acceptance example

```
session_id = abc123
00:30 PLAY
00:42 attention 0.82
01:15 SEEK_FORWARD
01:16 attention 0.31
01:17 adaptive_decision 0.8x
01:20 speed_change 0.8x
```

All rows share the same `session_id`.

## Migrate

```bash
cd apps/api && alembic upgrade head
pytest tests/test_session_sync.py -q
```
