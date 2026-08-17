# Sprint 20 Acceptance Audit (Sprint 20.1 + 20.2 notes)

**Repo:** RafifCumiHitam/attention-aware-timeline

## Sprint 20.2 — Unified VideoController (implemented)

```
InterventionEngine (pure decisions)
       ↓ context.resumeTimestamp
useIntervention + ResumeOrchestrator
       ↓ VideoController contract
Html5VideoController | YouTubeVideoController
```

- `InterventionEngine` still has **no** player imports.
- Resume on remedial complete/dismiss: `pause → seekTo(resumeTimestamp) → play`.
- Session safety: wrong `videoId` / stale `sessionId` / controller mismatch → rejected.
- Tests: `apps/web/features/learn/player/__tests__/resume-orchestrator.test.ts`

```bash
cd apps/web
npx tsx features/learn/player/__tests__/resume-orchestrator.test.ts
```

### Resume gap status

| Item | 20.1 | 20.2 |
|------|------|------|
| resumeAt stored | Yes | Yes |
| Player seek on complete | **No** | **Yes** via VideoController |
| YouTube seekTo exposed | No | Yes (adapter) |
| HTML5 seek | Internal only | Html5VideoController |

### Still open (later sprints)

- Persist `experiment_condition` on `learning_sessions`
- Formal Vitest/CI wiring
- Full E2E matrix

---

## Sprint 20.1 matrix (summary)

| Requirement | Existing | Gap after 20.2 |
|-------------|----------|----------------|
| Seek debounce | Yes | — |
| ≥5s meaningful | Yes | — |
| Intervention FSM | Yes | — |
| Resume control | Partial | **Closed for main path** |
| Experiment condition DB | URL only | Still open |
| E2E | No | Still open |
