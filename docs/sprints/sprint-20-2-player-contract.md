# Sprint 20.2 — Unified Player Resume Contract

**Status:** Implemented on `main` (verified by code audit 2026-08-17)

## Architecture

```
InterventionEngine (pure — no player APIs)
        ↓ context.resumeTimestamp
useIntervention.completeRemedial / dismissRemedial
        ↓
ResumeOrchestrator (session/video safety)
        ↓
VideoController contract
        ├── Html5VideoController
        └── YouTubeVideoController
```

InterventionEngine does **not** import HTMLVideoElement or YT.Player.

## Contract

`apps/web/features/learn/player/video-controller.ts`:

- `videoId` (internal UUID)
- `getCurrentTime()` / `getDuration()` / `isReady()`
- `seekTo(seconds): Promise<void>`
- `play()` / `pause()`
- `setPlaybackRate(rate)` / `getPlaybackRate()`

## Resume flow

1. Intervention opens → `resumeTimestamp` = seek destination  
2. Notify may `pause()` via controller  
3. Remedial complete/dismiss → `ResumeOrchestrator.resume(cmd)`:
   - reject wrong `sessionId` / `videoId`
   - `pause` → `seekTo` → optional corrective seek → `play`
4. Engine enters COOLDOWN

## Wiring

- `VideoPlayer` / `YouTubePlayer`: `onControllerReady(controller)`
- Watch page: `controllerRef` + `getVideoController` into `useIntervention`

## Tests

```bash
cd apps/web
npx tsx features/learn/player/__tests__/resume-orchestrator.test.ts
```

Covers: pause/seek/play, resume timestamp, wrong video, stale session, rebind, serialized multiple resumes, setPlaybackRate.

## Acceptance

| Criterion | Status |
|-----------|--------|
| Unified contract | Done |
| Engine free of player types | Done |
| HTML5 + YouTube adapters | Done |
| Session/video safety | Done |
| Watch page wired | Done |
| Unit tests with FakeController | Done |
