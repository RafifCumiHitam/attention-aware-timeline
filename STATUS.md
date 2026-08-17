# Attention-Aware Timeline — STATUS

## Sprint 20 (research clickstream + intervention)

### Architecture

```
VideoPlayer / YouTubePlayer
    → normalized media events
    → useClickstream (SeekFinalizer debounce ~300ms)
    → meaningful seek classification (Δ ≥ 5s)
    → InterventionEngine (zone pressure + low attention)
    → InterventionBanner (notify 2s → remedial placeholder)
    → EventService payload meta (raw vs derived)
    → GET /api/v1/analytics/sessions/{id}/export?format=json|csv
```

### Key rules

- Seek drag → one finalized event after ~300ms idle
- `seek_distance < 5s` → logged optionally as non-meaningful; **no** zone/intervention counters
- Intervention requires: meaningful **backward** seek + behavioral pressure + low attention + not remedial + not cooldown
- `CONTROL` condition (`?condition=CONTROL`) disables intervention; still logs events
- Terms: `attention_low`, `meaningful_backward_seek`, `behavioral_pressure` — not “confusion”
- SPEED_CHANGE tagged `user` vs `adaptive`

### Files

- `apps/web/features/learn/clickstream/*`
- `apps/web/features/learn/components/intervention-banner.tsx`
- `apps/web/app/(dashboard)/learn/watch/page.tsx`
- `apps/api/app/presentation/api/v1/analytics/router.py` (export)

### Tests

```bash
cd apps/web
npx tsx features/learn/clickstream/__tests__/clickstream.test.ts
```

### Export

```
GET /api/v1/analytics/sessions/{session_id}/export?format=json
GET /api/v1/analytics/sessions/{session_id}/export?format=csv
```

Owner-only (403 for other users).

### Known limitations

- Remedial content is a **development placeholder** (no LLM)
- `experiment_condition` is URL/query driven; not yet a DB column on `learning_sessions`
- HTML5 continuous `seeking` events may need extra wiring if player only emits jump seeks
- Full automated e2e matrix not run in CI yet
- Phase 12 MediaPipe worker remains independent of this sprint

## Prior performance work

- Phase 9–11: throttle REST/WS, fix FaceTracker 30fps override, SPEED_CHANGE loop
- Phase 12: MediaPipe in Web Worker + ImageBitmap latest-frame-wins
